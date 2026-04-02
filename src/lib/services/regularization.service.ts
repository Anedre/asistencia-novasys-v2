/**
 * Regularization business logic.
 * Ported from asistencia-regularize-range.py
 */

import { upsertDailySummary } from "@/lib/db/daily-summary";
import {
  REASON_LABELS,
  ABSENCE_REASONS,
  WORKDAY_REASONS,
} from "@/lib/constants/reason-codes";
import { LIMA_OFFSET } from "@/lib/constants/timezone";
import { ValidationError } from "@/lib/utils/errors";

interface RegularizeSingleParams {
  employeeId: string;
  workDate: string;
  startTime?: string; // "09:00"
  endTime?: string; // "18:00"
  breakMinutes?: number;
  reasonCode: string;
  reasonNote?: string;
  overwrite?: boolean;
  tenantId?: string;
}

interface RegularizeRangeParams {
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  reasonCode: string;
  reasonNote?: string;
  weekdaysOnly?: boolean;
  pastDatesOnly?: boolean;
  overwrite?: boolean;
  tenantId?: string;
}

function buildRegId(): string {
  const ts = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `REGRANGE#${ts}#${id}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function buildLocalIso(dateStr: string, hhmm: string): string {
  return `${dateStr}T${hhmm}:00${LIMA_OFFSET}`;
}

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

function isPastDate(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function buildAbsenceItem(
  employeeId: string,
  ds: string,
  reasonCode: string,
  reasonNote: string,
  regId: string,
  planned = 480
): Record<string, unknown> {
  const nowIso = new Date().toISOString();
  return {
    EmployeeID: employeeId,
    WorkDate: `DATE#${ds}`,
    firstIn: "-",
    lastOut: "-",
    firstInLocal: "-",
    lastOutLocal: "-",
    breakMinutes: 0,
    workedMinutes: 0,
    plannedMinutes: planned,
    deltaMinutes: -planned,
    status: "ABSENCE",
    source: "REGULARIZATION_RANGE",
    regularizationMode: "DATE_RANGE",
    regularizationId: regId,
    regularizationReasonCode: reasonCode,
    regularizationReasonLabel: REASON_LABELS[reasonCode] ?? reasonCode,
    regularizationNote: reasonNote,
    updatedAt: nowIso,
    updatedAtLocal: `${ds}T00:00:00${LIMA_OFFSET}`,
    anomalies: [],
    eventsCount: 0,
  };
}

function buildWorkdayItem(
  employeeId: string,
  ds: string,
  startHhmm: string,
  endHhmm: string,
  breakMinutes: number,
  reasonCode: string,
  reasonNote: string,
  regId: string,
  planned = 480
): Record<string, unknown> {
  const total = hhmmToMinutes(endHhmm) - hhmmToMinutes(startHhmm);
  if (total < 0) {
    throw new ValidationError(
      `La hora fin no puede ser menor que la hora inicio para ${ds}`
    );
  }

  const workedMinutes = Math.max(0, total - breakMinutes);
  const plannedMinutes = planned;
  const deltaMinutes = workedMinutes - plannedMinutes;
  const nowIso = new Date().toISOString();

  return {
    EmployeeID: employeeId,
    WorkDate: `DATE#${ds}`,
    firstIn: startHhmm,
    lastOut: endHhmm,
    firstInLocal: buildLocalIso(ds, startHhmm),
    lastOutLocal: buildLocalIso(ds, endHhmm),
    breakMinutes,
    workedMinutes,
    plannedMinutes,
    deltaMinutes,
    status: "REGULARIZED",
    source: "REGULARIZATION_RANGE",
    regularizationMode: "DATE_RANGE",
    regularizationId: regId,
    regularizationReasonCode: reasonCode,
    regularizationReasonLabel: REASON_LABELS[reasonCode] ?? reasonCode,
    regularizationNote: reasonNote,
    updatedAt: nowIso,
    updatedAtLocal: buildLocalIso(ds, endHhmm),
    anomalies: [],
    eventsCount: 0,
  };
}

