/**
 * Audit service — business logic for the audit log.
 *
 * Exposes:
 *   - withAudit()      wrapper for destructive admin mutations
 *   - computeDiff()    utility to diff two snapshots
 *   - revertAudit()    undo a single audit entry
 *   - revertGroup()    undo a whole bulk operation
 *   - detectConflict() check if a later action blocks revert
 */

import { randomUUID } from "crypto";
import {
  insertAudit,
  getAudit,
  listAuditByEntity,
  listAuditByGroup,
  markAuditReverted,
} from "@/lib/db/audit";
import { getSnapshotter } from "./audit-snapshots";
import type { SessionUser } from "@/lib/auth-helpers";
import type {
  AuditAction,
  AuditConflict,
  AuditDiff,
  AuditEntityKey,
  AuditEntityType,
  AuditEntry,
  AuditSnapshot,
} from "@/lib/types/audit";
import { ValidationError } from "@/lib/utils/errors";

const RETENTION_DAYS = 90;

// ─── ID generation ───────────────────────────────────────────────────────────

function buildAuditId(tenantId: string, createdAt: string): string {
  const shortUuid = randomUUID().replace(/-/g, "").slice(0, 8);
  return `AUDIT#${tenantId}#${createdAt}#${shortUuid}`;
}

function computeExpiresAt(createdAtIso: string): number {
  const epochMs = new Date(createdAtIso).getTime();
  return Math.floor((epochMs + RETENTION_DAYS * 24 * 60 * 60 * 1000) / 1000);
}

// ─── Diff ────────────────────────────────────────────────────────────────────

/**
 * Produces a shallow diff of two snapshots. Nested objects are compared with
 * JSON.stringify for determinism — the admin UI renders them as JSON blobs
 * anyway, which is fine for the use cases we care about (regularization,
 * employee profile, tenant settings).
 */
export function computeDiff(
  before: AuditSnapshot,
  after: AuditSnapshot
): AuditDiff {
  const diff: AuditDiff = {};
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  for (const k of keys) {
    // Internal/noisy fields we don't want to clutter the diff with.
    if (k === "updatedAt" || k === "updatedAtLocal") continue;

    const a = (before ?? {})[k];
    const b = (after ?? {})[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[k] = { from: a, to: b };
    }
  }
  return diff;
}

// ─── withAudit wrapper ───────────────────────────────────────────────────────

export interface WithAuditContext {
  actor: SessionUser;
  entityType: AuditEntityType;
  entityKey: AuditEntityKey;
  action: AuditAction;
  reason?: string;
  groupId?: string;
  isGroupSummary?: boolean;
  groupSize?: number;
  /**
   * Optional: skip automatic before-read (useful when the caller already has
   * the snapshot, or for pure CREATE actions where there's nothing to read).
   */
  skipBeforeRead?: boolean;
  /** Optional pre-computed before snapshot. */
  beforeSnapshot?: AuditSnapshot;
}

export interface WithAuditResult<T> {
  result: T;
  auditId: string;
}

/**
 * Wraps a destructive mutation. Reads the current state (if applicable),
 * runs the mutation, then inserts an audit row with both snapshots and a diff.
 *
 * Contract:
 *   - If `mutate()` throws, NO audit entry is written.
 *   - If `insertAudit()` throws after a successful mutate, the error is logged
 *     but the caller is NOT notified — the primary data operation succeeded
 *     and we don't roll it back. (Audit is best-effort.)
 */
export async function withAudit<T>(
  ctx: WithAuditContext,
  mutate: () => Promise<T>
): Promise<WithAuditResult<T>> {
  const snapshotter = getSnapshotter(ctx.entityType);

  let before: AuditSnapshot = null;
  if (!ctx.skipBeforeRead) {
    before = ctx.beforeSnapshot ?? (await snapshotter.read(ctx.entityKey));
  }

  const result = await mutate();

  const after: AuditSnapshot =
    ctx.action === "DELETE" ? null : await snapshotter.read(ctx.entityKey);

  const createdAt = new Date().toISOString();
  const auditId = buildAuditId(ctx.actor.tenantId, createdAt);
  const keyHash = snapshotter.keyHash(ctx.entityKey);

  const entry: AuditEntry = {
    AuditID: auditId,
    SK: "META",
    tenantId: ctx.actor.tenantId,
    actorId: ctx.actor.employeeId,
    actorName: ctx.actor.name,
    actorRole: ctx.actor.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    entityType: ctx.entityType,
    entityKey: ctx.entityKey,
    entityPartition: `${ctx.actor.tenantId}#${ctx.entityType}#${keyHash}`,
    entityLabel: snapshotter.label(ctx.entityKey, after ?? before),
    action: ctx.action,
    before,
    after,
    diff: computeDiff(before, after),
    reason: ctx.reason,
    groupId: ctx.groupId,
    groupSize: ctx.groupSize,
    isGroupSummary: ctx.isGroupSummary,
    createdAt,
    expiresAt: computeExpiresAt(createdAt),
  };

  try {
    await insertAudit(entry);
  } catch (err) {
    // Best-effort: log but don't fail the caller — the primary mutation already ran.
    console.error("[audit] Failed to persist audit entry", {
      auditId,
      entityType: ctx.entityType,
      err,
    });
  }

  return { result, auditId };
}

