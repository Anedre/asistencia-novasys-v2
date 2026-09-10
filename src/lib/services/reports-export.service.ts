/**
 * Report export service — turns ReportsStats into a real .xlsx workbook
 * (or a single CSV sheet).
 *
 * The workbook mirrors the tabs of /admin/reports so what an admin sees on
 * screen is what lands in Excel: a company-wide summary plus one sheet per
 * view. Which columns each sheet carries comes from the shared field
 * catalogue (`report-fields`), so the picker in the UI, the spreadsheet and
 * the PDF always agree on labels and formats.
 *
 * Built server-side so exceljs never reaches the client bundle.
 */

import ExcelJS from "exceljs";
import type {
  ReportsStats,
  EmployeeRankingEntry,
  AreaBreakdownEntry,
} from "./reports-stats.service";
import {
  DEFAULT_FIELDS,
  REPORT_FIELD_BY_KEY,
  VIEW_SORT_FIELD,
  addMetrics,
  emptyMetrics,
  fieldValue,
  sanitizeFields,
  type ReportFieldKey,
  type ReportMetrics,
  type ReportRow,
  type ReportViewKey,
} from "@/lib/constants/report-fields";

export type ExportVariant =
  | "all"
  | "attendance"
  | "hours"
  | "absences"
  | "payroll"
  | "areas"
  | "monthly"
  | "yearly";

export interface ExportOptions {
  tenantName: string;
  variant: ExportVariant;
  /** Column selection from the UI picker. Falls back to the view's defaults. */
  fields?: ReportFieldKey[];
  /** Group employee sheets by area, with a subtotal row per area. */
  groupByArea?: boolean;
}

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MONTH_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Accent used for header fills — matches the Nova accent in the UI. */
const HEADER_BG = "FF1E3A5F";
const HEADER_FG = "FFFFFFFF";
const GROUP_BG = "FFE8EEF7";
const TOTAL_BG = "FFF1F5F9";

const VIEW_SHEET_NAME: Record<ReportViewKey, string> = {
  attendance: "Asistencia",
  hours: "Horas trabajadas",
  absences: "Ausencias",
  payroll: "Para nómina",
  areas: "Por área",
  monthly: "Mensual",
};

/** Views that render as a plain one-row-per-employee table. */
const EMPLOYEE_VIEWS = ["attendance", "hours", "absences", "payroll"] as const;
type EmployeeView = (typeof EMPLOYEE_VIEWS)[number];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function monthLabel(ym: string, short = false): string {
  const [y, m] = ym.split("-").map(Number);
  const names = short ? MONTH_SHORT : MONTH_LABELS;
  return `${names[m - 1] ?? ym} ${y}`;
}

/** Excel refuses []:*?/\ in a sheet name and caps it at 31 characters. */
function safeSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, " ").slice(0, 31).trim();
}

function styleHeader(sheet: ExcelJS.Worksheet, columnCount: number) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  // Freeze the header so long rosters stay readable while scrolling.
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, columnCount) },
  };
}

/** Sort a table by whatever column the view is actually about. */
function sortFor(view: ReportViewKey) {
  const key = VIEW_SORT_FIELD[view];
  return (a: ReportRow, b: ReportRow) => {
    const av = fieldValue(key, a);
    const bv = fieldValue(key, b);
    if (typeof av === "number" && typeof bv === "number") return bv - av;
    return String(av).localeCompare(String(bv), "es");
  };
}

/* ── Employee sheets ─────────────────────────────────────────────────────── */

