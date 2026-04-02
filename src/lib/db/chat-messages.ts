import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ChatMessage } from "@/lib/types/channel";

export async function getMessagesByChannel(
  channelId: string,
  limit = 100
): Promise<ChatMessage[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.CHAT_MESSAGES,
      IndexName: INDEXES.CHAT_MESSAGES_BY_CHANNEL,
      KeyConditionExpression: "ChannelID = :cid",
      ExpressionAttributeValues: { ":cid": channelId },
      ScanIndexForward: true,
      Limit: limit,
    })
  );
  return (result.Items as ChatMessage[]) ?? [];
}

export async function getMessageById(
  messageId: string
): Promise<ChatMessage | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.CHAT_MESSAGES,
      Key: { MessageID: messageId },
    })
  );
  return (result.Item as ChatMessage) ?? null;
}

export async function createMessage(message: ChatMessage): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.CHAT_MESSAGES,
      Item: message,
    })
  );
}

/** Toggle a reaction on a message */
export async function toggleReaction(
  messageId: string,
  emoji: string,
  userId: string,
  userName: string
): Promise<void> {
  const msg = await getMessageById(messageId);
  if (!msg) return;

  const reactions = msg.Reactions ?? {};
  const existing = reactions[emoji] ?? { userIds: [], userNames: [] };

  const idx = existing.userIds.indexOf(userId);
  if (idx >= 0) {
    // Remove reaction
    existing.userIds.splice(idx, 1);
    existing.userNames.splice(idx, 1);
  } else {
    // Add reaction
    existing.userIds.push(userId);
    existing.userNames.push(userName);
  }

  if (existing.userIds.length === 0) {
    delete reactions[emoji];
  } else {
    reactions[emoji] = existing;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.CHAT_MESSAGES,
      Key: { MessageID: messageId },
      UpdateExpression: "SET Reactions = :r",
      ExpressionAttributeValues: { ":r": Object.keys(reactions).length > 0 ? reactions : null },
    })
  );
}

export async function deleteMessagesByChannel(
  channelId: string
): Promise<void> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.CHAT_MESSAGES,
      IndexName: INDEXES.CHAT_MESSAGES_BY_CHANNEL,
      KeyConditionExpression: "ChannelID = :cid",
      ExpressionAttributeValues: { ":cid": channelId },
      ProjectionExpression: "MessageID",
    })
  );

  const items = result.Items ?? [];
  if (items.length === 0) return;

  const chunks: { MessageID: string }[][] = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25) as { MessageID: string }[]);
  }

  for (const chunk of chunks) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLES.CHAT_MESSAGES]: chunk.map((item) => ({
            DeleteRequest: {
              Key: { MessageID: item.MessageID },
            },
          })),
        },
      })
    );
  }
}
