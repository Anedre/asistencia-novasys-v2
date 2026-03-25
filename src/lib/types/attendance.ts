export type EventType = "START" | "BREAK_START" | "BREAK_END" | "END";
export type EventSource = "WEB" | "MOBILE" | "REGULARIZATION" | "REGULARIZATION_RANGE" | "SYSTEM";

export type DayStatus =
  | "OPEN"
  | "CLOSED"
  | "REGULARIZED"
  | "ABSENCE"
  | "OK"
  | "SHORT"
  | "MISSING"
  | "NO_RECORD";

export interface AttendanceEvent {
  EmployeeID: string;
  EventTS: string; // "TS#2026-03-24T..."
  eventType: EventType;
  source: EventSource;
  serverTimeUtc: string;
  serverTimeLocal: string;
  serverClockLocal: string; // "HH:MM:SS"
  clientTime?: string;
  workDate: string; // "2026-03-24"
  note?: string;
  ip: string;
  userAgent: string;
  deviceId?: string;
  // GSI fields
  GSI1PK?: string; // "DATE#2026-03-24"
  GSI1SK?: string; // "EMP#...#TS#..."
}

export interface DailySummary {
  EmployeeID: string;
  WorkDate: string; // "DATE#2026-03-24"
  firstInUtc?: string;
  firstInLocal?: string;
  lastOutUtc?: string;
  lastOutLocal?: string;
  breakStartUtc?: string;
  breakStartLocal?: string;
  breakMinutes: number;
  workedMinutes: number;
  plannedMinutes: number;
  deltaMinutes: number;
  status: DayStatus;
  source: EventSource;
  regularizationId?: string;
  regularizationMode?: string;
  regularizationReasonCode?: string;
  regularizationReasonLabel?: string;
  regularizationNote?: string;
  anomalies: string[];
  eventsCount: number;
  updatedAt: string;
  updatedAtLocal?: string;
}

export interface TodayStatus {
  employeeId: string;
  date: string;
  status: DayStatus;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakStartLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  workedHHMM: string;
  plannedMinutes: number;
  deltaMinutes: number;
  deltaHHMM: string;
  hasOpenBreak: boolean;
  hasOpenShift: boolean;
  anomalies: string[];
  updatedAt?: string;
}

export interface WeekDay {
  date: string;
  weekday: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  workedHHMM: string;
  deltaMinutes: number;
  deltaHHMM: string;
  status: DayStatus;
  anomalies: string[];
}

export interface WeekSummary {
  employeeId: string;
  week: string; // "2026-W12"
  offset: number;
  fromDate: string;
  toDate: string;
  totalWorkedMinutes: number;
  totalWorkedHHMM: string;
  totalBreakMinutes: number;
  totalPlannedMinutes: number;
  totalDeltaMinutes: number;
  totalDeltaHHMM: string;
  days: WeekDay[];
}

export interface RecordEventInput {
  eventType: EventType;
  note?: string;
  clientTime?: string;
  deviceId?: string;
}

export interface RecordEventResult {
  employeeId: string;
  workDate: string;
  serverTimeUtc: string;
  serverTimeLocal: string;
  serverClockLocal: string;
  message: string;
}