// ─── Conflict detection ──────────────────────────────────────────────────────

/**
 * Returns the first audit entry that touched the same entity after the given
 * audit, or null if none exists. Used to block reverts when a later admin
 * action would be clobbered.
 */
export async function detectConflict(
  audit: AuditEntry
): Promise<AuditConflict | null> {
  const snapshotter = getSnapshotter(audit.entityType);
  const keyHash = snapshotter.keyHash(audit.entityKey);

  const later = await listAuditByEntity(
    audit.tenantId,
    audit.entityType,
    keyHash,
    audit.createdAt
  );

  // Exclude the audit itself (GSI may include it if createdAt equals).
  const blocking = later.find(
    (e) => e.AuditID !== audit.AuditID && !e.revertedAt
  );
  if (!blocking) return null;

  return {
    conflictingAuditId: blocking.AuditID,
    conflictingActorName: blocking.actorName,
    conflictingCreatedAt: blocking.createdAt,
    conflictingAction: blocking.action,
  };
}

// ─── Revert ──────────────────────────────────────────────────────────────────

export class RevertBlockedError extends Error {
  constructor(public conflict: AuditConflict, message: string) {
    super(message);
    this.name = "RevertBlockedError";
  }
}

/**
 * Applies the inverse of an audit entry:
 *   CREATE → delete current record
 *   DELETE → put `before` back
 *   UPDATE/APPROVE/REJECT/BULK_REGULARIZE → put `before` back
 *
 * Writes a new audit row with action=REVERT and marks the original as reverted.
 */
export async function revertAudit(
  auditId: string,
  actor: SessionUser
): Promise<{ revertAuditId: string }> {
  const audit = await getAudit(auditId);
  if (!audit) throw new ValidationError(`Audit ${auditId} no encontrado`);
  if (audit.tenantId !== actor.tenantId) {
    throw new ValidationError("No puedes revertir un audit de otro tenant");
  }
  if (audit.revertedAt) {
    throw new ValidationError("Esta acción ya fue revertida");
  }
  if (audit.action === "REVERT") {
    throw new ValidationError(
      "No puedes revertir un revert directamente. Aplica la acción original de nuevo."
    );
  }

  const conflict = await detectConflict(audit);
  if (conflict) {
    throw new RevertBlockedError(
      conflict,
      `Esta entrada ya fue modificada por ${conflict.conflictingActorName} el ${conflict.conflictingCreatedAt} (${conflict.conflictingAction}). Revierte primero esa acción.`
    );
  }

  const snapshotter = getSnapshotter(audit.entityType);

  // Apply the inverse.
  if (audit.action === "CREATE") {
    await snapshotter.remove(audit.entityKey);
  } else if (audit.before) {
    await snapshotter.restore(audit.before as Record<string, unknown>);
  } else {
    throw new ValidationError(
      "No hay snapshot `before` para restaurar — no se puede revertir."
    );
  }

  // Write the revert audit entry (best-effort).
  const createdAt = new Date().toISOString();
  const revertAuditId = buildAuditId(actor.tenantId, createdAt);
  const keyHash = snapshotter.keyHash(audit.entityKey);

  const revertEntry: AuditEntry = {
    AuditID: revertAuditId,
    SK: "META",
    tenantId: actor.tenantId,
    actorId: actor.employeeId,
    actorName: actor.name,
    actorRole: actor.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    entityType: audit.entityType,
    entityKey: audit.entityKey,
    entityPartition: `${actor.tenantId}#${audit.entityType}#${keyHash}`,
    entityLabel: audit.entityLabel,
    action: "REVERT",
    before: audit.after,
    after: audit.before,
    diff: computeDiff(audit.after, audit.before),
    reason: `Revert de ${audit.AuditID}`,
    createdAt,
    expiresAt: computeExpiresAt(createdAt),
  };

  try {
    await insertAudit(revertEntry);
    await markAuditReverted(audit.AuditID, actor.employeeId, revertAuditId);
  } catch (err) {
    console.error("[audit] Failed to persist revert entry", {
      auditId,
      revertAuditId,
      err,
    });
  }

  return { revertAuditId };
}

/**
 * Revert a whole bulk operation. Walks each child audit row and reverts it.
 * On the first conflict, stops and returns partial results — the caller
 * surfaces the error so the admin can decide what to do.
 */
export async function revertGroup(
  groupId: string,
  actor: SessionUser
): Promise<{
  total: number;
  reverted: number;
  skipped: number;
  blockedBy?: AuditConflict;
}> {
  const all = await listAuditByGroup(groupId);
  // Ignore the summary row itself — we only revert the child rows with before/after data.
  const children = all.filter((e) => !e.isGroupSummary);

  let reverted = 0;
  let skipped = 0;

  for (const entry of children) {
    if (entry.revertedAt) {
      skipped++;
      continue;
    }
    try {
      await revertAudit(entry.AuditID, actor);
      reverted++;
    } catch (err) {
      if (err instanceof RevertBlockedError) {
        return {
          total: children.length,
          reverted,
          skipped,
          blockedBy: err.conflict,
        };
      }
      throw err;
    }
  }

  return { total: children.length, reverted, skipped };
}

// Shared between regularization service and future callers that need a group id.
export function buildGroupId(): string {
  return `GROUP#${Date.now()}#${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}
