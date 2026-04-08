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
  | HolidaysBlock
  | TeamStatsBlock
  | AuditListBlock
  | PendingRequestsBlock
  | InvitationPreviewBlock
  | InvitationCreatedBlock
  | SettingPreviewBlock
  | SettingUpdatedBlock
  | RevertPreviewBlock
  | RevertDoneBlock
  | InfoBlock
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
  employeeName?: string;
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
    reviewedAt: string | null;
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

// ── New blocks for the agentic bot ──────────────────────────────────

export interface HolidaysBlock {
  type: "holidays";
  totalConfigured: number;
  holidays: {
    date: string;
    name: string;
    daysUntil: number;
    monthShort: string;
    day: string;
  }[];
}

export interface TeamStatsBlock {
  type: "team_stats";
  from: string;
  to: string;
  totals: {
    totalEmployees: number;
    totalWorkedHours: number;
    totalPlannedHours: number;
    totalAbsences: number;
    totalRegularizations: number;
    totalDays: number;
  };
  topEmployees: {
    name: string;
    hours: number;
    absences: number;
  }[];
  statusDistribution: { status: string; count: number }[];
}

export interface AuditListBlock {
  type: "audit_list";
  total: number;
  items: {
    auditId: string;
    action: string;
    entityType: string;
    entityLabel: string;
    actor: string;
    createdAt: string;
    reverted: boolean;
  }[];
}

export interface PendingRequestsBlock {
  type: "pending_requests";
  total: number;
  byType: { type: string; count: number }[];
  sample: {
    id: string;
    employee: string;
    type: string;
    from: string | null;
    to: string | null;
    reason: string;
    createdAt: string;
  }[];
}

export interface InvitationPreviewBlock {
  type: "invitation_preview";
  email: string;
  fullName?: string;
  area?: string;
  position?: string;
  role: string;
}

export interface InvitationCreatedBlock {
  type: "invitation_created";
  email: string;
  inviteLink: string;
  emailSent: boolean;
}

export interface SettingPreviewBlock {
  type: "setting_preview";
  key: string;
  newValue: unknown;
}

export interface SettingUpdatedBlock {
  type: "setting_updated";
  key: string;
  newValue: unknown;
}

export interface RevertPreviewBlock {
  type: "revert_preview";
  auditId: string;
}

export interface RevertDoneBlock {
  type: "revert_done";
  auditId: string;
  revertAuditId: string;
}

/** Generic info fallback — shows a neutral card with title + message. */
export interface InfoBlock {
  type: "info";
  title: string;
  message: string;
}
