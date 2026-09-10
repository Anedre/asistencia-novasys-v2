/**
 * Aggregation logic for the admin Reports dashboard.
 *
 * Queries DailySummary over a date range (per tenant) and produces the
 * chart/table-ready datasets the reports page and the exports are built from:
 *   1. monthlyTrend       — one row per month in range
 *   2. yearlyTrend        — the same rolled up per year ("reportes por año")
 *   3. employeeRanking    — one row per employee, full metric set
 *   4. employeeMonthly    — employee × month matrix ("varios meses, varios usuarios")
 *   5. areaBreakdown      — one row per area ("reporte por tipo de área")
 *   6. statusDistribution — count of days per status
 *   7. entryHeatmap       — 7x24 grid: how often people check in on each
 *                           (dayOfWeek, hour) slot
 *
 * One round-trip to Dynamo (with pagination) via the Tenant-WorkDate GSI, plus
 * the active roster — the whole page and every export variant are served from
 * this single call.
 */

import { docClient } from "@/lib/db/client";
import { TABLES, INDEXES } from "@/lib/db/tables";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { areaKey, buildAreaCanon } from "@/lib/utils/area";
import {
  addMetrics,
  deltaHours,
  emptyMetrics,
  type ReportMetrics,
} from "@/lib/constants/report-fields";

export interface MonthlyTrendPoint extends ReportMetrics {
  month: string; // "YYYY-MM"
  /** Distinct employees with at least one record that month. */
  employees: number;
}

export interface YearlyTrendPoint extends ReportMetrics {
  year: string; // "YYYY"
  employees: number;
  /** Months of that year that actually carry records. */
  monthsWithData: number;
}

export interface EmployeeRankingEntry extends ReportMetrics {
  employeeId: string;
  employeeName: string;
  area: string;
  position: string;
  dni: string;
  email: string;
  /** Worked minus planned. Stored (not derived) so table sorts stay cheap. */
  deltaHours: number;
}

export interface AreaBreakdownEntry extends ReportMetrics {
  /** Canonical (accented) label for display. */
  area: string;
  /** Accent/case-insensitive key — stable id for filters and React keys. */
  areaId: string;
  /** People assigned to the area, whether or not they have records. */
  headcount: number;
  /** Of those, how many have at least one record in the period. */
  withRecords: number;
  deltaHours: number;
}

export interface EmployeeMonthlyRow {
  employeeId: string;
  employeeName: string;
  area: string;
  /** Keyed by "YYYY-MM". Months with no records are absent. */
  byMonth: Record<string, ReportMetrics>;
  /** Row total across the whole period. */
  total: ReportMetrics;
}

export interface StatusDistribution {
  [status: string]: number;
}

export interface ReportsTotals extends ReportMetrics {
  /** Distinct employees with at least one record in the period. */
  employees: number;
  /** People included in the report, records or not. */
  rosterSize: number;
}

export interface ReportsStats {
  range: { from: string; to: string };
  /** Ordered "YYYY-MM" list covering the period — the matrix column headers. */
  months: string[];
  /** Filters that produced this payload, echoed back for headers and filenames. */
  filters: {
    areas: string[];
    employeeIds: string[];
    months: string[];
  };
  totals: ReportsTotals;
  monthlyTrend: MonthlyTrendPoint[];
  yearlyTrend: YearlyTrendPoint[];
  employeeRanking: EmployeeRankingEntry[];
  employeeMonthly: EmployeeMonthlyRow[];
  areaBreakdown: AreaBreakdownEntry[];
  statusDistribution: StatusDistribution;
  /** entryHeatmap[dayOfWeek 0-6 Mon..Sun][hour 0-23] = number of check-ins */
  entryHeatmap: number[][];
  /** Every area label in the tenant, for the filter chips. */
  availableAreas: { id: string; label: string; headcount: number }[];
}

