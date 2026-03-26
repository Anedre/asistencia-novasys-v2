import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getDailySummariesByDate } from "@/lib/db/daily-summary";
import { workDateLima } from "@/lib/utils/time";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || workDateLima();

  const summaries = await getDailySummariesByDate(date, user.tenantId);

  const list = summaries.map((s) => ({
    employeeId: s.EmployeeID,
    workDate: s.WorkDate.replace("DATE#", ""),
    firstInLocal: s.firstInLocal,
    lastOutLocal: s.lastOutLocal,
    breakMinutes: Number(s.breakMinutes ?? 0),
    workedMinutes: Number(s.workedMinutes ?? 0),
    status: s.status,
    anomalies: s.anomalies ?? [],
    hasOpenBreak: !!s.breakStartUtc,
    hasOpenShift: !!s.firstInUtc && !s.lastOutUtc,
  }));

  return NextResponse.json({ ok: true, date, summaries: list });
});
