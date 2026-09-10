import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildReportsCsv,
  buildReportsWorkbook,
  exportFilename,
} from "./reports-export.service";
import type {
  AreaBreakdownEntry,
  EmployeeMonthlyRow,
  EmployeeRankingEntry,
  ReportsStats,
} from "./reports-stats.service";
import { emptyMetrics, type ReportMetrics } from "@/lib/constants/report-fields";

function m(over: Partial<ReportMetrics> = {}): ReportMetrics {
  return { ...emptyMetrics(), ...over };
}

const MONTHS = ["2025-11", "2025-12", "2026-01"];

function employee(
  name: string,
  area: string,
  over: Partial<ReportMetrics>
): EmployeeRankingEntry {
  const metrics = m(over);
  return {
    employeeId: `EMP#${name.toLowerCase()}@x.com`,
    employeeName: name,
    area,
    position: "Analista",
    dni: "12345678",
    email: `${name.toLowerCase()}@x.com`,
    ...metrics,
    deltaHours: metrics.workedHours - metrics.plannedHours,
  };
}

const ana = employee("Ana", "Ventas", {
  daysRecorded: 60, daysPresent: 58, absences: 2, workedHours: 460,
  plannedHours: 480, lateDays: 3, breakHours: 40, lateHours: 1.5,
});
const beto = employee("Beto", "Ventas", {
  daysRecorded: 60, daysPresent: 60, workedHours: 500,
  plannedHours: 480, breakHours: 45,
});
const caro = employee("Caro", "Consultoría", {
  daysRecorded: 40, daysPresent: 38, absences: 2, workedHours: 300,
  plannedHours: 320, lateDays: 1, breakHours: 30,
});

/** Caro has no records in 2026-01 — that cell must stay blank, not become 0. */
const monthly: EmployeeMonthlyRow[] = [
  {
    employeeId: ana.employeeId, employeeName: "Ana", area: "Ventas",
    byMonth: {
      "2025-11": m({ workedHours: 150, daysPresent: 20 }),
      "2025-12": m({ workedHours: 150, daysPresent: 19 }),
      "2026-01": m({ workedHours: 160, daysPresent: 19 }),
    },
    total: m({ workedHours: 460, daysPresent: 58 }),
  },
  {
    employeeId: caro.employeeId, employeeName: "Caro", area: "Consultoría",
    byMonth: {
      "2025-11": m({ workedHours: 150, daysPresent: 19 }),
      "2025-12": m({ workedHours: 150, daysPresent: 19 }),
    },
    total: m({ workedHours: 300, daysPresent: 38 }),
  },
];

const areas: AreaBreakdownEntry[] = [
  {
    areaId: "ventas", area: "Ventas", headcount: 2, withRecords: 2,
    ...m({ daysRecorded: 120, daysPresent: 118, absences: 2, workedHours: 960, plannedHours: 960 }),
    deltaHours: 0,
  },
  {
    areaId: "consultoria", area: "Consultoría", headcount: 3, withRecords: 1,
    ...m({ daysRecorded: 40, daysPresent: 38, absences: 2, workedHours: 300, plannedHours: 320 }),
    deltaHours: -20,
  },
];

const stats: ReportsStats = {
  range: { from: "2025-11-01", to: "2026-01-31" },
  months: MONTHS,
  filters: { areas: [], employeeIds: [], months: MONTHS },
  totals: {
    ...m({ daysRecorded: 160, daysPresent: 156, absences: 4, workedHours: 1260, plannedHours: 1280 }),
    employees: 3,
    rosterSize: 5,
  },
  monthlyTrend: MONTHS.map((month) => ({
    month,
    ...m({ workedHours: 420, plannedHours: 430, daysPresent: 52, absences: 1 }),
    employees: 3,
  })),
  yearlyTrend: [
    { year: "2025", ...m({ workedHours: 900, plannedHours: 920 }), employees: 3, monthsWithData: 2 },
    { year: "2026", ...m({ workedHours: 360, plannedHours: 360 }), employees: 2, monthsWithData: 1 },
  ],
  employeeRanking: [beto, ana, caro],
  employeeMonthly: monthly,
  areaBreakdown: areas,
  statusDistribution: { OK: 140, ABSENCE: 4 },
  entryHeatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
  availableAreas: [
    { id: "consultoria", label: "Consultoría", headcount: 3 },
    { id: "ventas", label: "Ventas", headcount: 2 },
  ],
};

/** Split a generated CSV back into rows of cells. */
function csvRows(csv: string): string[][] {
  return csv
    .replace(/^﻿/, "")
    .split("\r\n")
    .map((line) => line.split(";"));
}

describe("buildReportsCsv — employee views", () => {
  it("renders exactly the picked columns, in catalogue order", () => {
    const rows = csvRows(buildReportsCsv(stats, "hours", ["workedHours", "area"]));
    expect(rows[0]).toEqual(["Empleado", "Área", "Horas trabajadas"]);
  });

  it("sorts by whatever the view is about", () => {
    const byHours = csvRows(buildReportsCsv(stats, "hours", ["workedHours"]));
    expect(byHours.slice(1).map((r) => r[0])).toEqual(["Beto", "Ana", "Caro"]);

    const byAbsences = csvRows(buildReportsCsv(stats, "absences", ["absences"]));
    // Ana and Caro both have 2; Beto has none and must come last.
    expect(byAbsences.at(-1)?.[0]).toBe("Beto");
  });

  it("quotes values that would otherwise break the separator", () => {
    const withComma = {
      ...stats,
      employeeRanking: [{ ...ana, employeeName: 'Ana "La Jefa"; Torres' }],
    };
    const csv = buildReportsCsv(withComma, "hours", ["workedHours"]);
    expect(csv).toContain('"Ana ""La Jefa""; Torres"');
  });
});

