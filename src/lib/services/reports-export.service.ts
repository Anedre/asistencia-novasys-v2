/**
 * Report export service — turns ReportsStats into a real .xlsx workbook
 * (or a single CSV sheet).
 *
 * The workbook mirrors the tabs of /admin/reports so what an admin sees on
 * screen is what lands in Excel: a company-wide summary plus one per-employee
 * sheet per view. Built server-side so exceljs never reaches the client bundle.
 */

import ExcelJS from "exceljs";
import type { ReportsStats, EmployeeRankingEntry } from "./reports-stats.service";

export type ExportVariant = "all" | "attendance" | "hours" | "absences" | "payroll";

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Accent used for header fills — matches the Nova accent in the UI. */
const HEADER_BG = "FF1E3A5F";
const HEADER_FG = "FFFFFFFF";

interface SheetSpec {
  name: string;
  columns: { header: string; key: string; width: number; numFmt?: string }[];
  rows: (e: EmployeeRankingEntry) => Record<string, string | number>;
  /** Sort applied before writing. */
  sort: (a: EmployeeRankingEntry, b: EmployeeRankingEntry) => number;
}

function pct(e: EmployeeRankingEntry): number {
  if (e.plannedHours <= 0) return 0;
  return Math.min(100, Math.round((e.workedHours / e.plannedHours) * 100));
}

const SHEETS: Record<Exclude<ExportVariant, "all">, SheetSpec> = {
  attendance: {
    name: "Asistencia",
    columns: [
      { header: "Empleado", key: "empleado", width: 32 },
      { header: "Área", key: "area", width: 20 },
      { header: "Días presente", key: "dias", width: 15 },
      { header: "Ausencias", key: "ausencias", width: 12 },
      { header: "% Asistencia", key: "pct", width: 14, numFmt: "0" },
    ],
    rows: (e) => ({
      empleado: e.employeeName,
      area: e.area || "—",
      dias: e.daysPresent,
      ausencias: e.absences,
      pct: pct(e),
    }),
    sort: (a, b) => pct(b) - pct(a),
  },
  hours: {
    name: "Horas trabajadas",
    columns: [
      { header: "Empleado", key: "empleado", width: 32 },
      { header: "Área", key: "area", width: 20 },
      { header: "Horas trabajadas", key: "trabajadas", width: 18, numFmt: "0.0" },
      { header: "Horas planificadas", key: "planificadas", width: 18, numFmt: "0.0" },
      { header: "Diferencia", key: "diferencia", width: 14, numFmt: "+0.0;-0.0;0.0" },
    ],
    rows: (e) => ({
      empleado: e.employeeName,
      area: e.area || "—",
      trabajadas: round1(e.workedHours),
      planificadas: round1(e.plannedHours),
      diferencia: round1(e.deltaHours),
    }),
    sort: (a, b) => b.workedHours - a.workedHours,
  },
  absences: {
    name: "Ausencias",
    columns: [
      { header: "Empleado", key: "empleado", width: 32 },
      { header: "Área", key: "area", width: 20 },
      { header: "Ausencias", key: "ausencias", width: 12 },
      { header: "Regularizaciones", key: "regularizaciones", width: 18 },
      { header: "Horas faltantes", key: "faltantes", width: 16, numFmt: "0.0" },
    ],
    rows: (e) => ({
      empleado: e.employeeName,
      area: e.area || "—",
      ausencias: e.absences,
      regularizaciones: e.regularizations,
      faltantes: round1(Math.max(0, e.plannedHours - e.workedHours)),
    }),
    sort: (a, b) => b.absences - a.absences,
  },
  payroll: {
    name: "Para nómina",
    columns: [
      { header: "Empleado", key: "empleado", width: 32 },
      { header: "Área", key: "area", width: 20 },
      { header: "Días presente", key: "dias", width: 15 },
      { header: "Horas trabajadas", key: "trabajadas", width: 18, numFmt: "0.0" },
      { header: "Horas extra", key: "extra", width: 14, numFmt: "0.0" },
    ],
    rows: (e) => ({
      empleado: e.employeeName,
      area: e.area || "—",
      dias: e.daysPresent,
      trabajadas: round1(e.workedHours),
      extra: round1(Math.max(0, e.workedHours - e.plannedHours)),
    }),
    sort: (a, b) => b.workedHours - a.workedHours,
  },
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  // Freeze the header so long rosters stay readable while scrolling.
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addEmployeeSheet(
  wb: ExcelJS.Workbook,
  spec: SheetSpec,
  ranking: EmployeeRankingEntry[]
) {
  const sheet = wb.addWorksheet(spec.name);
  sheet.columns = spec.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));

  ranking
    .slice()
    .sort(spec.sort)
    .forEach((e) => sheet.addRow(spec.rows(e)));

  spec.columns.forEach((c, i) => {
    if (c.numFmt) sheet.getColumn(i + 1).numFmt = c.numFmt;
  });

  styleHeader(sheet);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: spec.columns.length },
  };
  return sheet;
}

