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
import { getHolidaySet } from "@/lib/utils/holidays";
import { withAudit, buildGroupId } from "./audit.service";
import type { SessionUser } from "@/lib/auth-helpers";

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

export async function regularizeSingle(
  params: RegularizeSingleParams,
  actor: SessionUser
) {
  const {
    employeeId,
    workDate,
    startTime = "09:00",
    endTime = "18:00",
    breakMinutes = 60,
    reasonCode,
    reasonNote = "",
    overwrite = false,
  } = params;
  const tenantId = params.tenantId ?? actor.tenantId;

  const code = reasonCode.toUpperCase();
  if (!REASON_LABELS[code]) {
    throw new ValidationError(`reasonCode no soportado: ${code}`);
  }
  if (code === "OTRO" && !reasonNote) {
    throw new ValidationError("El motivo es obligatorio cuando la razón es OTRO");
  }

  // Block holidays: feriados are read-only by policy, they must never be
  // replaced by a manual regularization (single or bulk).
  if (tenantId) {
    const holidaySet = await getHolidaySet(tenantId);
    const holidayName = holidaySet.get(workDate);
    if (holidayName) {
      throw new ValidationError(
        `No puedes regularizar un día feriado (${workDate} · ${holidayName}). Los feriados permanecen fijos.`
      );
    }
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

  // Wrap the upsert with audit so we capture before/after snapshots and can revert.
  const audited = await withAudit(
    {
      actor,
      entityType: "DAILY_SUMMARY",
      entityKey: {
        EmployeeID: employeeId,
        WorkDate: `DATE#${workDate}`,
      },
      action: "UPDATE",
      reason: reasonNote || `Regularización ${code}`,
    },
    async () => upsertDailySummary(item, overwrite)
  );

  return {
    id: regId,
    employeeId,
    workDate,
    reasonCode: code,
    reasonLabel: REASON_LABELS[code],
    result: audited.result,
    auditId: audited.auditId,
  };
}

export async function regularizeRange(
  params: RegularizeRangeParams,
  actor: SessionUser
) {
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
  } = params;
  const tenantId = params.tenantId ?? actor.tenantId;

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
  // Group ID: shared by every audit row produced by this bulk call so the UI
  // can show them as a single entry and revert them as a unit.
  const groupId = buildGroupId();
  let created = 0;
  let overwritten = 0;
  let skipped = 0;
  let ignoredWeekends = 0;
  let ignoredNonPast = 0;
  let ignoredHolidays = 0;
  const processedDates: string[] = [];
  const ignoredHolidayDates: string[] = [];

  // Cargar feriados del tenant una sola vez para todo el rango.
  // Los feriados NUNCA deben ser sobrescritos por una regularización en bloque:
  // permanecen fijos y se saltan igual que los fines de semana.
  const holidaySet = tenantId
    ? await getHolidaySet(tenantId)
    : new Map<string, string>();

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

    if (holidaySet.has(ds)) {
      ignoredHolidays++;
      ignoredHolidayDates.push(ds);
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

    // Each date goes through withAudit so it gets its own before/after snapshot
    // and can be individually reverted. All rows share the same groupId so the
    // UI can treat them as one bulk operation.
    const audited = await withAudit(
      {
        actor,
        entityType: "DAILY_SUMMARY",
        entityKey: {
          EmployeeID: employeeId,
          WorkDate: `DATE#${ds}`,
        },
        action: "BULK_REGULARIZE",
        groupId,
        reason: reasonNote || `Regularización en bloque ${code}`,
      },
      async () => upsertDailySummary(item, overwrite)
    );
    const result = audited.result;
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

  // Write a summary audit row so the UI can render this bulk operation as a
  // single collapsible entry. It carries the totals but no before/after of its
  // own — it only points at the group.
  try {
    await withAudit(
      {
        actor,
        entityType: "DAILY_SUMMARY",
        entityKey: {
          EmployeeID: employeeId,
          WorkDate: `RANGE#${dateFrom}#${dateTo}`,
        },
        action: "BULK_REGULARIZE",
        groupId,
        groupSize: created + overwritten,
        isGroupSummary: true,
        reason:
          `${created + overwritten} día(s) · ` +
          `${ignoredHolidays} feriado(s) respetado(s) · ` +
          `${ignoredWeekends} fin(es) de semana · ` +
          `${skipped} ya existente(s)`,
        skipBeforeRead: true,
      },
      async () => undefined
    );
  } catch (err) {
    console.error("[audit] Failed to write group summary row", err);
  }

  return {
    id: regId,
    groupId,
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
    totalIgnoredHolidays: ignoredHolidays,
    processedDates,
    ignoredHolidayDates,
  };
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
