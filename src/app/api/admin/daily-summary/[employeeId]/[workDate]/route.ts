/**
 * Admin-only editor for a single DailySummary row.
 *
 * GET     → read current state (or null if no record exists)
 * PATCH   → partial update of editable fields (times, status, break, reason)
 * DELETE  → hard-delete the row (so the day goes back to NO_RECORD / MISSING)
 *
 * All PATCH and DELETE operations are wrapped with withAudit so they're
 * recoverable via the /admin/audit page.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  getDailySummary,
  putDailySummary,
  deleteDailySummary,
} from "@/lib/db/daily-summary";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";
import { withAudit } from "@/lib/services/audit.service";

// Fields an admin may modify with PATCH. Anything not on this list is ignored.
const EDITABLE_FIELDS = new Set([
  "firstIn",
  "firstInLocal",
  "lastOut",
  "lastOutLocal",
  "breakMinutes",
  "workedMinutes",
  "plannedMinutes",
  "deltaMinutes",
  "status",
  "source",
  "regularizationReasonCode",
  "regularizationReasonLabel",
  "regularizationNote",
  "anomalies",
]);

interface RouteContext {
  params: Promise<{ employeeId: string; workDate: string }>;
}

async function resolveParams(context: unknown) {
  const { employeeId, workDate } = await (context as RouteContext).params;
  return {
    employeeId: decodeURIComponent(employeeId),
    workDate: decodeURIComponent(workDate).replace(/^DATE#/, ""),
  };
}

export const GET = withErrorHandler(async (_req: Request, context: unknown) => {
  await requireAdmin();
  const { employeeId, workDate } = await resolveParams(context);
  const summary = await getDailySummary(employeeId, workDate);
  return NextResponse.json({ ok: true, summary });
});

export const PATCH = withErrorHandler(async (req: Request, context: unknown) => {
  const admin = await requireAdmin();
  const { employeeId, workDate } = await resolveParams(context);
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await getDailySummary(employeeId, workDate);
  if (!existing) {
    throw new ValidationError(
      "No existe registro para este empleado en esta fecha. Usa regularización para crear uno."
    );
  }

  // Merge the patch on top of the existing record, restricted to editable fields.
  const updated: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(body)) {
    if (EDITABLE_FIELDS.has(k)) updated[k] = v;
  }
  updated.updatedAt = new Date().toISOString();
  updated.source = "MANUAL_EDIT";

  await withAudit(
    {
      actor: admin,
      entityType: "DAILY_SUMMARY",
      entityKey: {
        EmployeeID: employeeId,
        WorkDate: `DATE#${workDate}`,
      },
      action: "UPDATE",
      reason:
        typeof body.reason === "string" && body.reason
          ? body.reason
          : "Edición manual desde editor de asistencia",
    },
    async () => putDailySummary(updated)
  );

  return NextResponse.json({ ok: true, summary: updated });
});

export const DELETE = withErrorHandler(async (_req: Request, context: unknown) => {
  const admin = await requireAdmin();
  const { employeeId, workDate } = await resolveParams(context);

  const existing = await getDailySummary(employeeId, workDate);
  if (!existing) {
    // Idempotent: if there's nothing to delete, succeed silently.
    return NextResponse.json({ ok: true, deleted: false });
  }

  await withAudit(
    {
      actor: admin,
      entityType: "DAILY_SUMMARY",
      entityKey: {
        EmployeeID: employeeId,
        WorkDate: `DATE#${workDate}`,
      },
      action: "DELETE",
      reason: "Limpieza de registro erróneo",
    },
    async () => deleteDailySummary(employeeId, workDate)
  );

  return NextResponse.json({ ok: true, deleted: true });
});
