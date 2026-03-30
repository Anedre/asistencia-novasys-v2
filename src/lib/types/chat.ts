export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Rich UI blocks returned by tool calls — only stored client-side, not in DynamoDB */
  blocks?: UIBlock[];
}

export interface ChatSession {
  SessionID: string; // "CSESS#uuid"
  EmployeeID: string;
  TenantID: string;
  Title: string;
  Messages: AIChatMessage[];
  Model: string; // "anthropic.claude-3-haiku-20240307-v1:0"
  CreatedAt: string;
  UpdatedAt: string;
}

// ── Rich UI Blocks ──────────────────────────────────────────────────
export type UIBlock =
  | AttendanceTodayBlock
  | WeekSummaryBlock
  | RequestCreatedBlock
  | RequestListBlock
  | AttendanceRecordedBlock
  | ErrorBlock;

export interface AttendanceTodayBlock {
  type: "attendance_today";
  date: string;
  status: string;
  firstIn: string;
  lastOut: string;
  workedHHMM: string;
  plannedMinutes: number;
  deltaHHMM: string;
  hasOpenShift: boolean;
  breakMinutes: number;
}

export interface WeekSummaryBlock {
  type: "week_summary";
  week: string;
  fromDate: string;
  toDate: string;
  totalWorkedHHMM: string;
  totalPlannedMinutes: number;
  totalDeltaHHMM: string;
  days: {
    date: string;
    weekday: string;
    status: string;
    firstIn: string;
    lastOut: string;
    workedHHMM: string;
    deltaHHMM: string;
  }[];
}

export interface RequestCreatedBlock {
  type: "request_created";
  requestId: string;
  requestType: string;
  status: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  reasonCode: string;
}

export interface RequestListBlock {
  type: "request_list";
  total: number;
  requests: {
    id: string;
    type: string;
    status: string;
    date: string;
    reasonCode: string;
    createdAt: string;
    reviewedBy: string | null;
  }[];
}

export interface AttendanceRecordedBlock {
  type: "attendance_recorded";
  eventType: string;
  time: string;
}

export interface ErrorBlock {
  type: "error";
  message: string;
}
