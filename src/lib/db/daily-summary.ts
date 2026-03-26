/**
 * Daily summary DB operations.
 * Ported from asistencia-record-event.py (apply_event_to_daily + recalc_day)
 */

import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DailySummary } from "@/lib/types";

const key = (employeeId: string, workDate: string) => ({
  EmployeeID: employeeId,
  WorkDate: `DATE#${workDate}`,
});

export async function getDailySummary(
  employeeId: string,
  workDate: string
): Promise<DailySummary | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: key(employeeId, workDate),
    })
  );
  return (result.Item as DailySummary) ?? null;
}

export async function getDailySummaryRange(
  employeeId: string,
  dateFrom: string,
  dateTo: string
): Promise<DailySummary[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.DAILY_SUMMARY,
      KeyConditionExpression:
        "EmployeeID = :eid AND WorkDate BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":eid": employeeId,
        ":from": `DATE#${dateFrom}`,
        ":to": `DATE#${dateTo}`,
      },
    })
  );
  return (result.Items as DailySummary[]) ?? [];
}

/** Get all summaries for a date across all employees (admin) */
export async function getDailySummariesByDate(
  workDate: string,
  tenantId?: string
): Promise<DailySummary[]> {
  // If tenantId provided, use Tenant-WorkDate-index (efficient, tenant-scoped)
  if (tenantId) {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.DAILY_SUMMARY,
        IndexName: INDEXES.DAILY_BY_TENANT,
        KeyConditionExpression: "TenantID = :tid AND WorkDate = :wd",
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":wd": `DATE#${workDate}`,
        },
      })
    );
    return (result.Items as DailySummary[]) ?? [];
  }

  // Fallback: use date-only GSI
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.DAILY_SUMMARY,
      IndexName: INDEXES.DAILY_BY_DATE,
      KeyConditionExpression: "WorkDate = :wd",
      ExpressionAttributeValues: {
        ":wd": `DATE#${workDate}`,
      },
    })
  );
  return (result.Items as DailySummary[]) ?? [];
}

/**
 * Apply START event to daily summary.
 * Uses ConditionExpression to prevent double-start.
 */
export async function applyStart(
  employeeId: string,
  workDate: string,
  tsUtc: string,
  tsLocal: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: key(employeeId, workDate),
      UpdateExpression: `
        SET firstInUtc = :utc,
            firstInLocal = :local,
            #st = :open,
            #src = :src,
            updatedAt = :utc,
            updatedAtLocal = :local,
            eventsCount = if_not_exists(eventsCount, :zero) + :one
      `,
      ConditionExpression: "attribute_not_exists(firstInUtc)",
      ExpressionAttributeNames: { "#st": "status", "#src": "source" },
      ExpressionAttributeValues: {
        ":utc": tsUtc,
        ":local": tsLocal,
        ":open": "OPEN",
        ":src": "REALTIME",
        ":zero": 0,
        ":one": 1,
      },
    })
  );
}

/**
 * Apply BREAK_START — only if shift is open, no existing break, and not ended.
 */
export async function applyBreakStart(
  employeeId: string,
  workDate: string,
  tsUtc: string,
  tsLocal: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: key(employeeId, workDate),
      UpdateExpression: `
        SET breakStartUtc = :utc,
            breakStartLocal = :local,
            updatedAt = :utc,
            updatedAtLocal = :local,
            eventsCount = if_not_exists(eventsCount, :zero) + :one
      `,
      ConditionExpression: `
        attribute_exists(firstInUtc)
        AND attribute_not_exists(lastOutUtc)
        AND attribute_not_exists(breakStartUtc)
      `,
      ExpressionAttributeValues: {
        ":utc": tsUtc,
        ":local": tsLocal,
        ":zero": 0,
        ":one": 1,
      },
    })
  );
}

/**
 * Apply BREAK_END — calculates break minutes and clears breakStart fields.
 */
