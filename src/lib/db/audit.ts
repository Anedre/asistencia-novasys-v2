/**
 * Low-level DynamoDB operations for the AuditLog table.
 *
 * Higher-level business logic (withAudit wrapper, revert, conflict detection)
 * lives in `src/lib/services/audit.service.ts`.
 */

import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  AuditEntry,
  AuditListFilters,
  AuditListResult,
} from "@/lib/types/audit";

function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key)).toString("base64url");
}

function decodeCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
}

export async function insertAudit(entry: AuditEntry): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.AUDIT_LOG,
      Item: entry,
    })
  );
}

export async function getAudit(auditId: string): Promise<AuditEntry | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.AUDIT_LOG,
      Key: { AuditID: auditId, SK: "META" },
    })
  );
  return (result.Item as AuditEntry) ?? null;
}

export async function listAuditByTenant(
  filters: AuditListFilters
): Promise<AuditListResult> {
  const { tenantId, from, to, limit = 50, cursor } = filters;

  const keyConditions = ["tenantId = :tid"];
  const values: Record<string, unknown> = { ":tid": tenantId };

  if (from && to) {
    keyConditions.push("createdAt BETWEEN :from AND :to");
    values[":from"] = from;
    values[":to"] = to;
  } else if (from) {
    keyConditions.push("createdAt >= :from");
    values[":from"] = from;
  } else if (to) {
    keyConditions.push("createdAt <= :to");
    values[":to"] = to;
  }

  const filterExpressions: string[] = [];
  if (filters.entityType) {
    filterExpressions.push("entityType = :etype");
    values[":etype"] = filters.entityType;
  }
  if (filters.actorId) {
    filterExpressions.push("actorId = :aid");
    values[":aid"] = filters.actorId;
  }
  if (filters.hideReverted) {
    filterExpressions.push("attribute_not_exists(revertedAt)");
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.AUDIT_LOG,
      IndexName: INDEXES.AUDIT_BY_TENANT,
      KeyConditionExpression: keyConditions.join(" AND "),
      ExpressionAttributeValues: values,
      FilterExpression:
        filterExpressions.length > 0
          ? filterExpressions.join(" AND ")
          : undefined,
      ScanIndexForward: false, // newest first
      Limit: limit,
      ExclusiveStartKey: cursor ? decodeCursor(cursor) : undefined,
    })
  );

  return {
    items: (result.Items as AuditEntry[]) ?? [],
    nextCursor: result.LastEvaluatedKey
      ? encodeCursor(result.LastEvaluatedKey)
      : undefined,
  };
}

/** List all audit entries for a given entity key (used for conflict detection). */
export async function listAuditByEntity(
  tenantId: string,
  entityType: string,
  entityKeyHash: string,
  afterCreatedAt?: string
): Promise<AuditEntry[]> {
  const partitionKey = `${tenantId}#${entityType}#${entityKeyHash}`;
  const keyConditions = ["entityPartition = :pk"];
  const values: Record<string, unknown> = { ":pk": partitionKey };

  if (afterCreatedAt) {
    keyConditions.push("createdAt > :after");
    values[":after"] = afterCreatedAt;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.AUDIT_LOG,
      IndexName: INDEXES.AUDIT_BY_ENTITY,
      KeyConditionExpression: keyConditions.join(" AND "),
      ExpressionAttributeValues: values,
      ScanIndexForward: true,
    })
  );
  return (result.Items as AuditEntry[]) ?? [];
}

export async function listAuditByGroup(groupId: string): Promise<AuditEntry[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.AUDIT_LOG,
      IndexName: INDEXES.AUDIT_BY_GROUP,
      KeyConditionExpression: "groupId = :gid",
      ExpressionAttributeValues: { ":gid": groupId },
    })
  );
  return (result.Items as AuditEntry[]) ?? [];
}

export async function markAuditReverted(
  auditId: string,
  revertedBy: string,
  revertedAuditId: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.AUDIT_LOG,
      Key: { AuditID: auditId, SK: "META" },
      UpdateExpression:
        "SET revertedAt = :at, revertedBy = :by, revertedAuditId = :rid",
      ExpressionAttributeValues: {
        ":at": new Date().toISOString(),
        ":by": revertedBy,
        ":rid": revertedAuditId,
      },
      // Only mark as reverted if it isn't already — prevents double-revert races.
      ConditionExpression: "attribute_not_exists(revertedAt)",
    })
  );
}
