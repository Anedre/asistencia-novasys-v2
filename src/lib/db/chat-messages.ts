import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  PutCommand,
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

export async function createMessage(message: ChatMessage): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.CHAT_MESSAGES,
      Item: message,
    })
  );
}

export async function deleteMessagesByChannel(
  channelId: string
): Promise<void> {
  // First query all message IDs for this channel
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

  // BatchWrite in chunks of 25
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
