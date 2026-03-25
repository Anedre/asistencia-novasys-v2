/**
 * Attendance business logic — state machine + record event.
 * Ported from asistencia-record-event.py
 */

import {
  applyStart,
  applyBreakStart,
  applyBreakEnd,
  applyEnd,
  recalcDay,
  getDailySummary,
  getDailySummaryRange,
} from "@/lib/db/daily-summary";
import { putAttendanceEvent, getEventsByEmployeeAndDate } from "@/lib/db/attendance";
import { isoUtc, isoLima, clockLima, workDateLima } from "@/lib/utils/time";
import { ALLOWED_EVENT_TYPES } from "@/lib/constants/event-types";
import { ConflictError, ValidationError } from "@/lib/utils/errors";
import type {
  EventType,
  AttendanceEvent,
  TodayStatus,
  WeekDay,
  WeekSummary,
  DayStatus,
} from "@/lib/types";

interface RecordEventParams {
  employeeId: string;
  eventType: EventType;
  note?: string;
  clientTime?: string;
  deviceId?: string;
  ip: string;
  userAgent: string;
}

export async function recordEvent(params: RecordEventParams) {
  const { employeeId, eventType, note, clientTime, deviceId, ip, userAgent } =
    params;

  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    throw new ValidationError(`eventType inválido: ${eventType}`);
  }

  const now = new Date();
  const serverTsUtc = isoUtc(now);
  const serverTsLocal = isoLima(now);
  const serverClockLocal = clockLima(now);
  const workDate = workDateLima(now);

  // 1) Apply to daily summary (state machine with ConditionExpressions)
  try {
    switch (eventType) {
      case "START":
        await applyStart(employeeId, workDate, serverTsUtc, serverTsLocal);
        break;
      case "BREAK_START":
        await applyBreakStart(employeeId, workDate, serverTsUtc, serverTsLocal);
        break;
      case "BREAK_END":
        await applyBreakEnd(employeeId, workDate, serverTsUtc, serverTsLocal);
        break;
      case "END":
        await applyEnd(employeeId, workDate, serverTsUtc, serverTsLocal);
        break;
    }
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.name === "ConditionalCheckFailedException"
    ) {
      throw new ConflictError(
        `No se puede registrar ${eventType} en el estado actual`
      );
    }
    throw error;
  }

  // 2) Store auditable event
  const event: AttendanceEvent = {
    EmployeeID: employeeId,
    EventTS: `TS#${serverTsUtc}`,
    eventType,
    source: "WEB",
    serverTimeUtc: serverTsUtc,
    serverTimeLocal: serverTsLocal,
    serverClockLocal,
    clientTime: clientTime || "",
    workDate,
    note: note || "",
    ip,
    userAgent,
    deviceId: deviceId || "",
    GSI1PK: `DATE#${workDate}`,
    GSI1SK: `${employeeId}#TS#${serverTsUtc}`,
  };

  await putAttendanceEvent(event);

  // 3) Recalculate day totals
  await recalcDay(employeeId, workDate);

  return {
    employeeId,
    workDate,
    serverTimeUtc: serverTsUtc,
    serverTimeLocal: serverTsLocal,
    serverClockLocal,
    message: `${eventType} OK. Hora Lima: ${serverClockLocal}`,
  };
}

/** Get today's status for an employee. Ported from asistencia-get-today-status.py */
export async function getTodayStatus(employeeId: string): Promise<TodayStatus> {
  const todayDate = workDateLima();
  const item = await getDailySummary(employeeId, todayDate);

  if (!item) {
    return {
      employeeId,
      date: todayDate,
      status: "NO_RECORD",
      firstInLocal: null,
      lastOutLocal: null,
      breakStartLocal: null,
      breakMinutes: 0,
      workedMinutes: 0,
      workedHHMM: "00:00",
      plannedMinutes: 480,
      deltaMinutes: -480,
      deltaHHMM: "-08:00",
      hasOpenBreak: false,
      hasOpenShift: false,
      anomalies: [],
    };
  }

  const breakMinutes = Number(item.breakMinutes ?? 0);
  const workedMinutes = Number(item.workedMinutes ?? 0);
  const plannedMinutes = Number(item.plannedMinutes ?? 480);
  const deltaMinutes = Number(item.deltaMinutes ?? workedMinutes - plannedMinutes);

  return {
    employeeId,
    date: todayDate,
    status: item.status as DayStatus,
    firstInLocal: extractTime(item.firstInLocal),
    lastOutLocal: extractTime(item.lastOutLocal),
    breakStartLocal: extractTime(item.breakStartLocal),
    breakMinutes,
    workedMinutes,
    workedHHMM: fmtMin(workedMinutes),
    plannedMinutes,
    deltaMinutes,
    deltaHHMM: fmtDelta(deltaMinutes),
    hasOpenBreak: !!item.breakStartUtc,
    hasOpenShift: !!item.firstInUtc && !item.lastOutUtc,
    anomalies: item.anomalies ?? [],
    updatedAt: item.updatedAt,
  };
}

