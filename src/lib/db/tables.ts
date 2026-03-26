/**
 * DynamoDB table names — all prefixed with NovasysV2_
 * Override via environment variables for different stages.
 */

const prefix = process.env.TABLE_PREFIX || "NovasysV2_";

export const TABLES = {
  EMPLOYEES: process.env.TABLE_EMPLOYEES || `${prefix}Employees`,
  ATTENDANCE_EVENTS: process.env.TABLE_EVENTS || `${prefix}AttendanceEvents`,
  DAILY_SUMMARY: process.env.TABLE_DAILY || `${prefix}DailySummary`,
  APPROVAL_REQUESTS: process.env.TABLE_REQUESTS || `${prefix}ApprovalRequests`,
  HR_EVENTS: process.env.TABLE_HR_EVENTS || `${prefix}HREvents`,
  USER_NOTIFICATIONS: process.env.TABLE_NOTIFICATIONS || `${prefix}UserNotifications`,
  SYSTEM_SETTINGS: process.env.TABLE_SETTINGS || `${prefix}SystemSettings`,
  TENANTS: process.env.TABLE_TENANTS || `${prefix}Tenants`,
} as const;

/** GSI names */
export const INDEXES = {
  // Employees
  EMPLOYEES_EMAIL: "Email-index",
  EMPLOYEES_DNI: "DNI-index",
  EMPLOYEES_COGNITO_SUB: "CognitoSub-index",
  EMPLOYEES_AREA: "Area-index",
  // AttendanceEvents
  EVENTS_BY_DATE: "GSI_ByDate",
  // DailySummary
  DAILY_BY_DATE: "GSI_ByDate",
  // ApprovalRequests
  REQUESTS_BY_EMPLOYEE: "GSI_ByEmployee",
  REQUESTS_BY_STATUS: "GSI_ByStatus",
  // HREvents
  HR_BY_MONTH: "EventMonth-index",
  HR_BY_TYPE: "Type-index",
  // Tenants
  TENANT_SLUG: "Slug-index",
  // Multi-tenant GSIs (TenantID-based)
  EMPLOYEES_BY_TENANT: "Tenant-index",
  DAILY_BY_TENANT: "Tenant-WorkDate-index",
  EVENTS_BY_TENANT: "Tenant-Date-index",
  REQUESTS_BY_TENANT: "Tenant-Status-index",
  HR_BY_TENANT: "Tenant-Month-index",
} as const;
