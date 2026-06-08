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
  holidays?: { date: string; name: string; type?: "Nacional" | "Empresa" }[];
  notifications?: Record<string, boolean | { email?: boolean; push?: boolean; app?: boolean }>;
  workPolicy?: WorkPolicy;
  /** Marks whether the post-registration onboarding wizard has been completed. */
  onboardingCompleted?: boolean;
  // Settings page extended fields (persisted via saveTenantSettings)
  weekStart?: "MONDAY" | "SUNDAY";
  dateFormat?: string;
  timeFormat?: "24h" | "12h";
  legalName?: string;
  ruc?: string;
  industry?: string;
  address?: string;
  accentColor?: string;
  tagline?: string;
  welcomeMessage?: string;
  workSchedule?: {
    startTime: string;
    endTime: string;
    breakMinutes: number;
    toleranceMinutes?: number;
    minBreakMinutes?: number;
    allowOffHours?: boolean;
    requireGps?: boolean;
    requirePhoto?: boolean;
    /** Nightly close of shifts left open at end of day (shift-closer Lambda). */
    autoCloseShifts?: boolean;
    /** Real-time close once an employee reaches their laborable hours (auto-close Lambda, ~10min). */
    autoCloseAtGoal?: boolean;
  };
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
  /** Alias for `name`, used by some UI components. */
  tenantName?: string;
  branding: TenantBranding;
  /** Convenience field surfaced at top level. Source of truth is `branding.logoUrl`. */
  logoUrl?: string;
  settings: TenantSettings;
  plan: TenantPlan;
  maxEmployees: number;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}
