export type TenantPlan = "FREE" | "PRO" | "ENTERPRISE";
export type TenantStatus = "ACTIVE" | "SUSPENDED";

export interface TenantFeatures {
  chat: boolean;
  social: boolean;
  aiAssistant: boolean;
}

export interface WorkPolicy {
  allowHolidayWork: boolean;
  allowOvertime: boolean;
  strictSchedule: boolean;
}

export interface TenantSettings {
  approvalRequired: boolean;
  defaultScheduleType: "FULL_TIME" | "PART_TIME";
  timezone: string;
  features: TenantFeatures;
  defaultSchedule?: { startTime: string; endTime: string; breakMinutes: number };
  holidays?: { date: string; name: string }[];
  notifications?: Record<string, boolean>;
  workPolicy?: WorkPolicy;
}

export interface TenantBranding {
  logoUrl?: string;
  backgroundImageUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface Tenant {
  TenantID: string; // "TENANT#novasys"
  slug: string; // "novasys"
  name: string; // "Novasys Peru"
  branding: TenantBranding;
  settings: TenantSettings;
  plan: TenantPlan;
  maxEmployees: number;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}