function addEmployeeSheet(
  wb: ExcelJS.Workbook,
  stats: ReportsStats,
  view: EmployeeView,
  fields: ReportFieldKey[],
  groupByArea: boolean
): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(safeSheetName(VIEW_SHEET_NAME[view]));

  // When grouping by area the area is already the group heading, so repeating
  // it in every row is noise.
  const cols = groupByArea ? fields.filter((f) => f !== "area") : fields;

  sheet.columns = [
    { header: "Empleado", key: "empleado", width: 32 },
    ...cols.map((k) => ({
      header: REPORT_FIELD_BY_KEY[k].label,
      key: k,
      width: REPORT_FIELD_BY_KEY[k].width,
    })),
  ];

  const rowFor = (e: EmployeeRankingEntry) => {
    const out: Record<string, string | number> = { empleado: e.employeeName };
    cols.forEach((k) => {
      out[k] = fieldValue(k, e);
    });
    return out;
  };

  const sorted = stats.employeeRanking.slice().sort(sortFor(view));

  if (!groupByArea) {
    sorted.forEach((e) => sheet.addRow(rowFor(e)));
  } else {
    const byArea = new Map<string, EmployeeRankingEntry[]>();
    sorted.forEach((e) => {
      const label = e.area || "Sin área";
      const list = byArea.get(label) ?? [];
      list.push(e);
      byArea.set(label, list);
    });

    Array.from(byArea.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .forEach(([area, people]) => {
        const head = sheet.addRow({ empleado: `${area} (${people.length})` });
        head.font = { bold: true };
        head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_BG } };

        people.forEach((e) => sheet.addRow(rowFor(e)));

        const subtotal = people.reduce(
          (acc, e) => addMetrics(acc, e),
          emptyMetrics()
        );
        const subRow: Record<string, string | number> = { empleado: `Subtotal ${area}` };
        cols.forEach((k) => {
          // A subtotal of a name or a DNI is meaningless — leave those blank.
          subRow[k] = REPORT_FIELD_BY_KEY[k].kind === "text" ? "" : fieldValue(k, subtotal);
        });
        const sub = sheet.addRow(subRow);
        sub.font = { bold: true };
        sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
      });
  }

  cols.forEach((k, i) => {
    const fmt = REPORT_FIELD_BY_KEY[k].numFmt;
    if (fmt) sheet.getColumn(i + 2).numFmt = fmt;
  });

  styleHeader(sheet, cols.length + 1);
  return sheet;
}

/* ── Area sheet ──────────────────────────────────────────────────────────── */

function addAreaSheet(
  wb: ExcelJS.Workbook,
  stats: ReportsStats,
  fields: ReportFieldKey[]
): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(safeSheetName(VIEW_SHEET_NAME.areas));

  // Identity columns describe a person, not an area — drop them here.
  const cols = fields.filter((f) => REPORT_FIELD_BY_KEY[f].kind !== "text");

  sheet.columns = [
    { header: "Área", key: "area", width: 26 },
    { header: "Personas", key: "headcount", width: 12 },
    { header: "Con registros", key: "withRecords", width: 15 },
    ...cols.map((k) => ({
      header: REPORT_FIELD_BY_KEY[k].label,
      key: k,
      width: REPORT_FIELD_BY_KEY[k].width,
    })),
  ];

  const rows: AreaBreakdownEntry[] = stats.areaBreakdown
    .slice()
    .sort(sortFor("areas") as (a: AreaBreakdownEntry, b: AreaBreakdownEntry) => number);

  rows.forEach((a) => {
    const out: Record<string, string | number> = {
      area: a.area,
      headcount: a.headcount,
      withRecords: a.withRecords,
    };
    cols.forEach((k) => {
      out[k] = fieldValue(k, a);
    });
    sheet.addRow(out);
  });

  const total = rows.reduce((acc, a) => addMetrics(acc, a), emptyMetrics());
  const totalRow: Record<string, string | number> = {
    area: "TOTAL",
    headcount: rows.reduce((n, a) => n + a.headcount, 0),
    withRecords: rows.reduce((n, a) => n + a.withRecords, 0),
  };
  cols.forEach((k) => {
    totalRow[k] = fieldValue(k, total);
  });
  const tr = sheet.addRow(totalRow);
  tr.font = { bold: true };
  tr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };

  cols.forEach((k, i) => {
    const fmt = REPORT_FIELD_BY_KEY[k].numFmt;
    if (fmt) sheet.getColumn(i + 4).numFmt = fmt;
  });

  styleHeader(sheet, cols.length + 3);
  return sheet;
}

/* ── Monthly matrix ──────────────────────────────────────────────────────── */

/**
 * One sheet per picked metric: employees down, months across.
 *
 * A single sheet cannot hold employee × month × metric without turning into an
 * unreadable 40-column strip, so each metric gets its own grid — which is also
 * the shape you want when pasting one metric into another spreadsheet.
 */
