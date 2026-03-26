/**
 * Approval requests DB operations.
 */

import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ApprovalRequest, RequestStatus } from "@/lib/types";

export async function putRequest(request: ApprovalRequest): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.APPROVAL_REQUESTS,
      Item: request,
    })
  );
}

export async function getRequest(requestId: string): Promise<ApprovalRequest | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.APPROVAL_REQUESTS,
      Key: { RequestID: requestId, SK: "METADATA" },
    })
  );
  return (result.Item as ApprovalRequest) ?? null;
}

export async function getRequestsByEmployee(
  employeeId: string,
  limit = 50
): Promise<ApprovalRequest[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.APPROVAL_REQUESTS,
      IndexName: INDEXES.REQUESTS_BY_EMPLOYEE,
      KeyConditionExpression: "employeeId = :eid",
      ExpressionAttributeValues: { ":eid": employeeId },
      ScanIndexForward: false, // newest first
      Limit: limit,
    })
  );
  return (result.Items as ApprovalRequest[]) ?? [];
}

export async function getRequestsByStatus(
  status: RequestStatus,
  limit = 100,
  tenantId?: string
): Promise<ApprovalRequest[]> {
  // If tenantId provided, use Tenant-Status-index (PK=TenantID, SK=status)
  if (tenantId) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.APPROVAL_REQUESTS,
        IndexName: INDEXES.REQUESTS_BY_TENANT,
        KeyConditionExpression: "TenantID = :tid AND #s = :status",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":tid": tenantId, ":status": status },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
    return (result.Items as ApprovalRequest[]) ?? [];
  }

  // Fallback: status-only GSI
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.APPROVAL_REQUESTS,
      IndexName: INDEXES.REQUESTS_BY_STATUS,
      KeyConditionExpression: "#s = :status",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":status": status },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items as ApprovalRequest[]) ?? [];
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  reviewedBy: string,
  reviewedByName: string,
  reviewerNote?: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.APPROVAL_REQUESTS,
      Key: { RequestID: requestId, SK: "METADATA" },
      UpdateExpression: `
        SET #s = :status,
            reviewedBy = :reviewedBy,
            reviewedByName = :reviewedByName,
            reviewedAt = :now,
            reviewerNote = :note,
            updatedAt = :now
      `,
      ConditionExpression: "#s = :pending",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":pending": "PENDING",
        ":reviewedBy": reviewedBy,
        ":reviewedByName": reviewedByName,
        ":note": reviewerNote ?? "",
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function cancelRequest(requestId: string, employeeId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.APPROVAL_REQUESTS,
      Key: { RequestID: requestId, SK: "METADATA" },
      UpdateExpression: "SET #s = :cancelled, updatedAt = :now",
      ConditionExpression: "#s = :pending AND employeeId = :eid",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":cancelled": "CANCELLED",
        ":pending": "PENDING",
        ":eid": employeeId,
        ":now": new Date().toISOString(),
      },
    })
  );
}
