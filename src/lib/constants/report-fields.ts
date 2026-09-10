/**
 * Catalogue of the columns a report can carry.
 *
 * One source of truth shared by the three surfaces that render a report:
 *   • the on-screen tables in /admin/reports
 *   • the .xlsx / .csv export (reports-export.service)
 *   • the PDF Lambda (the picked keys travel as a `cols=` query param)
 *
 * Admins pick which of these appear ("selector de datos"), so labels, number
 * formats and column widths must be defined once — a column added here shows
 * up everywhere without touching the three renderers.
 */

export type ReportFieldGroup = "identidad" | "dias" | "horas" | "cumplimiento";

export type ReportFieldKey =
  // identidad
  | "area"
  | "position"
  | "dni"
  | "email"
  // días
  | "daysRecorded"
  | "daysPresent"
  | "absences"
  | "regularizations"
  | "lateDays"
  | "openDays"
  // horas
  | "workedHours"
  | "plannedHours"
  | "deltaHours"
  | "overtimeHours"
  | "missingHours"
  | "breakHours"
  | "avgHoursPerDay"
  // cumplimiento
  | "attendancePct"
  | "punctualityPct"
  | "lateHours";

/**
 * Raw per-period accumulations. Everything else in a report is derived from
 * these, so rolling employees up into an area (or a month, or the whole
 * company) is just a matter of summing field by field.
 */
export interface ReportMetrics {
  /** Days with a DailySummary row in the period, whatever its status. */
  daysRecorded: number;
  /** Days with worked time > 0. */
  daysPresent: number;
  absences: number;
  regularizations: number;
  /** Days the employee clocked in after their tolerance window. */
  lateDays: number;
  /** Shifts left open — clocked in, never clocked out. */
  openDays: number;
  workedHours: number;
  plannedHours: number;
  breakHours: number;
  lateHours: number;
}

/** Identity columns come from the Employees table, not from attendance. */
export interface ReportIdentity {
  area?: string;
  position?: string;
  dni?: string;
  email?: string;
}

export type ReportRow = ReportMetrics & ReportIdentity;

export function emptyMetrics(): ReportMetrics {
  return {
    daysRecorded: 0,
    daysPresent: 0,
    absences: 0,
    regularizations: 0,
    lateDays: 0,
    openDays: 0,
    workedHours: 0,
    plannedHours: 0,
    breakHours: 0,
    lateHours: 0,
  };
}

/** In-place accumulation — rolls employees up into an area, a month or a total. */
export function addMetrics(into: ReportMetrics, from: ReportMetrics): ReportMetrics {
  into.daysRecorded += from.daysRecorded;
  into.daysPresent += from.daysPresent;
  into.absences += from.absences;
  into.regularizations += from.regularizations;
  into.lateDays += from.lateDays;
  into.openDays += from.openDays;
  into.workedHours += from.workedHours;
  into.plannedHours += from.plannedHours;
  into.breakHours += from.breakHours;
  into.lateHours += from.lateHours;
  return into;
}

/* ── Derived metrics ─────────────────────────────────────────────────────── */

export function overtimeHours(m: ReportMetrics): number {
  return Math.max(0, m.workedHours - m.plannedHours);
}

export function missingHours(m: ReportMetrics): number {
  return Math.max(0, m.plannedHours - m.workedHours);
}

export function deltaHours(m: ReportMetrics): number {
  return m.workedHours - m.plannedHours;
}

export function avgHoursPerDay(m: ReportMetrics): number {
  return m.daysPresent > 0 ? m.workedHours / m.daysPresent : 0;
}

/**
 * Capped at 100 on purpose: attendance answers "did they cover the hours they
 * were scheduled for", and overtime does not make someone MORE than present.
 * Overtime is its own column.
 */
export function attendancePct(m: ReportMetrics): number {
  if (m.plannedHours <= 0) return 0;
  return Math.min(100, (m.workedHours / m.plannedHours) * 100);
}

export function punctualityPct(m: ReportMetrics): number {
  if (m.daysPresent <= 0) return 0;
  return Math.max(0, ((m.daysPresent - m.lateDays) / m.daysPresent) * 100);
}

/* ── Field definitions ───────────────────────────────────────────────────── */