/** Get week summary. Ported from asistencia-get-week.py */
export async function getWeekSummary(
  employeeId: string,
  offset = 0
): Promise<WeekSummary> {
  const now = new Date();
  const limaDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Lima" })
  );
  limaDate.setDate(limaDate.getDate() + offset * 7);

  // Get Monday
  const day = limaDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(limaDate);
  monday.setDate(monday.getDate() + mondayOffset);

  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }

  const dateFrom = formatDate(dates[0]);
  const dateTo = formatDate(dates[6]);

  const items = await getDailySummaryRange(employeeId, dateFrom, dateTo);
  const byDate = new Map<string, typeof items[0]>();
  for (const it of items) {
    byDate.set(it.WorkDate.replace("DATE#", ""), it);
  }

  let totalWorked = 0;
  let totalBreak = 0;
  let totalPlanned = 0;

  const days: WeekDay[] = dates.map((d) => {
    const ds = formatDate(d);
    const item = byDate.get(ds);
    const weekday = d.toLocaleDateString("es-PE", { weekday: "short" });

    if (!item) {
      totalPlanned += 480;
      return {
        date: ds,
        weekday,
        firstInLocal: null,
        lastOutLocal: null,
        breakMinutes: 0,
        workedMinutes: 0,
        workedHHMM: "00:00",
        deltaMinutes: -480,
        deltaHHMM: "-08:00",
        status: "MISSING" as DayStatus,
        anomalies: [],
      };
    }

    const worked = Number(item.workedMinutes ?? 0);
    const planned = Number(item.plannedMinutes ?? 480);
    const delta = Number(item.deltaMinutes ?? worked - planned);
    const brk = Number(item.breakMinutes ?? 0);

    totalWorked += worked;
    totalBreak += brk;
    totalPlanned += planned;

    return {
      date: ds,
      weekday,
      firstInLocal: extractTime(item.firstInLocal),
      lastOutLocal: extractTime(item.lastOutLocal),
      breakMinutes: brk,
      workedMinutes: worked,
      workedHHMM: fmtMin(worked),
      deltaMinutes: delta,
      deltaHHMM: fmtDelta(delta),
      status: (item.status as DayStatus) ?? "OPEN",
      anomalies: item.anomalies ?? [],
    };
  });

  const weekDelta = totalWorked - totalPlanned;

  // ISO week label
  const isoDate = dates[0];
  const jan4 = new Date(isoDate.getFullYear(), 0, 4);
  const dayOfYear =
    Math.floor((isoDate.getTime() - new Date(isoDate.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
  const dayOfWeek = isoDate.getDay() || 7;
  const weekNum = Math.ceil((dayOfYear - dayOfWeek + 10) / 7);
  const weekLabel = `${isoDate.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

  return {
    employeeId,
    week: weekLabel,
    offset,
    fromDate: dateFrom,
    toDate: dateTo,
    totalWorkedMinutes: totalWorked,
    totalWorkedHHMM: fmtMin(totalWorked),
    totalBreakMinutes: totalBreak,
    totalPlannedMinutes: totalPlanned,
    totalDeltaMinutes: weekDelta,
    totalDeltaHHMM: fmtDelta(weekDelta),
    days,
  };
}

/** Get attendance history for a date range */
export async function getAttendanceHistory(
  employeeId: string,
  dateFrom: string,
  dateTo: string
) {
  const items = await getDailySummaryRange(employeeId, dateFrom, dateTo);
  return items.map((item) => ({
    date: item.WorkDate.replace("DATE#", ""),
    firstInLocal: extractTime(item.firstInLocal),
    lastOutLocal: extractTime(item.lastOutLocal),
    breakMinutes: Number(item.breakMinutes ?? 0),
    workedMinutes: Number(item.workedMinutes ?? 0),
    workedHHMM: fmtMin(Number(item.workedMinutes ?? 0)),
    status: item.status,
    reasonCode: item.regularizationReasonCode ?? "",
    reasonLabel: item.regularizationReasonLabel ?? "",
    reasonNote: item.regularizationNote ?? "",
    anomalies: item.anomalies ?? [],
  }));
}

// ── Helpers ──

function extractTime(isoStr: string | undefined | null): string | null {
  if (!isoStr || isoStr === "-") return null;
  if (isoStr.includes("T")) {
    try {
      const match = isoStr.match(/T(\d{2}:\d{2}:\d{2})/);
      return match ? match[1] : isoStr;
    } catch {
      return isoStr;
    }
  }
  return isoStr;
}

function fmtMin(mins: number): string {
  const abs = Math.max(0, Math.abs(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtDelta(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  return `${sign}${fmtMin(Math.abs(mins))}`;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
