import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getDailySummariesByDate } from "@/lib/db/daily-summary";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { workDateLima } from "@/lib/utils/time";
import { withErrorHandler } from "@/lib/utils/errors";
import { getTenantPlannedMinutes } from "@/lib/utils/holidays";

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || workDateLima();

  const [summaries, employees, tenantPlanned] = await Promise.all([
    getDailySummariesByDate(date, user.tenantId),
    getAllActiveEmployees(user.tenantId),
    getTenantPlannedMinutes(user.tenantId),
  ]);

  // Build employee lookup
  const empMap = new Map<string, (typeof employees)[0]>();
  for (const e of employees) empMap.set(e.EmployeeID, e);

  // Track which employees have summaries
  const hasRecord = new Set<string>();

  // Totals
  const totals = { total: employees.length, present: 0, absent: 0, onBreak: 0, complete: 0, short: 0, anomalies: 0 };

  const list = summaries.map((s) => {
    hasRecord.add(s.EmployeeID);
    const emp = empMap.get(s.EmployeeID);
    const worked = Number(s.workedMinutes ?? 0);
    const planned = Number(s.plannedMinutes ?? tenantPlanned);
    const delta = Number(s.deltaMinutes ?? worked - planned);
    const hasIn = !!s.firstInUtc;
    const hasOut = !!s.lastOutUtc;
    const hasBreak = !!s.breakStartUtc;

    // Count totals
    if (hasIn) totals.present++;
    if (hasBreak && !hasOut) totals.onBreak++;
    if (s.status === "OK") totals.complete++;
    if (s.status === "SHORT") totals.short++;
    if (s.anomalies && s.anomalies.length > 0) totals.anomalies++;

    return {
      employeeId: s.EmployeeID,
      workDate: s.WorkDate.replace("DATE#", ""),
      fullName: emp?.FullName ?? s.EmployeeID,
      area: emp?.Area ?? "",
      position: emp?.Position ?? "",
      avatarUrl: emp?.AvatarUrl ?? null,
      firstInLocal: s.firstInLocal ?? null,
      lastOutLocal: s.lastOutLocal ?? null,
      breakStartLocal: s.breakStartLocal ?? null,
      breakMinutes: Number(s.breakMinutes ?? 0),
      workedMinutes: worked,
      plannedMinutes: planned,
      deltaMinutes: delta,
      status: s.status,
      source: s.source ?? "WEB",
      anomalies: s.anomalies ?? [],
      hasOpenBreak: hasBreak && !hasOut,
      hasOpenShift: hasIn && !hasOut,
      eventsCount: Number(s.eventsCount ?? 0),
    };
  });

  // Add absent employees (no record)
  for (const emp of employees) {
    if (!hasRecord.has(emp.EmployeeID)) {
      list.push({
        employeeId: emp.EmployeeID,
        workDate: date,
        fullName: emp.FullName,
        area: emp.Area ?? "",
        position: emp.Position ?? "",
        avatarUrl: emp.AvatarUrl ?? null,
        firstInLocal: null,
        lastOutLocal: null,
        breakStartLocal: null,
        breakMinutes: 0,
        workedMinutes: 0,
        plannedMinutes: tenantPlanned,
        deltaMinutes: -tenantPlanned,
        status: "MISSING",
        source: "SYSTEM" as const,
        anomalies: [],
        hasOpenBreak: false,
        hasOpenShift: false,
        eventsCount: 0,
      });
    }
  }

  totals.absent = totals.total - totals.present;

  // Distinct areas for filter
  const areas = [...new Set(employees.map((e) => e.Area).filter(Boolean))].sort();

  return NextResponse.json({ ok: true, date, totals, areas, summaries: list });
});