export interface ReportFieldDef {
  key: ReportFieldKey;
  label: string;
  /** Compact header for the PDF, where a column is ~60pt wide. */
  short: string;
  group: ReportFieldGroup;
  kind: "text" | "int" | "hours" | "pct";
  /** Excel column width. */
  width: number;
  /** Excel number format. */
  numFmt?: string;
  /** PDF column width, in points. */
  pdfWidth: number;
  /** One-line explanation shown in the picker. */
  hint?: string;
}

export const REPORT_GROUP_LABELS: Record<ReportFieldGroup, string> = {
  identidad: "Identidad",
  dias: "Días",
  horas: "Horas",
  cumplimiento: "Cumplimiento",
};

export const REPORT_FIELDS: ReportFieldDef[] = [
  { key: "area", label: "Área", short: "ÁREA", group: "identidad", kind: "text", width: 20, pdfWidth: 95 },
  { key: "position", label: "Cargo", short: "CARGO", group: "identidad", kind: "text", width: 22, pdfWidth: 95 },
  { key: "dni", label: "DNI", short: "DNI", group: "identidad", kind: "text", width: 14, pdfWidth: 60 },
  { key: "email", label: "Correo", short: "CORREO", group: "identidad", kind: "text", width: 30, pdfWidth: 130 },

  {
    key: "daysRecorded", label: "Días registrados", short: "DÍAS REG.", group: "dias",
    kind: "int", width: 16, pdfWidth: 58,
    hint: "Días con registro en el período, sea cual sea su estado",
  },
  {
    key: "daysPresent", label: "Días presente", short: "DÍAS TRAB.", group: "dias",
    kind: "int", width: 15, pdfWidth: 58,
    hint: "Días con horas trabajadas mayores a cero",
  },
  { key: "absences", label: "Ausencias", short: "FALTAS", group: "dias", kind: "int", width: 12, pdfWidth: 52 },
  {
    key: "regularizations", label: "Regularizaciones", short: "REGUL.", group: "dias",
    kind: "int", width: 17, pdfWidth: 52,
    hint: "Días cuya jornada se corrigió manualmente",
  },
  {
    key: "lateDays", label: "Días con tardanza", short: "TARDES", group: "dias",
    kind: "int", width: 17, pdfWidth: 52,
    hint: "Días en que entró después de su tolerancia",
  },
  {
    key: "openDays", label: "Jornadas sin cerrar", short: "ABIERTAS", group: "dias",
    kind: "int", width: 18, pdfWidth: 56,
    hint: "Marcó entrada pero nunca salida",
  },

  { key: "workedHours", label: "Horas trabajadas", short: "H. TRAB.", group: "horas", kind: "hours", width: 18, numFmt: "0.0", pdfWidth: 60 },
  { key: "plannedHours", label: "Horas planificadas", short: "H. PLAN.", group: "horas", kind: "hours", width: 18, numFmt: "0.0", pdfWidth: 60 },
  {
    key: "deltaHours", label: "Diferencia", short: "DIF.", group: "horas",
    kind: "hours", width: 14, numFmt: "+0.0;-0.0;0.0", pdfWidth: 55,
    hint: "Trabajadas menos planificadas; puede ser negativa",
  },
  { key: "overtimeHours", label: "Horas extra", short: "EXTRA", group: "horas", kind: "hours", width: 14, numFmt: "0.0", pdfWidth: 55 },
  { key: "missingHours", label: "Horas faltantes", short: "FALTAN", group: "horas", kind: "hours", width: 16, numFmt: "0.0", pdfWidth: 55 },
  { key: "breakHours", label: "Horas de break", short: "BREAK", group: "horas", kind: "hours", width: 15, numFmt: "0.0", pdfWidth: 55 },
  {
    key: "avgHoursPerDay", label: "Promedio diario", short: "PROM/DÍA", group: "horas",
    kind: "hours", width: 16, numFmt: "0.0", pdfWidth: 58,
    hint: "Horas trabajadas entre días presente",
  },

  {
    key: "attendancePct", label: "% Asistencia", short: "% ASIST.", group: "cumplimiento",
    kind: "pct", width: 14, numFmt: "0", pdfWidth: 55,
    hint: "Horas trabajadas sobre planificadas, con tope de 100%",
  },
  {
    key: "punctualityPct", label: "% Puntualidad", short: "% PUNT.", group: "cumplimiento",
    kind: "pct", width: 15, numFmt: "0", pdfWidth: 55,
    hint: "Días sin tardanza sobre días presente",
  },
  { key: "lateHours", label: "Horas de tardanza", short: "H. TARDE", group: "cumplimiento", kind: "hours", width: 17, numFmt: "0.0", pdfWidth: 58 },
];

