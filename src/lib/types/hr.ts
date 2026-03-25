export type HREventType = "BIRTHDAY" | "WORK_ANNIVERSARY" | "ANNOUNCEMENT" | "HOLIDAY";
export type HREventStatus = "ACTIVE" | "ARCHIVED";

export interface HREvent {
  NotificationID: string;
  Type: HREventType;
  EmployeeID?: string;
  EmployeeName?: string;
  EventDate: string;
  EventMonth: string; // "2026-03"
  Title: string;
  Message: string;
  Status: HREventStatus;
  Audience?: string;
  Reactions?: Record<string, string[]>; // { "👍": ["EMP#user1"], "❤️": ["EMP#user2"] }
  ImageUrl?: string;
  CreatedBy?: string;
  CreatedAt?: string;
  // Anniversary-specific
  HasBonus?: boolean;
  Years?: number;
  IsQuinquenio?: boolean;
}

export interface BirthdayEntry {
  employeeId: string;
  employeeName: string;
  email: string;
  role: string;
  area: string;
  position: string;
  type: "BIRTHDAY";
  eventDate: string;
  day: number;
  years: number;
  title: string;
  message: string;
}

export interface AnniversaryEntry {
  employeeId: string;
  employeeName: string;
  email: string;
  role: string;
  area: string;
  position: string;
  type: "WORK_ANNIVERSARY";
  eventDate: string;
  day: number;
  years: number;
  isQuinquenio: boolean;
  title: string;
  message: string;
}

export interface UpcomingBirthday extends BirthdayEntry {
  daysUntil: number;
}
