import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ChatSession, AIChatMessage } from "@/lib/types/chat";

export async function getChatSession(
  sessionId: string
): Promise<ChatSession | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.CHAT_SESSIONS,
      Key: { SessionID: sessionId },
    })
  );
  return (result.Item as ChatSession) ?? null;
}

export async function getChatSessionsByEmployee(
  employeeId: string
): Promise<ChatSession[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.CHAT_SESSIONS,
      IndexName: INDEXES.CHAT_SESSIONS_BY_EMPLOYEE,
      KeyConditionExpression: "EmployeeID = :eid",
      ExpressionAttributeValues: { ":eid": employeeId },
      ScanIndexForward: false,
    })
  );
  return (result.Items as ChatSession[]) ?? [];
}

export async function createChatSession(session: ChatSession): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.CHAT_SESSIONS,
      Item: session,
      ConditionExpression: "attribute_not_exists(SessionID)",
    })
  );
}

export async function updateChatSessionMessages(
  sessionId: string,
  messages: AIChatMessage[],
  title: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.CHAT_SESSIONS,
      Key: { SessionID: sessionId },
      UpdateExpression:
        "SET Messages = :msgs, Title = :title, UpdatedAt = :now",
      ExpressionAttributeValues: {
        ":msgs": messages,
        ":title": title,
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.CHAT_SESSIONS,
      Key: { SessionID: sessionId },
    })
  );
}
