/**
 * HR Documents DB operations.
 * Stores document metadata in the HR_EVENTS table using:
 *   NotificationID = HRDOC#<uuid>  (partition key)
 *   TenantID + EventMonth=DOC for querying via Tenant-Month-index GSI
 */

import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

export interface HRDocument {
  NotificationID: string; // HRDOC#<uuid>
  TenantID: string;
  EventMonth: string; // "DOC" — fixed value for GSI queries
  Type: string; // "DOCUMENT"
  Status: string; // "ACTIVE"
  DocID: string;
  Title: string;
  Category: string; // "Politicas" | "Manuales" | "Formatos" | "Otros"
  FileName: string;
  FileUrl: string;
  FileSize: number;
  ContentType: string;
  UploadedBy: string; // email
  UploadedByName: string;
  CreatedAt: string;
}

export async function createHRDocument(doc: HRDocument): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.HR_EVENTS,
      Item: doc,
    })
  );
}

export async function getAllHRDocuments(
  tenantId: string
): Promise<HRDocument[]> {
  const items: HRDocument[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.HR_EVENTS,
        IndexName: INDEXES.HR_BY_TENANT,
        KeyConditionExpression: "TenantID = :tid AND EventMonth = :m",
        FilterExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "Status" },
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":m": "DOC",
          ":active": "ACTIVE",
        },
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      })
    );
    items.push(...((result.Items as HRDocument[]) ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items.sort(
    (a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()
  );
}

export async function deleteHRDocument(
  notificationId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.HR_EVENTS,
      Key: { NotificationID: notificationId },
    })
  );
}