function addMonthlySheets(
  wb: ExcelJS.Workbook,
  stats: ReportsStats,
  fields: ReportFieldKey[]
): void {
  const metrics = fields.filter((f) => REPORT_FIELD_BY_KEY[f].kind !== "text");
  // Cap the sheet count: past four grids the workbook stops being readable and
  // starts being a data dump.
  const picked = (metrics.length > 0 ? metrics : DEFAULT_FIELDS.monthly).slice(0, 4);

  for (const key of picked) {
    const def = REPORT_FIELD_BY_KEY[key];
    if (def.kind === "text") continue;

    const sheet = wb.addWorksheet(safeSheetName(`Mensual · ${def.label}`));
    sheet.columns = [
      { header: "Empleado", key: "empleado", width: 32 },
      { header: "Área", key: "area", width: 20 },
      ...stats.months.map((m) => ({ header: monthLabel(m, true), key: m, width: 12 })),
      { header: "Total", key: "__total", width: 14 },
    ];

    stats.employeeMonthly.forEach((row) => {
      const out: Record<string, string | number> = {
        empleado: row.employeeName,
        area: row.area || "—",
      };
      stats.months.forEach((m) => {
        const cell = row.byMonth[m];
        // A month with no records is left blank, not zeroed: "didn't work" and
        // "wasn't hired yet" must not look the same in a payroll review.
        out[m] = cell ? fieldValue(key, cell) : "";
      });
      out.__total = fieldValue(key, row.total);
      sheet.addRow(out);
    });

    // Column footer: what the whole company did that month.
    const totalRow: Record<string, string | number> = { empleado: "TOTAL", area: "" };
    const grand = emptyMetrics();
    stats.months.forEach((m) => {
      const monthTotal = stats.employeeMonthly.reduce((acc, row) => {
        const cell = row.byMonth[m];
        return cell ? addMetrics(acc, cell) : acc;
      }, emptyMetrics());
      addMetrics(grand, monthTotal);
      totalRow[m] = fieldValue(key, monthTotal);
    });
    totalRow.__total = fieldValue(key, grand);
    const tr = sheet.addRow(totalRow);
    tr.font = { bold: true };
    tr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };

    if (def.numFmt) {
      for (let i = 0; i < stats.months.length + 1; i++) {
        sheet.getColumn(i + 3).numFmt = def.numFmt;
      }
    }
    styleHeader(sheet, stats.months.length + 3);
  }
}

/* ── Yearly sheets ───────────────────────────────────────────────────────── */

function yearsOf(stats: ReportsStats): string[] {
  return Array.from(new Set(stats.months.map((m) => m.slice(0, 4)))).sort();
}

function addYearlySheets(
  wb: ExcelJS.Workbook,
  stats: ReportsStats,
  fields: ReportFieldKey[]
): void {
  const cols = fields.filter((f) => REPORT_FIELD_BY_KEY[f].kind !== "text");
  const metricCols = cols.length > 0 ? cols : DEFAULT_FIELDS.hours;

  // Company totals per year.
  const sheet = wb.addWorksheet("Anual");
  sheet.columns = [
    { header: "Año", key: "anio", width: 10 },
    { header: "Empleados", key: "empleados", width: 12 },
    { header: "Meses con datos", key: "meses", width: 16 },
    ...metricCols.map((k) => ({
      header: REPORT_FIELD_BY_KEY[k].label,
      key: k,
      width: REPORT_FIELD_BY_KEY[k].width,
    })),
  ];
  stats.yearlyTrend.forEach((y) => {
    const out: Record<string, string | number> = {
      anio: y.year,
      empleados: y.employees,
      meses: y.monthsWithData,
    };
    metricCols.forEach((k) => {
      out[k] = fieldValue(k, y);
    });
    sheet.addRow(out);
  });
  metricCols.forEach((k, i) => {
    const fmt = REPORT_FIELD_BY_KEY[k].numFmt;
    if (fmt) sheet.getColumn(i + 4).numFmt = fmt;
  });
  styleHeader(sheet, metricCols.length + 3);

  // Employees down, years across — one grid per metric, same reasoning as the
  // monthly matrix.
  const years = yearsOf(stats);
  for (const key of metricCols.slice(0, 3)) {
    const def = REPORT_FIELD_BY_KEY[key];
    const grid = wb.addWorksheet(safeSheetName(`Anual · ${def.label}`));
    grid.columns = [
      { header: "Empleado", key: "empleado", width: 32 },
      { header: "Área", key: "area", width: 20 },
      ...years.map((y) => ({ header: y, key: y, width: 13 })),
      { header: "Total", key: "__total", width: 14 },
    ];

    stats.employeeMonthly.forEach((row) => {
      const out: Record<string, string | number> = {
        empleado: row.employeeName,
        area: row.area || "—",
      };
      years.forEach((y) => {
        const acc = emptyMetrics();
        let seen = false;
        Object.entries(row.byMonth).forEach(([m, cell]) => {
          if (m.startsWith(y)) {
            addMetrics(acc, cell);
            seen = true;
          }
        });
        out[y] = seen ? fieldValue(key, acc) : "";
      });
      out.__total = fieldValue(key, row.total);
      grid.addRow(out);
    });

    if (def.numFmt) {
      for (let i = 0; i < years.length + 1; i++) {
        grid.getColumn(i + 3).numFmt = def.numFmt;
      }
    }
    styleHeader(grid, years.length + 3);
  }
}

