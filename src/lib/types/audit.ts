/**
 * Audit log types.
 *
 * An AuditEntry is a single row in NovasysV2_AuditLog that records one
 * destructive admin action with enough context to be reverted.
 */

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "BULK_REGULARIZE"
  | "REVERT";

export type AuditEntityType =
  | "DAILY_SUMMARY"
  | "APPROVAL_REQUEST"
  | "EMPLOYEE"
  | "INVITATION"
  | "HR_EVENT"
  | "HR_DOCUMENT"
  | "TENANT_SETTINGS";

export type AuditActorRole = "ADMIN" | "SUPER_ADMIN" | "SYSTEM";

/** Opaque identifier for the entity affected, e.g. {EmployeeID, WorkDate}. */
export type AuditEntityKey = Record<string, string>;

/** Snapshot of a record — unknown shape, stored as JSON in Dynamo. */
export type AuditSnapshot = Record<string, unknown> | null;

/** Per-field diff produced by computeDiff(). */
export interface AuditDiff {
  [field: string]: {
    from: unknown;
    to: unknown;
  };
}

export interface AuditEntry {
  /** PK: `AUDIT#${tenantId}#${createdAt}#${uuid8}` */
  AuditID: string;
  /** SK: always "META" (reserved for future sub-items) */
  SK: "META";

  tenantId: string;

  actorId: string;
  actorName: string;
  actorRole: AuditActorRole;

  entityType: AuditEntityType;
  entityKey: AuditEntityKey;
  /**
   * GSI partition for AUDIT_BY_ENTITY: `${tenantId}#${entityType}#${keyHash}`.
   * Lets us query all audit rows touching a single entity fast.
   */
  entityPartition: string;
  /** Human-readable label for UI, e.g. "Juan Pérez · 2026-01-15". */
  entityLabel: string;

  action: AuditAction;

  before: AuditSnapshot;
  after: AuditSnapshot;
  diff: AuditDiff;

  reason?: string;

  /** Set when this entry is part of a bulk operation (e.g. regularizeRange). */
  groupId?: string;
  /** Only on the summary row of a group. */
  groupSize?: number;
  /** Flag the summary row of a group so the UI can render it specially. */
  isGroupSummary?: boolean;

  /** Filled when this entry has been undone by a REVERT entry. */
  revertedAt?: string;
  revertedBy?: string;
  revertedAuditId?: string;

  createdAt: string;
  /** Unix epoch seconds — DynamoDB TTL attribute. */
  expiresAt: number;
}

export interface AuditListFilters {
  tenantId: string;
  entityType?: AuditEntityType;
  actorId?: string;
  from?: string;
  to?: string;
  /** When true, hide entries that have been reverted. */
  hideReverted?: boolean;
  limit?: number;
  cursor?: string;
}

export interface AuditListResult {
  items: AuditEntry[];
  nextCursor?: string;
}

/** Raised when a revert cannot proceed because a later action touched the same record. */
export interface AuditConflict {
  conflictingAuditId: string;
  conflictingActorName: string;
  conflictingCreatedAt: string;
  conflictingAction: AuditAction;
}
