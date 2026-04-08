/**
 * Snapshot factories for each audited entity type.
 *
 * The audit service is intentionally generic — it doesn't know how to read or
 * write DailySummary, ApprovalRequest, Employee, etc. Instead, each entity
 * registers a Snapshotter here that knows:
 *
 *   - how to read the current record (for `before` snapshots)
 *   - how to restore a snapshot (for revert)
 *   - how to delete the record (for revert of CREATE)
 *   - how to produce a human-readable label
 *
 * Adding a new audited entity type = adding a new entry to ENTITY_SNAPSHOTTERS.
 */

import { docClient } from "@/lib/db/client";
import { TABLES } from "@/lib/db/tables";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  AuditEntityKey,
  AuditEntityType,
  AuditSnapshot,
} from "@/lib/types/audit";

export interface Snapshotter {
  /** Fetch the current record for an entity key. Returns null if missing. */
  read(key: AuditEntityKey): Promise<AuditSnapshot>;
  /** Put the snapshot back into the underlying table (used to restore). */
  restore(snapshot: Record<string, unknown>): Promise<void>;
  /** Delete the record at this key (used to revert a CREATE). */
  remove(key: AuditEntityKey): Promise<void>;
  /** Build a human-readable label for the UI. */
  label(key: AuditEntityKey, snapshot: AuditSnapshot): string;
  /**
   * Compute a short hash of the entity key for the GSI partition.
   * Must be deterministic for the same logical entity.
   */
  keyHash(key: AuditEntityKey): string;
}

/** Normalize an entity key to a stable string, e.g. `EMP#123|DATE#2026-01-15`. */
function defaultKeyHash(key: AuditEntityKey): string {
  return Object.keys(key)
    .sort()
    .map((k) => `${k}=${key[k]}`)
    .join("|");
}

// ─── DAILY_SUMMARY ───────────────────────────────────────────────────────────

const dailySummarySnapshotter: Snapshotter = {
  async read(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.DAILY_SUMMARY,
        Key: {
          EmployeeID: key.EmployeeID,
          WorkDate: key.WorkDate,
        },
      })
    );
    return (result.Item as AuditSnapshot) ?? null;
  },

  async restore(snapshot) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.DAILY_SUMMARY,
        Item: snapshot,
      })
    );
  },

  async remove(key) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.DAILY_SUMMARY,
        Key: {
          EmployeeID: key.EmployeeID,
          WorkDate: key.WorkDate,
        },
      })
    );
  },

  label(key, snapshot) {
    // WorkDate is stored as "DATE#2026-01-15" — strip the prefix for display.
    const ymd = (key.WorkDate || "").replace(/^DATE#/, "");
    const emp =
      (snapshot as { employeeName?: string } | null)?.employeeName ||
      (key.EmployeeID || "").replace(/^EMP#/, "");
    return `${emp} · ${ymd}`;
  },

  keyHash: defaultKeyHash,
};

// ─── APPROVAL_REQUEST ────────────────────────────────────────────────────────

const approvalRequestSnapshotter: Snapshotter = {
  async read(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.APPROVAL_REQUESTS,
        Key: { RequestID: key.RequestID, SK: "METADATA" },
      })
    );
    return (result.Item as AuditSnapshot) ?? null;
  },

  async restore(snapshot) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.APPROVAL_REQUESTS,
        Item: snapshot,
      })
    );
  },

  async remove(key) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.APPROVAL_REQUESTS,
        Key: { RequestID: key.RequestID, SK: "METADATA" },
      })
    );
  },

  label(key, snapshot) {
    const s = snapshot as
      | { employeeName?: string; requestType?: string }
      | null;
    const name = s?.employeeName || key.RequestID;
    const type = s?.requestType || "Solicitud";
    return `${type} · ${name}`;
  },

  keyHash: defaultKeyHash,
};

// ─── EMPLOYEE ────────────────────────────────────────────────────────────────

const employeeSnapshotter: Snapshotter = {
  async read(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.EMPLOYEES,
        Key: { EmployeeID: key.EmployeeID },
      })
    );
    return (result.Item as AuditSnapshot) ?? null;
  },

  async restore(snapshot) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.EMPLOYEES,
        Item: snapshot,
      })
    );
  },

  async remove(key) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.EMPLOYEES,
        Key: { EmployeeID: key.EmployeeID },
      })
    );
  },

  label(key, snapshot) {
    const s = snapshot as { FullName?: string } | null;
    return s?.FullName || key.EmployeeID;
  },

  keyHash: defaultKeyHash,
};