describe("buildReportsCsv — areas", () => {
  it("leads with the area, its headcount and how many had records", () => {
    const rows = csvRows(buildReportsCsv(stats, "areas", ["workedHours", "attendancePct"]));
    expect(rows[0]).toEqual([
      "Área", "Personas", "Con registros", "Horas trabajadas", "% Asistencia",
    ]);
    expect(rows[1]).toEqual(["Ventas", "2", "2", "960", "100"]);
    expect(rows[2]).toEqual(["Consultoría", "3", "1", "300", "94"]);
  });

  it("drops identity columns that mean nothing once people are aggregated", () => {
    const rows = csvRows(buildReportsCsv(stats, "areas", ["dni", "workedHours"]));
    expect(rows[0]).not.toContain("DNI");
  });
});

describe("buildReportsCsv — monthly and yearly matrices", () => {
  it("puts one column per month and a total", () => {
    const rows = csvRows(buildReportsCsv(stats, "monthly", ["workedHours"]));
    expect(rows[0]).toEqual([
      "Empleado", "Área", "Nov 2025", "Dic 2025", "Ene 2026", "Total (Horas trabajadas)",
    ]);
    expect(rows[1]).toEqual(["Ana", "Ventas", "150", "150", "160", "460"]);
  });

  it("leaves a month without records blank instead of zero", () => {
    const rows = csvRows(buildReportsCsv(stats, "monthly", ["workedHours"]));
    const caroRow = rows.find((r) => r[0] === "Caro");
    // "didn't work" and "wasn't on staff yet" must not look the same.
    expect(caroRow?.[4]).toBe("");
  });

  it("rolls months up into years", () => {
    const rows = csvRows(buildReportsCsv(stats, "yearly", ["workedHours"]));
    expect(rows[0].slice(2)).toEqual(["2025", "2026", "Total (Horas trabajadas)"]);
    expect(rows.find((r) => r[0] === "Ana")?.slice(2)).toEqual(["300", "160", "460"]);
    // Caro has no 2026 month at all.
    expect(rows.find((r) => r[0] === "Caro")?.slice(2)).toEqual(["300", "", "300"]);
  });
});

describe("exportFilename", () => {
  it("names the variant and the period", () => {
    expect(exportFilename(stats, "areas", "xlsx")).toBe(
      "reporte-asistencia_por-area_2025-11-01_a_2026-01-31.xlsx"
    );
  });

  it("says in the filename that the data was filtered by area", () => {
    const filtered = { ...stats, filters: { ...stats.filters, areas: ["Consultoría"] } };
    // A file that does not say it was filtered gets mistaken for the whole
    // company the moment somebody forwards it.
    expect(exportFilename(filtered, "hours", "csv")).toBe(
      "reporte-asistencia_horas_consultoria_2025-11-01_a_2026-01-31.csv"
    );
  });

  it("summarises a multi-area filter", () => {
    const filtered = { ...stats, filters: { ...stats.filters, areas: ["Ventas", "Consultoría"] } };
    expect(exportFilename(filtered, "all", "xlsx")).toContain("_2-areas_");
  });
});

describe("buildReportsWorkbook", () => {
  async function load(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return wb;
  }

  it("puts every view in the full workbook", async () => {
    const wb = await load(
      await buildReportsWorkbook(stats, { tenantName: "ACME", variant: "all" })
    );
    const names = wb.worksheets.map((s) => s.name);
    expect(names).toContain("Resumen");
    expect(names).toContain("Asistencia");
    expect(names).toContain("Para nómina");
    expect(names).toContain("Por área");
    expect(names).toContain("Tendencia mensual");
    expect(names.some((n) => n.startsWith("Mensual ·"))).toBe(true);
    expect(names).toContain("Anual");
  });

  it("builds only the requested variant otherwise", async () => {
    const wb = await load(
      await buildReportsWorkbook(stats, { tenantName: "ACME", variant: "areas" })
    );
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Resumen", "Por área"]);
  });

  it("adds an area heading and a subtotal row when grouping", async () => {
    const wb = await load(
      await buildReportsWorkbook(stats, {
        tenantName: "ACME",
        variant: "hours",
        fields: ["area", "workedHours"],
        groupByArea: true,
      })
    );
    const sheet = wb.getWorksheet("Horas trabajadas")!;
    const firstCol = sheet.getColumn(1).values.map((v) => String(v ?? ""));
    expect(firstCol).toContain("Ventas (2)");
    expect(firstCol).toContain("Subtotal Ventas");
    // The area is the group heading, so it stops being a repeated column.
    expect(sheet.getRow(1).values).not.toContain("Área");
  });

  it("records the active filters in the summary sheet", async () => {
    const filtered = {
      ...stats,
      filters: { areas: ["Ventas"], employeeIds: ["EMP#ana@x.com"], months: MONTHS },
    };
    const wb = await load(
      await buildReportsWorkbook(filtered, { tenantName: "ACME SAC", variant: "hours" })
    );
    const text = wb
      .getWorksheet("Resumen")!
      .getColumn(1)
      .values.map((v) => String(v ?? ""))
      .join("|");
    expect(text).toContain("Áreas incluidas");
    expect(text).toContain("Empleados seleccionados");
    expect(text).toContain("Meses incluidos");
  });

  it("keeps sheet names inside Excel's 31-character limit", async () => {
    const wb = await load(
      await buildReportsWorkbook(stats, {
        tenantName: "ACME",
        variant: "monthly",
        fields: ["punctualityPct", "avgHoursPerDay"],
      })
    );
    for (const sheet of wb.worksheets) {
      expect(sheet.name.length, sheet.name).toBeLessThanOrEqual(31);
    }
  });
});
