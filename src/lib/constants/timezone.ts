/**
 * Lima timezone utilities.
 * Ported from common.py and asistencia-record-event.py
 */

export const LIMA_TZ = "America/Lima";
export const LIMA_OFFSET = "-05:00";
export const LIMA_OFFSET_HOURS = -5;

/** Default work schedule */
export const DEFAULT_SCHEDULE = {
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
  plannedMinutes: 480, // 8 hours
} as const;