export async function applyBreakEnd(
  employeeId: string,
  workDate: string,
  tsUtc: string,
  tsLocal: string
): Promise<void> {
  // First read current to get breakStartUtc
  const current = await getDailySummary(employeeId, workDate);
  if (!current?.breakStartUtc) {
    throw new Error("No hay BREAK_START abierto");
  }

  const breakStartMs = new Date(current.breakStartUtc).getTime();
  const breakEndMs = new Date(tsUtc).getTime();
  const mins = Math.max(0, Math.floor((breakEndMs - breakStartMs) / 60000));

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: key(employeeId, workDate),
      UpdateExpression: `
        REMOVE breakStartUtc, breakStartLocal
        SET breakMinutes = if_not_exists(breakMinutes, :zero) + :mins,
            updatedAt = :utc,
            updatedAtLocal = :local,
            eventsCount = if_not_exists(eventsCount, :zero) + :one
      `,
      ConditionExpression: `
        attribute_exists(firstInUtc)
        AND attribute_exists(breakStartUtc)
        AND attribute_not_exists(lastOutUtc)
      `,
      ExpressionAttributeValues: {
        ":mins": mins,
        ":utc": tsUtc,
        ":local": tsLocal,
        ":zero": 0,
        ":one": 1,
      },
    })
  );
}

/**
 * Apply END event — close the shift.
 */
export async function applyEnd(
  employeeId: string,
  workDate: string,
  tsUtc: string,
  tsLocal: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: key(employeeId, workDate),
      UpdateExpression: `
        SET lastOutUtc = :utc,
            lastOutLocal = :local,
            #st = :closed,
            updatedAt = :utc,
            updatedAtLocal = :local,
            eventsCount = if_not_exists(eventsCount, :zero) + :one
      `,
      ConditionExpression: `
        attribute_exists(firstInUtc)
        AND attribute_not_exists(lastOutUtc)
      `,
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: {
        ":utc": tsUtc,
        ":local": tsLocal,
        ":closed": "CLOSED",
        ":zero": 0,
        ":one": 1,
      },
    })
  );
}

/**
 * Recalculate workedMinutes, plannedMinutes, deltaMinutes, status
 * for a given employee/date. Ported from recalc_day in Python.
 */
export async function recalcDay(
  employeeId: string,
  workDate: string
): Promise<void> {
  const current = await getDailySummary(employeeId, workDate);
  if (!current) return;

  const firstIn = current.firstInUtc;
  const lastOut = current.lastOutUtc;
  const breakMinutes = Number(current.breakMinutes ?? 0);
  const anomalies: string[] = [];

  let worked = 0;
  if (firstIn && lastOut) {
    const total = Math.floor(
      (new Date(lastOut).getTime() - new Date(firstIn).getTime()) / 60000
    );
    worked = Math.max(0, total - breakMinutes);
  } else if (firstIn && !lastOut) {
    anomalies.push("Jornada abierta");
  } else if (!firstIn && lastOut) {
    anomalies.push("END sin START");
  } else {
    anomalies.push("Sin marcación completa");
  }

  const planned = 480;
  const delta = worked - planned;

  let finalStatus: string;
  if (current.status === "OPEN" && !lastOut) {
    finalStatus = "OPEN";
  } else if (worked >= planned && lastOut) {
    finalStatus = "OK";
  } else if (lastOut) {
    finalStatus = "SHORT";
  } else {
    finalStatus = "OPEN";
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: key(employeeId, workDate),
      UpdateExpression: `
        SET workedMinutes = :worked,
            plannedMinutes = :planned,
            deltaMinutes = :delta,
            anomalies = :anomalies,
            #st = :status,
            #src = :src,
            updatedAt = :utc
      `,
      ExpressionAttributeNames: { "#st": "status", "#src": "source" },
      ExpressionAttributeValues: {
        ":worked": worked,
        ":planned": planned,
        ":delta": delta,
        ":anomalies": anomalies,
        ":status": finalStatus,
        ":src": "REALTIME",
        ":utc": new Date().toISOString(),
      },
    })
  );
}

/** Put a full daily summary item (used by regularization) */
export async function putDailySummary(item: Record<string, unknown>): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Item: item,
    })
  );
}

/** Upsert a daily summary (regularization mode) */
export async function upsertDailySummary(
  item: Record<string, unknown>,
  overwrite: boolean
): Promise<"CREATED" | "OVERWRITTEN" | "SKIPPED"> {
  const existing = await docClient.send(
    new GetCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: {
        EmployeeID: item.EmployeeID as string,
        WorkDate: item.WorkDate as string,
      },
    })
  );

  if (existing.Item && !overwrite) {
    return "SKIPPED";
  }

  await putDailySummary(item);
  return existing.Item ? "OVERWRITTEN" : "CREATED";
}