export async function regularizeSingle(params: RegularizeSingleParams) {
  const {
    employeeId,
    workDate,
    startTime = "09:00",
    endTime = "18:00",
    breakMinutes = 60,
    reasonCode,
    reasonNote = "",
    overwrite = false,
    tenantId,
  } = params;

  const code = reasonCode.toUpperCase();
  if (!REASON_LABELS[code]) {
    throw new ValidationError(`reasonCode no soportado: ${code}`);
  }
  if (code === "OTRO" && !reasonNote) {
    throw new ValidationError("El motivo es obligatorio cuando la razón es OTRO");
  }

  const regId = buildRegId();
  let item: Record<string, unknown>;

  if (ABSENCE_REASONS.has(code)) {
    item = buildAbsenceItem(employeeId, workDate, code, reasonNote, regId);
  } else {
    item = buildWorkdayItem(
      employeeId, workDate, startTime, endTime, breakMinutes, code, reasonNote, regId
    );
  }

  if (tenantId) item.TenantID = tenantId;

  const result = await upsertDailySummary(item, overwrite);

  return {
    id: regId,
    employeeId,
    workDate,
    reasonCode: code,
    reasonLabel: REASON_LABELS[code],
    result,
  };
}

export async function regularizeRange(params: RegularizeRangeParams) {
  const {
    employeeId,
    dateFrom,
    dateTo,
    startTime = "09:00",
    endTime = "18:00",
    breakMinutes = 60,
    reasonCode,
    reasonNote = "",
    weekdaysOnly = true,
    pastDatesOnly = true,
    overwrite = false,
    tenantId,
  } = params;

  const code = reasonCode.toUpperCase();
  if (!REASON_LABELS[code]) {
    throw new ValidationError(`reasonCode no soportado: ${code}`);
  }
  if (code === "OTRO" && !reasonNote) {
    throw new ValidationError("El motivo es obligatorio cuando la razón es OTRO");
  }

  const startD = new Date(dateFrom + "T12:00:00");
  const endD = new Date(dateTo + "T12:00:00");
  if (endD < startD) {
    throw new ValidationError("dateTo no puede ser menor que dateFrom");
  }

  if (WORKDAY_REASONS.has(code) && (!startTime || !endTime)) {
    throw new ValidationError("Falta startTime o endTime para esta razón");
  }

  const regId = buildRegId();
  let created = 0;
  let overwritten = 0;
  let skipped = 0;
  let ignoredWeekends = 0;
  let ignoredNonPast = 0;
  const processedDates: string[] = [];

  const current = new Date(startD);
  while (current <= endD) {
    const ds = formatDate(current);

    if (weekdaysOnly && !isWeekday(current)) {
      ignoredWeekends++;
      current.setDate(current.getDate() + 1);
      continue;
    }

    if (pastDatesOnly && !isPastDate(current)) {
      ignoredNonPast++;
      current.setDate(current.getDate() + 1);
      continue;
    }

    let item: Record<string, unknown>;
    if (ABSENCE_REASONS.has(code)) {
      item = buildAbsenceItem(employeeId, ds, code, reasonNote, regId);
    } else {
      item = buildWorkdayItem(
        employeeId, ds, startTime, endTime, breakMinutes, code, reasonNote, regId
      );
    }

    if (tenantId) item.TenantID = tenantId;

    const result = await upsertDailySummary(item, overwrite);
    if (result === "CREATED") {
      created++;
      processedDates.push(ds);
    } else if (result === "OVERWRITTEN") {
      overwritten++;
      processedDates.push(ds);
    } else {
      skipped++;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    id: regId,
    employeeId,
    dateFrom,
    dateTo,
    reasonCode: code,
    reasonLabel: REASON_LABELS[code],
    overwrite,
    weekdaysOnly,
    pastDatesOnly,
    totalCreated: created,
    totalOverwritten: overwritten,
    totalSkipped: skipped,
    totalIgnoredWeekends: ignoredWeekends,
    totalIgnoredNonPast: ignoredNonPast,
    processedDates,
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
