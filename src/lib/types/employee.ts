export type EmploymentStatus = "ACTIVE" | "INACTIVE";
export type EmployeeRole = "EMPLOYEE" | "ADMIN";
export type WorkMode = "REMOTE" | "ONSITE" | "HYBRID";

export interface EmployeeSchedule {
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  breakMinutes: number; // 60
}

export interface Employee {
  EmployeeID: string; // "EMP#john@novasys.com"
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
  Schedule: EmployeeSchedule;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  email: string;
  role: EmployeeRole;
  area: string;
  position: string;
}
