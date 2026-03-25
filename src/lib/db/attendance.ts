/**
 * Attendance events DB operations.
 * Ported from asistencia-record-event.py
 */

import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { AttendanceEvent } from "@/lib/types";

export async function putAttendanceEvent(event: AttendanceEvent): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.ATTENDANCE_EVENTS,
      Item: event,
    })
  );
}

/** Get all events for an employee on a specific work date */
export async function getEventsByEmployeeAndDate(
  employeeId: string,
  workDate: string
): Promise<AttendanceEvent[]> {
  const start = `TS#${workDate}T00:00:00+00:00`;
  const end = `TS#${workDate}T23:59:59.999999+00:00`;

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.ATTENDANCE_EVENTS,
      KeyConditionExpression:
        "EmployeeID = :eid AND EventTS BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":eid": employeeId,
        ":start": start,
        ":end": end,
      },
    })
  );

  const items = (result.Items as AttendanceEvent[]) ?? [];
  items.sort((a, b) => a.serverTimeUtc.localeCompare(b.serverTimeUtc));
  return items;
}

/** Get all events for a date across all employees (admin view) */
export async function getEventsByDate(
  workDate: string
): Promise<AttendanceEvent[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.ATTENDANCE_EVENTS,
      IndexName: INDEXES.EVENTS_BY_DATE,
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `DATE#${workDate}`,
      },
    })
  );
  return (result.Items as AttendanceEvent[]) ?? [];
}
