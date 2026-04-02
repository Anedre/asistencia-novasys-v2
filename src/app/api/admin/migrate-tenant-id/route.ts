/**
 * One-time migration: backfill TenantID on DailySummary records that are missing it.
 *
 * GET  → dry-run (shows how many records would be updated)
 * POST → execute the migration
 *
 * Safe to run multiple times — only updates records where TenantID is missing.
 * DELETE this route after migration is complete.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { docClient } from "@/lib/db/client";
import { TABLES, INDEXES } from "@/lib/db/tables";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getAllActiveEmployees } from "@/lib/db/employees";

async function runMigration(tenantId: string, dryRun: boolean) {
  // 1) Get all active employees for this tenant to know their IDs
  const employees = await getAllActiveEmployees(tenantId);
  const employeeIds = new Set(employees.map((e) => e.EmployeeID));

  // 2) Scan DailySummary for records missing TenantID
  //    We scan because these records aren't indexed by tenant (that's the bug)
  const missing: Array<{ EmployeeID: string; WorkDate: string }> = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.DAILY_SUMMARY,
        FilterExpression: "attribute_not_exists(TenantID)",
        ProjectionExpression: "EmployeeID, WorkDate",
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      })
    );

    for (const item of result.Items ?? []) {
      // Only fix records belonging to this tenant's employees
      if (employeeIds.has(item.EmployeeID as string)) {
        missing.push({
          EmployeeID: item.EmployeeID as string,
          WorkDate: item.WorkDate as string,
        });
      }
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  if (dryRun) {
    return { dryRun: true, recordsToFix: missing.length, tenantId };
  }

  // 3) Update each record with TenantID
  let updated = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const record of missing) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.DAILY_SUMMARY,
          Key: {
            EmployeeID: record.EmployeeID,
            WorkDate: record.WorkDate,
          },
          UpdateExpression: "SET TenantID = :tid",
          ConditionExpression: "attribute_not_exists(TenantID)",
          ExpressionAttributeValues: { ":tid": tenantId },
        })
      );
      updated++;
    } catch (err: unknown) {
      // ConditionalCheckFailed means someone else already set it — safe to skip
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
        continue;
      }
      errors++;
      errorDetails.push(`${record.EmployeeID}/${record.WorkDate}: ${err}`);
    }
  }

  return {
    dryRun: false,
    totalScanned: missing.length,
    updated,
    errors,
    ...(errorDetails.length > 0 && { errorDetails: errorDetails.slice(0, 10) }),
    tenantId,
  };
}

/** GET = dry run */
export const GET = withErrorHandler(async () => {
  const user = await requireAdmin();
  const result = await runMigration(user.tenantId, true);
  return NextResponse.json({ ok: true, ...result });
});

/** POST = execute migration */
export const POST = withErrorHandler(async () => {
  const user = await requireAdmin();
  const result = await runMigration(user.tenantId, false);
  return NextResponse.json({ ok: true, ...result });
});