/* ── Summary + trend ─────────────────────────────────────────────────────── */

function addSummarySheet(
  wb: ExcelJS.Workbook,
  stats: ReportsStats,
  tenantName: string
): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet("Resumen");
  sheet.columns = [
    { header: "Concepto", key: "k", width: 34 },
    { header: "Valor", key: "v", width: 30 },
  ];

  const t = stats.totals;
  const cumplimiento =
    t.plannedHours > 0
      ? Math.min(100, Math.round((t.workedHours / t.plannedHours) * 100))
      : 0;

  const rows: [string, string | number][] = [
    ["Empresa", tenantName],
    ["Periodo", `${stats.range.from} a ${stats.range.to}`],
  ];

  if (stats.filters.months.length > 0) {
    rows.push(["Meses incluidos", stats.filters.months.map((m) => monthLabel(m, true)).join(", ")]);
  }
  if (stats.filters.areas.length > 0) {
    rows.push(["Áreas incluidas", stats.filters.areas.join(", ")]);
  }
  if (stats.filters.employeeIds.length > 0) {
    rows.push(["Empleados seleccionados", stats.filters.employeeIds.length]);
  }

  rows.push(
    ["Personas en el reporte", t.rosterSize],
    ["Empleados con registros", t.employees],
    ["Días registrados", t.daysRecorded],
    ["Días presente", t.daysPresent],
    ["Horas trabajadas", round1(t.workedHours)],
    ["Horas planificadas", round1(t.plannedHours)],
    ["Diferencia", round1(t.workedHours - t.plannedHours)],
    ["% Cumplimiento", cumplimiento],
    ["Horas extra", round1(Math.max(0, t.workedHours - t.plannedHours))],
    ["Horas de break", round1(t.breakHours)],
    ["Total ausencias", t.absences],
    ["Total regularizaciones", t.regularizations],
    ["Días con tardanza", t.lateDays],
    ["Horas de tardanza", round1(t.lateHours)],
    ["Jornadas sin cerrar", t.openDays],
    ["Generado", new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })]
  );

  rows.forEach(([k, v]) => sheet.addRow({ k, v }));

  sheet.getColumn(1).font = { bold: true };
  styleHeader(sheet, 2);
  return sheet;
}

function addTrendSheet(wb: ExcelJS.Workbook, stats: ReportsStats): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet("Tendencia mensual");
  sheet.columns = [
    { header: "Mes", key: "mes", width: 18 },
    { header: "Horas trabajadas", key: "trabajadas", width: 18 },
    { header: "Horas planificadas", key: "planificadas", width: 18 },
    { header: "% Cumplimiento", key: "pct", width: 16 },
    { header: "Días presente", key: "dias", width: 14 },
    { header: "Ausencias", key: "faltas", width: 12 },
    { header: "Empleados", key: "empleados", width: 12 },
  ];

  stats.monthlyTrend.forEach((p) => {
    sheet.addRow({
      mes: monthLabel(p.month),
      trabajadas: round1(p.workedHours),
      planificadas: round1(p.plannedHours),
      pct:
        p.plannedHours > 0
          ? Math.min(100, Math.round((p.workedHours / p.plannedHours) * 100))
          : 0,
      dias: p.daysPresent,
      faltas: p.absences,
      empleados: p.employees,
    });
  });

  sheet.getColumn(2).numFmt = "0.0";
  sheet.getColumn(3).numFmt = "0.0";
  styleHeader(sheet, 7);
  return sheet;
}

/* ── Entry points ────────────────────────────────────────────────────────── */

/** Which view's defaults a variant falls back to when no columns were picked. */
function defaultsFor(variant: ExportVariant): ReportFieldKey[] {
  if (variant === "all") return DEFAULT_FIELDS.hours;
  if (variant === "yearly") return DEFAULT_FIELDS.hours;
  return DEFAULT_FIELDS[variant as ReportViewKey] ?? DEFAULT_FIELDS.hours;
}

