import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ChatChannel } from "@/lib/types/channel";

export async function getChannelById(
  channelId: string
): Promise<ChatChannel | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.CHAT_CHANNELS,
      Key: { ChannelID: channelId },
    })
  );
  return (result.Item as ChatChannel) ?? null;
}

export async function getChannelsByTenant(
  tenantId: string
): Promise<ChatChannel[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.CHAT_CHANNELS,
      IndexName: INDEXES.CHAT_CHANNELS_BY_TENANT,
      KeyConditionExpression: "TenantID = :tid",
      ExpressionAttributeValues: { ":tid": tenantId },
      ScanIndexForward: false,
    })
  );
  return (result.Items as ChatChannel[]) ?? [];
}

export async function getChannelsByMember(
  tenantId: string,
  employeeId: string
): Promise<ChatChannel[]> {
  const channels = await getChannelsByTenant(tenantId);
  return channels.filter((ch) => ch.Members.includes(employeeId));
}

export async function createChannel(channel: ChatChannel): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.CHAT_CHANNELS,
      Item: channel,
      ConditionExpression: "attribute_not_exists(ChannelID)",
    })
  );
}

export async function updateChannelLastMessage(
  channelId: string,
  content: string,
  senderName: string
): Promise<void> {
  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.CHAT_CHANNELS,
      Key: { ChannelID: channelId },
      UpdateExpression:
        "SET LastMessage = :msg, LastMessageBy = :by, LastMessageAt = :at, UpdatedAt = :now",
      ExpressionAttributeValues: {
        ":msg": content.slice(0, 100),
        ":by": senderName,
        ":at": now,
        ":now": now,
      },
    })
  );
}

export async function addMemberToChannel(
  channelId: string,
  employeeId: string,
  name: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.CHAT_CHANNELS,
      Key: { ChannelID: channelId },
      UpdateExpression:
        "SET MemberNames.#eid = :name, UpdatedAt = :now ADD Members :memberSet",
      ExpressionAttributeNames: { "#eid": employeeId },
      ExpressionAttributeValues: {
        ":name": name,
        ":now": new Date().toISOString(),
        ":memberSet": new Set([employeeId]),
      },
    })
  );
}

export async function deleteChannel(channelId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.CHAT_CHANNELS,
      Key: { ChannelID: channelId },
    })
  );
}
