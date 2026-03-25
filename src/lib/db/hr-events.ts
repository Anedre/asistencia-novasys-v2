/**
 * HR events DB operations.
 */

import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { HREvent } from "@/lib/types";

export async function putHREvent(event: HREvent): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.HR_EVENTS,
      Item: event,
    })
  );
}

export async function getHREvent(notificationId: string): Promise<HREvent | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.HR_EVENTS,
      Key: { NotificationID: notificationId },
    })
  );
  return (result.Item as HREvent) ?? null;
}

export async function getHREventsByMonth(month: string): Promise<HREvent[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.HR_EVENTS,
      IndexName: INDEXES.HR_BY_MONTH,
      KeyConditionExpression: "EventMonth = :m",
      ExpressionAttributeValues: { ":m": month },
    })
  );
  const items = (result.Items as HREvent[]) ?? [];
  return items.filter((i) => i.Status === "ACTIVE");
}

export async function archiveHREvent(notificationId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.HR_EVENTS,
      Key: { NotificationID: notificationId },
      UpdateExpression: "SET #s = :archived",
      ExpressionAttributeNames: { "#s": "Status" },
      ExpressionAttributeValues: { ":archived": "ARCHIVED" },
    })
  );
}
