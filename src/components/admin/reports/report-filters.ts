/**
 * Filter state shared by every report surface.
 *
 * The reports page, the exports and the PDF panel all describe the same thing:
 * a period, a set of areas, a set of people. Keeping the shape and the
 * query-string encoding here means the Excel file an admin downloads always
 * matches the table they were looking at when they clicked.
 */

import type { ReportFieldKey } from "@/lib/constants/report-fields";

export type PeriodMode = "range" | "months" | "years";

export interface ReportFilters {
  mode: PeriodMode;
  /** Used when mode === "range". */
  from: string;
  to: string;
  /** "YYYY-MM", possibly non-contiguous. Used when mode === "months". */
  months: string[];
  /** "YYYY". Used when mode === "years". */
  years: string[];
  /** Canonical area labels. Empty means every area. */
  areas: string[];
  /** "EMP#..." ids. Empty means everyone. */
  employeeIds: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthsBack(n: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - n);
  return { from: toYmd(from), to: toYmd(to) };
}

export function defaultFilters(): ReportFilters {
  const { from, to } = monthsBack(6);
  return { mode: "range", from, to, months: [], years: [], areas: [], employeeIds: [] };
}

const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function monthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_SHORT[m - 1] ?? ym} ${String(y).slice(2)}`;
}

export function monthLong(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_LONG[m - 1] ?? ym} ${y}`;
}

/** Last day of a "YYYY-MM". */
export function endOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${pad(last)}`;
}

/**
 * The actual date span a filter covers — what the header shows, and what the
 * PDF endpoints need, since they take dates rather than month sets.
 */
export function effectiveRange(f: ReportFilters): { from: string; to: string } {
  if (f.mode === "months" && f.months.length > 0) {
    const sorted = [...f.months].sort();
    return { from: `${sorted[0]}-01`, to: endOfMonth(sorted[sorted.length - 1]) };
  }
  if (f.mode === "years" && f.years.length > 0) {
    const sorted = [...f.years].sort();
    return { from: `${sorted[0]}-01-01`, to: `${sorted[sorted.length - 1]}-12-31` };
  }
  return { from: f.from, to: f.to };
}

/** Every month the filter covers, in order — the matrix column headers. */
export function selectedMonths(f: ReportFilters): string[] {
  if (f.mode === "months") return [...f.months].sort();
  if (f.mode === "years") {
    return [...f.years]
      .sort()
      .flatMap((y) => Array.from({ length: 12 }, (_, i) => `${y}-${pad(i + 1)}`));
  }
  const { from, to } = effectiveRange(f);
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  let guard = 0;
  while ((y < endY || (y === endY && m <= endM)) && guard++ < 600) {
    out.push(`${y}-${pad(m)}`);
    if (++m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function periodLabel(f: ReportFilters): string {
  if (f.mode === "months" && f.months.length > 0) {
    const sorted = [...f.months].sort();
    if (sorted.length === 1) return monthLong(sorted[0]);
    if (sorted.length <= 4) return sorted.map(monthShort).join(", ");
    return `${sorted.length} meses (${monthShort(sorted[0])} – ${monthShort(sorted[sorted.length - 1])})`;
  }
  if (f.mode === "years" && f.years.length > 0) {
    const sorted = [...f.years].sort();
    return sorted.length === 1 ? `Año ${sorted[0]}` : `Años ${sorted.join(", ")}`;
  }
  return `${f.from} → ${f.to}`;
}

/** True when the period selection is usable — an empty month set is not. */
export function isPeriodValid(f: ReportFilters): boolean {
  if (f.mode === "months") return f.months.length > 0;
  if (f.mode === "years") return f.years.length > 0;
  return Boolean(f.from && f.to && f.from <= f.to);
}

export interface QueryExtras {
  variant?: string;
  format?: "xlsx" | "csv";
  cols?: ReportFieldKey[];
  groupByArea?: boolean;
}

/**
 * Encode filters for /api/admin/reports/*.
 *
 * Employee ids travel without their "EMP#" prefix: the list can hold hundreds
 * of entries and the endpoint is a plain GET, so every character counts.
 */
export function filtersToParams(f: ReportFilters, extras: QueryExtras = {}): URLSearchParams {
  const q = new URLSearchParams();

  if (f.mode === "months" && f.months.length > 0) {
    q.set("months", [...f.months].sort().join(","));
  } else if (f.mode === "years" && f.years.length > 0) {
    q.set("years", [...f.years].sort().join(","));
  } else {
    const { from, to } = effectiveRange(f);
    q.set("from", from);
    q.set("to", to);
  }

  if (f.areas.length > 0) q.set("areas", f.areas.join(","));
  if (f.employeeIds.length > 0) {
    q.set("employees", f.employeeIds.map((id) => id.replace(/^EMP#/, "")).join(","));
  }

  if (extras.variant) q.set("variant", extras.variant);
  if (extras.format) q.set("format", extras.format);
  if (extras.cols?.length) q.set("cols", extras.cols.join(","));
  if (extras.groupByArea) q.set("group", "area");

  return q;
}

export function statsUrl(f: ReportFilters): string {
  return `/api/admin/reports/stats?${filtersToParams(f).toString()}`;
}

export function exportUrl(f: ReportFilters, extras: QueryExtras): string {
  return `/api/admin/reports/export?${filtersToParams(f, extras).toString()}`;
}

/** How many filters are narrowing the report — drives the "limpiar" affordance. */
export function activeFilterCount(f: ReportFilters): number {
  return (f.areas.length > 0 ? 1 : 0) + (f.employeeIds.length > 0 ? 1 : 0);
}
