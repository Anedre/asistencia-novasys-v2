/**
 * List DailySummary rows for one employee over a date range.
 * Used by the attendance editor to show a calendar-like view where the admin
 * picks a specific day to edit or clean.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getDailySummaryRange } from "@/lib/db/daily-summary";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";

interface RouteContext {
  params: Promise<{ employeeId: string }>;
}

export const GET = withErrorHandler(async (req: Request, context: unknown) => {
  await requireAdmin();
  const { employeeId: raw } = await (context as RouteContext).params;
  const employeeId = decodeURIComponent(raw);

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    throw new ValidationError("Los parámetros 'from' y 'to' son obligatorios (YYYY-MM-DD)");
  }

  const items = await getDailySummaryRange(employeeId, from, to);
  return NextResponse.json({
    ok: true,
    items: items.map((s) => ({
      workDate: (s.WorkDate as string).replace(/^DATE#/, ""),
      firstInLocal: s.firstInLocal ?? null,
      lastOutLocal: s.lastOutLocal ?? null,
      breakMinutes: s.breakMinutes ?? 0,
      workedMinutes: s.workedMinutes ?? 0,
      plannedMinutes: s.plannedMinutes ?? 0,
      deltaMinutes: s.deltaMinutes ?? 0,
      status: s.status ?? null,
      source: s.source ?? null,
      regularizationReasonCode: s.regularizationReasonCode ?? null,
      updatedAt: s.updatedAt ?? null,
    })),
  });
});
