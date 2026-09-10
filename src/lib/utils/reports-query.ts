/**
 * Query-string parsing shared by the reports endpoints.
 *
 * `/stats` (JSON for the page) and `/export` (xlsx/csv download) must agree on
 * exactly what a filter means, otherwise the file an admin downloads stops
 * matching the table they were looking at. One parser, one set of rules.
 */

import { ValidationError } from "@/lib/utils/errors";
import { monthsInRange, type ReportsStatsQuery } from "@/lib/services/reports-stats.service";
import {
  DEFAULT_FIELDS,
  sanitizeFields,
  type ReportFieldKey,
} from "@/lib/constants/report-fields";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^\d{4}$/;

/** Comma-separated list param → trimmed, de-duplicated, non-empty values. */
function list(url: URL, name: string): string[] {
  const raw = url.searchParams.getAll(name).join(",");
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

/** Last day of a "YYYY-MM", accounting for leap years. */
export function endOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

export interface ParsedReportsQuery {
  query: ReportsStatsQuery;
  fields: ReportFieldKey[];
  groupByArea: boolean;
}

/**
 * Read the filters off a request URL.
 *
 * Period can be expressed three ways, in order of precedence:
 *   • `months=2026-01,2026-02,2026-05` — an explicit, possibly non-contiguous set
 *   • `years=2025,2026`                — shorthand for those years' twelve months
 *   • `from=&to=`                      — a plain range
 *
 * `defaultView` decides which column set applies when the caller picked none.
 */
export function parseReportsQuery(
  url: URL,
  defaultView: keyof typeof DEFAULT_FIELDS = "hours"
): ParsedReportsQuery {
  const months = list(url, "months");
  const years = list(url, "years");
  let from = url.searchParams.get("from") ?? "";
  let to = url.searchParams.get("to") ?? "";

  for (const m of months) {
    if (!MONTH_RE.test(m)) {
      throw new ValidationError(`Mes inválido: "${m}" (formato YYYY-MM)`);
    }
  }
  for (const y of years) {
    if (!YEAR_RE.test(y)) {
      throw new ValidationError(`Año inválido: "${y}" (formato YYYY)`);
    }
  }

  // Years expand into their months so a mixed "2025 completo + marzo 2026"
  // selection is expressible, and everything downstream deals with months only.
  const expanded = new Set(months);
  for (const y of years) {
    for (let m = 1; m <= 12; m++) expanded.add(`${y}-${String(m).padStart(2, "0")}`);
  }
  const monthList = Array.from(expanded).sort();

  if (monthList.length > 0) {
    // A month set implies its own range; from/to are derived, not required.
    from = `${monthList[0]}-01`;
    to = endOfMonth(monthList[monthList.length - 1]);
  }

  if (!from || !DATE_RE.test(from)) {
    throw new ValidationError("Parámetro 'from' inválido (formato YYYY-MM-DD)");
  }
  if (!to || !DATE_RE.test(to)) {
    throw new ValidationError("Parámetro 'to' inválido (formato YYYY-MM-DD)");
  }
  if (from > to) {
    throw new ValidationError("'from' no puede ser posterior a 'to'");
  }
  // A 10-year range would page through Dynamo for a minute and produce a
  // workbook nobody can open. Cap it where a report stops being a report.
  if (monthsInRange(from, to).length > 60) {
    throw new ValidationError("El período no puede superar 60 meses");
  }

  const employees = list(url, "employees").map((e) =>
    e.startsWith("EMP#") ? e : `EMP#${e}`
  );
  if (employees.length > 500) {
    throw new ValidationError("Demasiados empleados seleccionados (máximo 500)");
  }

  const areas = list(url, "areas");

  return {
    query: {
      from,
      to,
      ...(monthList.length > 0 && { months: monthList }),
      ...(areas.length > 0 && { areas }),
      ...(employees.length > 0 && { employeeIds: employees }),
    },
    fields: sanitizeFields(list(url, "cols"), DEFAULT_FIELDS[defaultView]),
    groupByArea: url.searchParams.get("group") === "area",
  };
}