export interface ReportsStatsQuery {
  from: string;
  to: string;
  /**
   * Explicit "YYYY-MM" subset. The boss picks e.g. January, February and May,
   * so a plain from→to range is not enough: anything outside these months is
   * dropped even though it sits inside the range.
   */
  months?: string[];
  /** Area labels (any spelling — matched accent-insensitively). */
  areas?: string[];
  /** Hand-picked employees. Absent means everyone. */
  employeeIds?: string[];
}

interface RawRow {
  EmployeeID: string;
  WorkDate: string;
  workedMinutes?: number;
  plannedMinutes?: number;
  breakMinutes?: number;
  lateMinutes?: number;
  status?: string;
  source?: string;
  firstInLocal?: string;
  TenantID?: string;
}

async function queryRange(
  tenantId: string,
  fromDate: string,
  toDate: string
): Promise<RawRow[]> {
  const items: RawRow[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.DAILY_SUMMARY,
        IndexName: INDEXES.DAILY_BY_TENANT,
        KeyConditionExpression:
          "TenantID = :tid AND WorkDate BETWEEN :from AND :to",
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":from": `DATE#${fromDate}`,
          ":to": `DATE#${toDate}`,
        },
        ExclusiveStartKey: lastKey,
      })
    );
    items.push(...((result.Items as RawRow[]) ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

function parseYmd(workDate: string): string {
  return workDate.replace(/^DATE#/, "");
}

function parseMonth(workDate: string): string {
  // "DATE#2026-04-01" → "2026-04"
  return parseYmd(workDate).slice(0, 7);
}

/** Monday = 0 ... Sunday = 6 for the heatmap rows. */
function dayOfWeekMondayFirst(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (date.getDay() + 6) % 7;
}

/** Every "YYYY-MM" from `from` to `to`, inclusive. */
export function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  // Guard against a reversed or malformed range producing an endless loop.
  let guard = 0;
  while ((y < endY || (y === endY && m <= endM)) && guard++ < 600) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** A day counts as regularized whether it says so in `status` or in `source`. */
function isRegularized(r: RawRow): boolean {
  return (
    r.status === "REGULARIZED" ||
    r.source === "REGULARIZATION" ||
    r.source === "REGULARIZATION_RANGE"
  );
}

/** Fold one DailySummary row into an accumulator. */
function applyRow(m: ReportMetrics, r: RawRow): void {
  const worked = Number(r.workedMinutes ?? 0);
  const planned = Number(r.plannedMinutes ?? 0);
  const brk = Number(r.breakMinutes ?? 0);
  const late = Number(r.lateMinutes ?? 0);
  const status = r.status ?? "NO_RECORD";

  m.daysRecorded += 1;
  m.workedHours += worked / 60;
  m.plannedHours += planned / 60;
  m.breakHours += brk / 60;
  m.lateHours += late / 60;
  if (worked > 0) m.daysPresent += 1;
  if (late > 0) m.lateDays += 1;
  if (status === "OPEN") m.openDays += 1;
  if (status === "ABSENCE" || status === "MISSING") m.absences += 1;
  if (isRegularized(r)) m.regularizations += 1;
}

export async function getReportsStats(
  tenantId: string,
  query: ReportsStatsQuery
): Promise<ReportsStats> {
  const { from: fromDate, to: toDate } = query;

  // Parallelize employees lookup and dynamo range query.
  const [employees, rows] = await Promise.all([
    getAllActiveEmployees(tenantId),
    queryRange(tenantId, fromDate, toDate),
  ]);

  // Canonical area labels across the whole roster, so "Consultoria" and
  // "Consultoría" collapse into one area everywhere in the report.
  const canon = buildAreaCanon(employees.map((e) => e.Area));
  const canonLabel = (raw?: string | null) =>
    canon.get(areaKey(raw)) ?? (raw ?? "").trim();

  const empById = new Map<
    string,
    {
      employeeId: string;
      name: string;
      area: string;
      areaId: string;
      position: string;
      dni: string;
      email: string;
    }
  >();
  for (const e of employees) {
    empById.set(e.EmployeeID, {
      employeeId: e.EmployeeID,
      name: e.FullName,
      area: canonLabel(e.Area) || "Sin área",
      areaId: areaKey(e.Area) || "sin-area",
      position: e.Position ?? "",
      dni: e.DNI ?? "",
      email: e.Email ?? "",
    });
  }

  // ─── Filters ────────────────────────────────────────────────────────────
  const areaIds = new Set((query.areas ?? []).map(areaKey).filter(Boolean));
  const pickedIds = query.employeeIds?.length ? new Set(query.employeeIds) : null;
  const monthFilter = query.months?.length ? new Set(query.months) : null;

  const passesEmployee = (employeeId: string): boolean => {
    if (pickedIds && !pickedIds.has(employeeId)) return false;
    if (areaIds.size > 0) {
      const emp = empById.get(employeeId);
      // Someone with no employee record can't be matched to an area; when an
      // area filter is on, leaving them in would silently widen the report.
      if (!emp || !areaIds.has(emp.areaId)) return false;
    }
    return true;
  };

  const filtered = rows.filter(
    (r) => passesEmployee(r.EmployeeID) && (!monthFilter || monthFilter.has(parseMonth(r.WorkDate)))
  );

  /**
   * The roster the report covers: every active employee passing the filters,
   * plus anyone with records who is no longer on the active list (somebody who
   * left mid-period still worked days the boss will ask about). Employees with
   * zero records stay in with a row of zeros rather than vanishing — an empty
   * row is information, a missing row looks like an oversight.
   */
  const rosterIds = new Set<string>();
  for (const e of employees) {
    if (passesEmployee(e.EmployeeID)) rosterIds.add(e.EmployeeID);
  }
  for (const r of filtered) rosterIds.add(r.EmployeeID);

  // ─── Accumulators ───────────────────────────────────────────────────────
  const monthly = new Map<
    string,
    { m: ReportMetrics; employees: Set<string> }
  >();
  const yearly = new Map<
    string,
    { m: ReportMetrics; employees: Set<string>; months: Set<string> }
  >();
  const byEmployee = new Map<string, ReportMetrics>();
  const byEmployeeMonth = new Map<string, Map<string, ReportMetrics>>();
  const statusDist: StatusDistribution = {};
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );
  const totals: ReportMetrics = emptyMetrics();

  for (const id of rosterIds) byEmployee.set(id, emptyMetrics());

  for (const r of filtered) {
    const ymd = parseYmd(r.WorkDate);
    const month = parseMonth(r.WorkDate);
    const year = month.slice(0, 4);
    const status = r.status ?? "NO_RECORD";

    const mo = monthly.get(month) ?? { m: emptyMetrics(), employees: new Set<string>() };
    applyRow(mo.m, r);
    mo.employees.add(r.EmployeeID);
    monthly.set(month, mo);

    const yr =
      yearly.get(year) ?? { m: emptyMetrics(), employees: new Set<string>(), months: new Set<string>() };
    applyRow(yr.m, r);
    yr.employees.add(r.EmployeeID);
    yr.months.add(month);
    yearly.set(year, yr);

    const emp = byEmployee.get(r.EmployeeID) ?? emptyMetrics();
    applyRow(emp, r);
    byEmployee.set(r.EmployeeID, emp);

    let perMonth = byEmployeeMonth.get(r.EmployeeID);
    if (!perMonth) {
      perMonth = new Map<string, ReportMetrics>();
      byEmployeeMonth.set(r.EmployeeID, perMonth);
    }
    const cell = perMonth.get(month) ?? emptyMetrics();
    applyRow(cell, r);
    perMonth.set(month, cell);

    applyRow(totals, r);

    statusDist[status] = (statusDist[status] ?? 0) + 1;

    // Heatmap: bucket by (dayOfWeek, hour-of-check-in)
    if (r.firstInLocal) {
      const hourMatch = r.firstInLocal.match(/T(\d{2}):/);
      if (hourMatch) {
        const hour = Number(hourMatch[1]);
        const dow = dayOfWeekMondayFirst(ymd);
        if (hour >= 0 && hour < 24 && dow >= 0 && dow < 7) {
          heatmap[dow][hour] += 1;
        }
      }
    }
  }

  // ─── Shape the output ───────────────────────────────────────────────────
  const monthlyTrend: MonthlyTrendPoint[] = Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v.m, employees: v.employees.size }));

  const yearlyTrend: YearlyTrendPoint[] = Array.from(yearly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, v]) => ({
      year,
      ...v.m,
      employees: v.employees.size,
      monthsWithData: v.months.size,
    }));

  const employeeRanking: EmployeeRankingEntry[] = Array.from(byEmployee.entries())
    .map(([employeeId, m]) => {
      const meta = empById.get(employeeId);
      return {
        employeeId,
        employeeName: meta?.name ?? employeeId.replace(/^EMP#/, ""),
        area: meta?.area ?? "Sin área",
        position: meta?.position ?? "",
        dni: meta?.dni ?? "",
        email: meta?.email ?? employeeId.replace(/^EMP#/, ""),
        ...m,
        deltaHours: deltaHours(m),
      };
    })
    .sort((a, b) => b.workedHours - a.workedHours);

  const months = query.months?.length
    ? [...query.months].sort()
    : monthsInRange(fromDate, toDate);

  const employeeMonthly: EmployeeMonthlyRow[] = employeeRanking.map((e) => {
    const perMonth = byEmployeeMonth.get(e.employeeId);
    const byMonth: Record<string, ReportMetrics> = {};
    const total = emptyMetrics();
    for (const month of months) {
      const cell = perMonth?.get(month);
      if (cell) {
        byMonth[month] = cell;
        addMetrics(total, cell);
      }
    }
    return {
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      area: e.area,
      byMonth,
      total,
    };
  });

  // Area rollup. Headcount counts people, not records, so an area whose staff
  // never clocked in still shows up with its real size.
  const areaAcc = new Map<
    string,
    { label: string; m: ReportMetrics; headcount: number; withRecords: number }
  >();
  for (const e of employeeRanking) {
    const id = empById.get(e.employeeId)?.areaId ?? areaKey(e.area) ?? "sin-area";
    const acc =
      areaAcc.get(id) ?? { label: e.area || "Sin área", m: emptyMetrics(), headcount: 0, withRecords: 0 };
    addMetrics(acc.m, e);
    acc.headcount += 1;
    if (e.daysRecorded > 0) acc.withRecords += 1;
    areaAcc.set(id, acc);
  }

  const areaBreakdown: AreaBreakdownEntry[] = Array.from(areaAcc.entries())
    .map(([areaId, v]) => ({
      areaId,
      area: v.label,
      headcount: v.headcount,
      withRecords: v.withRecords,
      ...v.m,
      deltaHours: deltaHours(v.m),
    }))
    .sort((a, b) => b.workedHours - a.workedHours);

  // Every area in the tenant (not just the filtered ones) so the filter chips
  // never hide the area you would need to click to get back.
  const availableAreaMap = new Map<string, { id: string; label: string; headcount: number }>();
  for (const e of employees) {
    const id = areaKey(e.Area) || "sin-area";
    const entry =
      availableAreaMap.get(id) ?? { id, label: canonLabel(e.Area) || "Sin área", headcount: 0 };
    entry.headcount += 1;
    availableAreaMap.set(id, entry);
  }
  const availableAreas = Array.from(availableAreaMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "es")
  );

  return {
    range: { from: fromDate, to: toDate },
    months,
    filters: {
      areas: query.areas ?? [],
      employeeIds: query.employeeIds ?? [],
      months: query.months ?? [],
    },
    totals: {
      ...totals,
      employees: new Set(filtered.map((r) => r.EmployeeID)).size,
      rosterSize: rosterIds.size,
    },
    monthlyTrend,
    yearlyTrend,
    employeeRanking,
    employeeMonthly,
    areaBreakdown,
    statusDistribution: statusDist,
    entryHeatmap: heatmap,
    availableAreas,
  };
}

export type { ReportMetrics };
