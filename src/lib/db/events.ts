import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { AppEvent } from "@/lib/types/event";

export async function getEventById(eventId: string): Promise<AppEvent | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.EVENTS, Key: { EventID: eventId } })
  );
  return (result.Item as AppEvent) ?? null;
}

export async function getEventsByTenant(tenantId: string, limit = 50): Promise<AppEvent[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EVENTS,
      IndexName: INDEXES.EVENTS_BY_TENANT_DATE,
      KeyConditionExpression: "TenantID = :tid",
      ExpressionAttributeValues: { ":tid": tenantId },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items as AppEvent[]) ?? [];
}

export async function getUpcomingEvents(tenantId: string, fromDate: string): Promise<AppEvent[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EVENTS,
      IndexName: INDEXES.EVENTS_BY_TENANT_DATE,
      KeyConditionExpression: "TenantID = :tid AND StartDate >= :from",
      ExpressionAttributeValues: { ":tid": tenantId, ":from": fromDate },
      Limit: 20,
    })
  );
  return (result.Items as AppEvent[]) ?? [];
}

export async function createEvent(event: AppEvent): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.EVENTS,
      Item: event,
      ConditionExpression: "attribute_not_exists(EventID)",
    })
  );
}

export async function updateEvent(eventId: string, updates: Partial<Pick<AppEvent, "Title" | "Description" | "StartDate" | "EndDate" | "Location" | "Type" | "Visibility" | "TargetArea" | "Status">>): Promise<void> {
  const expressions: string[] = ["UpdatedAt = :now"];
  const values: Record<string, unknown> = { ":now": new Date().toISOString() };

  const fieldMap: Record<string, string> = {
    Title: "Title", Description: "Description", StartDate: "StartDate",
    EndDate: "EndDate", Location: "Location", Type: "Type",
    Visibility: "Visibility", TargetArea: "TargetArea", Status: "Status",
  };

  for (const [key, attr] of Object.entries(fieldMap)) {
    if ((updates as Record<string, unknown>)[key] !== undefined) {
      expressions.push(`${attr} = :${key.toLowerCase()}`);
      values[`:${key.toLowerCase()}`] = (updates as Record<string, unknown>)[key];
    }
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.EVENTS,
      Key: { EventID: eventId },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeValues: values,
    })
  );
}

export async function updateEventRSVP(eventId: string, employeeId: string, status: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.EVENTS,
      Key: { EventID: eventId },
      UpdateExpression: "SET RSVPs.#eid = :status, UpdatedAt = :now",
      ExpressionAttributeNames: { "#eid": employeeId },
      ExpressionAttributeValues: { ":status": status, ":now": new Date().toISOString() },
    })
  );
}

export async function deleteEvent(eventId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName: TABLES.EVENTS, Key: { EventID: eventId } })
  );
}
