/**
 * Time utilities for Lima timezone.
 * Ported from common.py and various Python lambdas.
 */

import { LIMA_TZ, LIMA_OFFSET } from "@/lib/constants/timezone";

/** Get current UTC Date */
export function nowUtc(): Date {
  return new Date();
}

/** Get current Lima time as Date */
export function nowLima(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: LIMA_TZ })
  );
}

/** ISO string in UTC */
export function isoUtc(d?: Date): string {
  return (d ?? new Date()).toISOString();
}

/** ISO string in Lima local time: "2026-03-24T14:30:00-05:00" */
export function isoLima(d?: Date): string {
  const date = d ?? new Date();
  const limaStr = date.toLocaleString("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  // en-CA gives "YYYY-MM-DD, HH:mm:ss" — convert to ISO
  const [datePart, timePart] = limaStr.split(", ");
  return `${datePart}T${timePart}${LIMA_OFFSET}`;
}

/** HH:MM:SS in Lima time */
export function clockLima(d?: Date): string {
  const date = d ?? new Date();
  return date.toLocaleString("en-GB", {
    timeZone: LIMA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** Work date in Lima (YYYY-MM-DD) */
export function workDateLima(d?: Date): string {
  const date = d ?? new Date();
  return date.toLocaleDateString("en-CA", { timeZone: LIMA_TZ });
}

/** Parse ISO string to Date (handles Z and offset formats) */
export function parseIso(s: string): Date {
  return new Date(s.replace("Z", "+00:00"));
}

/** Extract HH:MM:SS from an ISO local datetime string */
export function hhmmssFromIso(isoStr: string | null | undefined): string | null {
  if (!isoStr || isoStr === "-") return null;
  if (isoStr.includes("T")) {
    try {
      const d = parseIso(isoStr);
      return d.toLocaleString("en-GB", {
        timeZone: LIMA_TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      // Try to extract time portion directly
      const match = isoStr.match(/T(\d{2}:\d{2}:\d{2})/);
      return match ? match[1] : isoStr;
    }
  }
  return isoStr;
}

/** Convert "HH:MM" to total minutes */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Format minutes as "HH:MM" */
export function fmtMinutes(mins: number): string {
  const absMin = Math.max(0, Math.abs(mins));
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  const sign = mins < 0 ? "-" : "";
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Build Lima local ISO: "2026-03-24T09:00:00-05:00" */
export function buildLocalIso(dateStr: string, hhmm: string): string {
  return `${dateStr}T${hhmm}:00${LIMA_OFFSET}`;
}

/** Get today's date string in Lima */
export function todayLima(): string {
  return workDateLima();
}

/** Check if a date is a weekday (Mon-Fri) */
export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/** Get Monday through Sunday for a given date's week */
export function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(baseDate);
  monday.setDate(monday.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** ISO week label like "2026-W12" */
export function isoWeekLabel(d: Date): string {
  // Calculate ISO week number
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000
  ) + 1;
  const dayOfWeek = d.getDay() || 7;
  const weekNum = Math.ceil((dayOfYear - dayOfWeek + 10) / 7);

  const year = weekNum === 1 && d.getMonth() === 11
    ? d.getFullYear() + 1
    : weekNum >= 52 && d.getMonth() === 0
      ? d.getFullYear() - 1
      : d.getFullYear();

  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

/** Format date as locale-friendly display */
export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
