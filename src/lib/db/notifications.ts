/**
 * User notifications DB operations.
 */

import { docClient } from "./client";
import { TABLES } from "./tables";
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { UserNotification } from "@/lib/types";

export async function putNotification(notification: UserNotification): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.USER_NOTIFICATIONS,
      Item: notification,
    })
  );
}

export async function getNotifications(
  recipientId: string,
  limit = 20
): Promise<UserNotification[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.USER_NOTIFICATIONS,
      KeyConditionExpression: "recipientId = :rid",
      ExpressionAttributeValues: { ":rid": recipientId },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items as UserNotification[]) ?? [];
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.USER_NOTIFICATIONS,
      KeyConditionExpression: "recipientId = :rid",
      FilterExpression: "#r = :false",
      ExpressionAttributeNames: { "#r": "read" },
      ExpressionAttributeValues: {
        ":rid": recipientId,
        ":false": false,
      },
      Select: "COUNT",
    })
  );
  return result.Count ?? 0;
}

export async function markAsRead(
  recipientId: string,
  createdAt: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.USER_NOTIFICATIONS,
      Key: { recipientId, createdAt },
      UpdateExpression: "SET #r = :true",
      ExpressionAttributeNames: { "#r": "read" },
      ExpressionAttributeValues: { ":true": true },
    })
  );
}

export async function markAllAsRead(recipientId: string): Promise<void> {
  const unread = await docClient.send(
    new QueryCommand({
      TableName: TABLES.USER_NOTIFICATIONS,
      KeyConditionExpression: "recipientId = :rid",
      FilterExpression: "#r = :false",
      ExpressionAttributeNames: { "#r": "read" },
      ExpressionAttributeValues: {
        ":rid": recipientId,
        ":false": false,
      },
    })
  );

  const items = unread.Items ?? [];
  for (const item of items) {
    await markAsRead(recipientId, item.createdAt as string);
  }
}