/** Full workbook: summary + the sheets the chosen variant asks for. */
export async function buildReportsWorkbook(
  stats: ReportsStats,
  opts: ExportOptions
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Novasys Asistencia";
  wb.created = new Date();

  const fields = sanitizeFields(opts.fields, defaultsFor(opts.variant));
  const groupByArea = Boolean(opts.groupByArea);

  addSummarySheet(wb, stats, opts.tenantName);

  switch (opts.variant) {
    case "all":
      EMPLOYEE_VIEWS.forEach((v) =>
        addEmployeeSheet(wb, stats, v, sanitizeFields(opts.fields, DEFAULT_FIELDS[v]), groupByArea)
      );
      addAreaSheet(wb, stats, DEFAULT_FIELDS.areas);
      addMonthlySheets(wb, stats, DEFAULT_FIELDS.monthly);
      if (stats.yearlyTrend.length > 0) addYearlySheets(wb, stats, DEFAULT_FIELDS.hours);
      addTrendSheet(wb, stats);
      break;
    case "areas":
      addAreaSheet(wb, stats, fields);
      break;
    case "monthly":
      addMonthlySheets(wb, stats, fields);
      break;
    case "yearly":
      addYearlySheets(wb, stats, fields);
      break;
    default:
      addEmployeeSheet(wb, stats, opts.variant, fields, groupByArea);
      break;
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Single-view CSV. Excel-friendly: semicolon separator + UTF-8 BOM. */
export function buildReportsCsv(
  stats: ReportsStats,
  variant: Exclude<ExportVariant, "all">,
  pickedFields?: ReportFieldKey[]
): string {
  const fields = sanitizeFields(pickedFields, defaultsFor(variant));
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines: string[] = [];

  if (variant === "areas") {
    const cols = fields.filter((f) => REPORT_FIELD_BY_KEY[f].kind !== "text");
    lines.push(
      ["Área", "Personas", "Con registros", ...cols.map((k) => REPORT_FIELD_BY_KEY[k].label)]
        .map(esc)
        .join(";")
    );
    stats.areaBreakdown.forEach((a) => {
      lines.push(
        [a.area, a.headcount, a.withRecords, ...cols.map((k) => fieldValue(k, a))]
          .map(esc)
          .join(";")
      );
    });
  } else if (variant === "monthly" || variant === "yearly") {
    const cols = fields.filter((f) => REPORT_FIELD_BY_KEY[f].kind !== "text");
    const metric = cols[0] ?? "workedHours";
    const buckets =
      variant === "monthly" ? stats.months : yearsOf(stats);
    const headers =
      variant === "monthly" ? buckets.map((m) => monthLabel(m, true)) : buckets;

    lines.push(
      ["Empleado", "Área", ...headers, `Total (${REPORT_FIELD_BY_KEY[metric].label})`]
        .map(esc)
        .join(";")
    );
    stats.employeeMonthly.forEach((row) => {
      const cells = buckets.map((bucket) => {
        if (variant === "monthly") {
          const cell = row.byMonth[bucket];
          return cell ? fieldValue(metric, cell) : "";
        }
        const acc: ReportMetrics = emptyMetrics();
        let seen = false;
        Object.entries(row.byMonth).forEach(([m, cell]) => {
          if (m.startsWith(bucket)) {
            addMetrics(acc, cell);
            seen = true;
          }
        });
        return seen ? fieldValue(metric, acc) : "";
      });
      lines.push(
        [row.employeeName, row.area || "—", ...cells, fieldValue(metric, row.total)]
          .map(esc)
          .join(";")
      );
    });
  } else {
    lines.push(
      ["Empleado", ...fields.map((k) => REPORT_FIELD_BY_KEY[k].label)].map(esc).join(";")
    );
    stats.employeeRanking
      .slice()
      .sort(sortFor(variant))
      .forEach((e) => {
        lines.push([e.employeeName, ...fields.map((k) => fieldValue(k, e))].map(esc).join(";"));
      });
  }

  // BOM so Excel on Windows detects UTF-8 and renders á/ó/ñ correctly.
  return "﻿" + lines.join("\r\n");
}

const VARIANT_SLUG: Record<ExportVariant, string> = {
  all: "completo",
  attendance: "asistencia",
  hours: "horas",
  absences: "ausencias",
  payroll: "nomina",
  areas: "por-area",
  monthly: "mensual",
  yearly: "anual",
};

export function exportFilename(
  stats: ReportsStats,
  variant: ExportVariant,
  ext: "xlsx" | "csv"
): string {
  const slug = VARIANT_SLUG[variant] ?? "reporte";
  // A file whose name doesn't say it was filtered gets mistaken for the whole
  // company the moment it's forwarded by email.
  const areaTag =
    stats.filters.areas.length === 1
      ? "_" +
        stats.filters.areas[0]
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      : stats.filters.areas.length > 1
      ? `_${stats.filters.areas.length}-areas`
      : "";
  return `reporte-asistencia_${slug}${areaTag}_${stats.range.from}_a_${stats.range.to}.${ext}`;
}
