export type EmploymentStatus = "ACTIVE" | "INACTIVE";
export type EmployeeRole = "EMPLOYEE" | "ADMIN";
export type WorkMode = "REMOTE" | "ONSITE" | "HYBRID";
export type ScheduleType = "FULL_TIME" | "PART_TIME";

export interface EmployeeSchedule {
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  breakMinutes: number; // 60
  type?: ScheduleType; // "FULL_TIME" | "PART_TIME"
}

export interface EmployeeLocation {
  lat: number;
  lng: number;
  address: string;
  formattedAddress: string;
}

export interface Employee {
  EmployeeID: string; // "EMP#john@novasys.com"
  TenantID?: string; // "TENANT#novasys" — multi-tenant isolation
  Email: string;
  DNI: string;
  FullName: string;
  FirstName: string;
  LastName: string;
  Phone?: string;
  BirthDate?: string; // "1990-05-15"
  HireDate?: string; // "2020-01-10"
  Area: string;
  Position: string;
  WorkMode: WorkMode;
  EmploymentStatus: EmploymentStatus;
  Role: EmployeeRole;
  CognitoSub?: string;
  AvatarUrl?: string;
  Location?: EmployeeLocation;
  Schedule: EmployeeSchedule;
  ScheduleType?: ScheduleType;
  CreatedAt: string;
  UpdatedAt: string;
  // Presence
  LastActivityAt?: string;  // ISO timestamp of last heartbeat
  PresenceStatus?: "online" | "idle" | "offline";
  TypingInChannel?: string; // ChannelID where currently typing
}

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  email: string;
  role: EmployeeRole;
  area: string;
  position: string;
}
