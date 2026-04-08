/**
 * Aggregation logic for the admin Reports dashboard.
 *
 * Queries DailySummary over a date range (per tenant) and produces four
 * chart-ready datasets:
 *   1. monthlyTrend      — total worked hours per month
 *   2. employeeRanking   — top / bottom employees by worked hours + absences
 *   3. statusDistribution — count of days per status
 *   4. entryHeatmap      — 7x24 grid: how often people check in on each
 *                          (dayOfWeek, hour) slot
 *
 * One round-trip to Dynamo (with pagination) via the Tenant-WorkDate GSI.
 */

import { docClient } from "@/lib/db/client";
import { TABLES, INDEXES } from "@/lib/db/tables";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getAllActiveEmployees } from "@/lib/db/employees";

export interface MonthlyTrendPoint {
  month: string; // "YYYY-MM"
  workedHours: number;
  plannedHours: number;
  employees: number; // distinct employees with at least 1 record that month
}

export interface EmployeeRankingEntry {
  employeeId: string;
  employeeName: string;
  area: string;
  workedHours: number;
  plannedHours: number;
  deltaHours: number;
  daysPresent: number;
  absences: number;
  regularizations: number;
}

export interface StatusDistribution {
  [status: string]: number;
}

export interface ReportsStats {
  range: { from: string; to: string };
  totals: {
    totalDays: number;
    totalEmployees: number;
    totalWorkedHours: number;
    totalPlannedHours: number;
    totalAbsences: number;
    totalRegularizations: number;
  };
  monthlyTrend: MonthlyTrendPoint[];
  employeeRanking: EmployeeRankingEntry[];
  statusDistribution: StatusDistribution;
  /** entryHeatmap[dayOfWeek 0-6 Mon..Sun][hour 0-23] = number of check-ins */
  entryHeatmap: number[][];
}

interface RawRow {
  EmployeeID: string;
  WorkDate: string;
  workedMinutes?: number;
  plannedMinutes?: number;
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

export async function getReportsStats(
  tenantId: string,
  fromDate: string,
  toDate: string,
  areaFilter?: string
): Promise<ReportsStats> {
  // Parallelize employees lookup and dynamo range query.
  const [employees, rows] = await Promise.all([
    getAllActiveEmployees(tenantId),
    queryRange(tenantId, fromDate, toDate),
  ]);

  // Build a quick lookup of employee metadata.
  const empById = new Map<
    string,
    { employeeId: string; name: string; area: string }
  >();
  for (const e of employees) {
    empById.set(e.EmployeeID, {
      employeeId: e.EmployeeID,
      name: e.FullName,
      area: e.Area,
    });
  }

  // Filter by area if requested. We only keep rows for employees matching
  // the area (rows have no Area of their own).
  const filtered = areaFilter
    ? rows.filter((r) => {
        const emp = empById.get(r.EmployeeID);
        return emp?.area === areaFilter;
      })
    : rows;

  // ─── Accumulators ───────────────────────────────────────────────────────
  const monthly = new Map<
    string,
    { workedMin: number; plannedMin: number; employees: Set<string> }
  >();
  const rankingByEmp = new Map<
    string,
    {
      workedMin: number;
      plannedMin: number;
      daysPresent: number;
      absences: number;
      regularizations: number;
    }
  >();
  const statusDist: StatusDistribution = {};
  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  let totalWorked = 0;
  let totalPlanned = 0;
  let totalAbsences = 0;
  let totalRegs = 0;

  for (const r of filtered) {
    const ymd = parseYmd(r.WorkDate);
    const month = parseMonth(r.WorkDate);
    const worked = Number(r.workedMinutes ?? 0);
    const planned = Number(r.plannedMinutes ?? 0);
    const status = r.status ?? "NO_RECORD";

    // Monthly trend
    const m = monthly.get(month) ?? {
      workedMin: 0,
      plannedMin: 0,
      employees: new Set<string>(),
    };
    m.workedMin += worked;
    m.plannedMin += planned;
    m.employees.add(r.EmployeeID);
    monthly.set(month, m);

    // Employee ranking
    const er = rankingByEmp.get(r.EmployeeID) ?? {
      workedMin: 0,
      plannedMin: 0,
      daysPresent: 0,
      absences: 0,
      regularizations: 0,
    };
    er.workedMin += worked;
    er.plannedMin += planned;
    if (worked > 0) er.daysPresent += 1;
    if (status === "ABSENCE" || status === "MISSING") er.absences += 1;
    if (status === "REGULARIZED" || r.source === "REGULARIZATION" || r.source === "REGULARIZATION_RANGE") {
      er.regularizations += 1;
    }
    rankingByEmp.set(r.EmployeeID, er);

    // Status distribution
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

    // Totals
    totalWorked += worked;
    totalPlanned += planned;
    if (status === "ABSENCE" || status === "MISSING") totalAbsences += 1;
    if (status === "REGULARIZED") totalRegs += 1;
  }

  // Build monthlyTrend sorted ascending
  const monthlyTrend: MonthlyTrendPoint[] = Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      workedHours: Math.round((v.workedMin / 60) * 10) / 10,
      plannedHours: Math.round((v.plannedMin / 60) * 10) / 10,
      employees: v.employees.size,
    }));

  // Build ranking sorted by workedMinutes desc, top 15
  const employeeRanking: EmployeeRankingEntry[] = Array.from(
    rankingByEmp.entries()
  )
    .map(([employeeId, v]) => {
      const meta = empById.get(employeeId);
      return {
        employeeId,
        employeeName: meta?.name ?? employeeId.replace(/^EMP#/, ""),
        area: meta?.area ?? "",
        workedHours: Math.round((v.workedMin / 60) * 10) / 10,
        plannedHours: Math.round((v.plannedMin / 60) * 10) / 10,
        deltaHours:
          Math.round(((v.workedMin - v.plannedMin) / 60) * 10) / 10,
        daysPresent: v.daysPresent,
        absences: v.absences,
        regularizations: v.regularizations,
      };
    })
    .sort((a, b) => b.workedHours - a.workedHours)
    .slice(0, 15);

  const totalEmployees = new Set(filtered.map((r) => r.EmployeeID)).size;

  return {
    range: { from: fromDate, to: toDate },
    totals: {
      totalDays: filtered.length,
      totalEmployees,
      totalWorkedHours: Math.round((totalWorked / 60) * 10) / 10,
      totalPlannedHours: Math.round((totalPlanned / 60) * 10) / 10,
      totalAbsences,
      totalRegularizations: totalRegs,
    },
    monthlyTrend,
    employeeRanking,
    statusDistribution: statusDist,
    entryHeatmap: heatmap,
  };
}