// ─── TENANT_SETTINGS ─────────────────────────────────────────────────────────

const tenantSettingsSnapshotter: Snapshotter = {
  async read(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.TENANTS,
        Key: { TenantID: key.TenantID },
      })
    );
    return (result.Item as AuditSnapshot) ?? null;
  },

  async restore(snapshot) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.TENANTS,
        Item: snapshot,
      })
    );
  },

  async remove(key) {
    // Tenants shouldn't be deletable via revert — fall back to Put-empty would
    // be destructive. Throw so the admin knows this isn't supported.
    throw new Error(
      `Revert de CREATE de tenant no soportado (${key.TenantID})`
    );
  },

  label(key, snapshot) {
    const s = snapshot as { Name?: string; Slug?: string } | null;
    return s?.Name || s?.Slug || key.TenantID;
  },

  keyHash: defaultKeyHash,
};

// ─── HR_EVENT ────────────────────────────────────────────────────────────────

const hrEventSnapshotter: Snapshotter = {
  async read(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.HR_EVENTS,
        Key: { NotificationID: key.NotificationID },
      })
    );
    return (result.Item as AuditSnapshot) ?? null;
  },

  async restore(snapshot) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.HR_EVENTS,
        Item: snapshot,
      })
    );
  },

  async remove(key) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.HR_EVENTS,
        Key: { NotificationID: key.NotificationID },
      })
    );
  },

  label(key, snapshot) {
    const s = snapshot as { Title?: string; Type?: string } | null;
    return s?.Title || s?.Type || key.NotificationID;
  },

  keyHash: defaultKeyHash,
};

// ─── HR_DOCUMENT ─────────────────────────────────────────────────────────────

const hrDocumentSnapshotter: Snapshotter = {
  async read(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.HR_EVENTS, // documents share HREvents table in this project
        Key: { NotificationID: key.NotificationID },
      })
    );
    return (result.Item as AuditSnapshot) ?? null;
  },

  async restore(snapshot) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.HR_EVENTS,
        Item: snapshot,
      })
    );
  },

  async remove(key) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.HR_EVENTS,
        Key: { NotificationID: key.NotificationID },
      })
    );
  },

  label(key, snapshot) {
    const s = snapshot as { Title?: string } | null;
    return s?.Title || key.NotificationID;
  },

  keyHash: defaultKeyHash,
};

// ─── INVITATION ──────────────────────────────────────────────────────────────

const invitationSnapshotter: Snapshotter = {
  async read(key) {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.INVITATIONS,
        Key: { InviteID: key.InviteID },
      })
    );
    return (result.Item as AuditSnapshot) ?? null;
  },

  async restore(snapshot) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.INVITATIONS,
        Item: snapshot,
      })
    );
  },

  async remove(key) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.INVITATIONS,
        Key: { InviteID: key.InviteID },
      })
    );
  },

  label(key, snapshot) {
    const s = snapshot as { Email?: string; FullName?: string } | null;
    return s?.FullName || s?.Email || key.InviteID;
  },

  keyHash: defaultKeyHash,
};

// ─── REGISTRY ────────────────────────────────────────────────────────────────

export const ENTITY_SNAPSHOTTERS: Partial<
  Record<AuditEntityType, Snapshotter>
> = {
  DAILY_SUMMARY: dailySummarySnapshotter,
  APPROVAL_REQUEST: approvalRequestSnapshotter,
  EMPLOYEE: employeeSnapshotter,
  TENANT_SETTINGS: tenantSettingsSnapshotter,
  HR_EVENT: hrEventSnapshotter,
  HR_DOCUMENT: hrDocumentSnapshotter,
  INVITATION: invitationSnapshotter,
};

export function getSnapshotter(entityType: AuditEntityType): Snapshotter {
  const s = ENTITY_SNAPSHOTTERS[entityType];
  if (!s) {
    throw new Error(
      `No snapshotter registered for entity type ${entityType}. Add one to ENTITY_SNAPSHOTTERS.`
    );
  }
  return s;
}