export const REPORT_FIELD_BY_KEY: Record<ReportFieldKey, ReportFieldDef> =
  Object.fromEntries(REPORT_FIELDS.map((f) => [f.key, f])) as Record<
    ReportFieldKey,
    ReportFieldDef
  >;

export const ALL_FIELD_KEYS: ReportFieldKey[] = REPORT_FIELDS.map((f) => f.key);

/** Report views that carry a column picker. */
export type ReportViewKey =
  | "attendance"
  | "hours"
  | "absences"
  | "payroll"
  | "areas"
  | "monthly";

/** What each view shows before an admin touches the picker. */
export const DEFAULT_FIELDS: Record<ReportViewKey, ReportFieldKey[]> = {
  attendance: ["area", "daysPresent", "absences", "attendancePct"],
  hours: ["area", "workedHours", "plannedHours", "deltaHours"],
  absences: ["area", "absences", "regularizations", "missingHours"],
  payroll: ["area", "daysPresent", "workedHours", "overtimeHours"],
  areas: ["daysPresent", "workedHours", "plannedHours", "attendancePct", "absences"],
  monthly: ["area", "workedHours", "daysPresent", "absences"],
};

/**
 * Keep only keys this build knows about, in the catalogue's order — a report's
 * columns then always read in the same sequence no matter what order they were
 * clicked in. Falls back to the view's defaults when nothing valid survives.
 */
export function sanitizeFields(
  keys: readonly string[] | undefined,
  fallback: ReportFieldKey[]
): ReportFieldKey[] {
  if (!keys?.length) return fallback;
  const wanted = new Set(keys);
  const kept = ALL_FIELD_KEYS.filter((k) => wanted.has(k));
  return kept.length > 0 ? kept : fallback;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Value of a field, ready to drop into a spreadsheet cell. */
export function fieldValue(key: ReportFieldKey, row: ReportRow): string | number {
  switch (key) {
    case "area":
      return row.area || "—";
    case "position":
      return row.position || "—";
    case "dni":
      return row.dni || "—";
    case "email":
      return row.email || "—";
    case "daysRecorded":
      return row.daysRecorded;
    case "daysPresent":
      return row.daysPresent;
    case "absences":
      return row.absences;
    case "regularizations":
      return row.regularizations;
    case "lateDays":
      return row.lateDays;
    case "openDays":
      return row.openDays;
    case "workedHours":
      return round1(row.workedHours);
    case "plannedHours":
      return round1(row.plannedHours);
    case "deltaHours":
      return round1(deltaHours(row));
    case "overtimeHours":
      return round1(overtimeHours(row));
    case "missingHours":
      return round1(missingHours(row));
    case "breakHours":
      return round1(row.breakHours);
    case "avgHoursPerDay":
      return round1(avgHoursPerDay(row));
    case "attendancePct":
      return Math.round(attendancePct(row));
    case "punctualityPct":
      return Math.round(punctualityPct(row));
    case "lateHours":
      return round1(row.lateHours);
  }
}

/** Display string for the same field — what the HTML tables render. */
export function fieldDisplay(key: ReportFieldKey, row: ReportRow): string {
  const def = REPORT_FIELD_BY_KEY[key];
  const v = fieldValue(key, row);
  if (def.kind === "text") return String(v);
  if (def.kind === "pct") return `${v}%`;
  if (def.kind === "hours") {
    const n = Number(v);
    const sign = key === "deltaHours" && n >= 0 ? "+" : "";
    return `${sign}${n.toFixed(1)}h`;
  }
  return String(v);
}

/** Sensible default sort for a view: the column the report is "about". */
export const VIEW_SORT_FIELD: Record<ReportViewKey, ReportFieldKey> = {
  attendance: "attendancePct",
  hours: "workedHours",
  absences: "absences",
  payroll: "workedHours",
  areas: "workedHours",
  monthly: "workedHours",
};