function addSummarySheet(wb: ExcelJS.Workbook, stats: ReportsStats, tenantName: string) {
  const sheet = wb.addWorksheet("Resumen");
  sheet.columns = [
    { header: "Concepto", key: "k", width: 34 },
    { header: "Valor", key: "v", width: 22 },
  ];

  const t = stats.totals;
  const cumplimiento =
    t.totalPlannedHours > 0
      ? Math.min(100, Math.round((t.totalWorkedHours / t.totalPlannedHours) * 100))
      : 0;

  const rows: [string, string | number][] = [
    ["Empresa", tenantName],
    ["Periodo", `${stats.range.from} a ${stats.range.to}`],
    ["Empleados con registros", t.totalEmployees],
    ["Días registrados", t.totalDays],
    ["Horas trabajadas", round1(t.totalWorkedHours)],
    ["Horas planificadas", round1(t.totalPlannedHours)],
    ["Diferencia", round1(t.totalWorkedHours - t.totalPlannedHours)],
    ["% Cumplimiento", cumplimiento],
    ["Total ausencias", t.totalAbsences],
    ["Total regularizaciones", t.totalRegularizations],
    ["Generado", new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })],
  ];
  rows.forEach(([k, v]) => sheet.addRow({ k, v }));

  sheet.getColumn(1).font = { bold: true };
  styleHeader(sheet);
  return sheet;
}

function addTrendSheet(wb: ExcelJS.Workbook, stats: ReportsStats) {
  const sheet = wb.addWorksheet("Tendencia mensual");
  sheet.columns = [
    { header: "Mes", key: "mes", width: 18 },
    { header: "Horas trabajadas", key: "trabajadas", width: 18 },
    { header: "Horas planificadas", key: "planificadas", width: 18 },
    { header: "% Cumplimiento", key: "pct", width: 16 },
    { header: "Empleados", key: "empleados", width: 12 },
  ];

  stats.monthlyTrend.forEach((p) => {
    const [y, m] = p.month.split("-").map(Number);
    sheet.addRow({
      mes: `${MONTH_LABELS[m - 1] ?? p.month} ${y}`,
      trabajadas: round1(p.workedHours),
      planificadas: round1(p.plannedHours),
      pct:
        p.plannedHours > 0
          ? Math.min(100, Math.round((p.workedHours / p.plannedHours) * 100))
          : 0,
      empleados: p.employees,
    });
  });

  sheet.getColumn(2).numFmt = "0.0";
  sheet.getColumn(3).numFmt = "0.0";
  styleHeader(sheet);
  return sheet;
}

/** Full workbook: summary + trend + one sheet per per-employee view. */
export async function buildReportsWorkbook(
  stats: ReportsStats,
  opts: { tenantName: string; variant: ExportVariant }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Novasys Asistencia";
  wb.created = new Date();

  addSummarySheet(wb, stats, opts.tenantName);

  const variants: Exclude<ExportVariant, "all">[] =
    opts.variant === "all"
      ? ["attendance", "hours", "absences", "payroll"]
      : [opts.variant];

  variants.forEach((v) => addEmployeeSheet(wb, SHEETS[v], stats.employeeRanking));

  if (opts.variant === "all") addTrendSheet(wb, stats);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

/** Single-view CSV. Excel-friendly: semicolon separator + UTF-8 BOM. */
export function buildReportsCsv(
  stats: ReportsStats,
  variant: Exclude<ExportVariant, "all">
): string {
  const spec = SHEETS[variant];
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [spec.columns.map((c) => esc(c.header)).join(";")];
  stats.employeeRanking
    .slice()
    .sort(spec.sort)
    .forEach((e) => {
      const row = spec.rows(e);
      lines.push(spec.columns.map((c) => esc(row[c.key] ?? "")).join(";"));
    });

  // BOM so Excel on Windows detects UTF-8 and renders á/ó/ñ correctly.
  return "﻿" + lines.join("\r\n");
}

export function exportFilename(
  stats: ReportsStats,
  variant: ExportVariant,
  ext: "xlsx" | "csv"
): string {
  const label = variant === "all" ? "completo" : SHEETS[variant].name.toLowerCase().replace(/\s+/g, "-");
  return `reporte-asistencia_${label}_${stats.range.from}_a_${stats.range.to}.${ext}`;
}
