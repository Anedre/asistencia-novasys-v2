/**
 * Shared default values for tenant settings used by both the onboarding
 * wizard (/welcome) and the admin settings panel. Single source of truth so
 * the two places can't drift.
 */

export interface ScheduleSettings {
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface NotificationSettings {
  approvals: boolean;
  rejections: boolean;
  birthdays: boolean;
  lateArrivals: boolean;
  pendingRequests: boolean;
}

export interface TenantFeatures {
  chat: boolean;
  social: boolean;
  aiAssistant: boolean;
}

export interface Holiday {
  date: string;
  name: string;
}

export const DEFAULT_SCHEDULE: ScheduleSettings = {
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  approvals: true,
  rejections: true,
  birthdays: true,
  lateArrivals: false,
  pendingRequests: true,
};

export const DEFAULT_FEATURES: TenantFeatures = {
  chat: false,
  social: false,
  aiAssistant: false,
};

export const DEFAULT_WORK_POLICY = {
  allowHolidayWork: false,
  allowOvertime: true,
  strictSchedule: false,
};

export const COLOR_PRESETS = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Esmeralda", value: "#10b981" },
  { name: "Naranja", value: "#f97316" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Slate", value: "#475569" },
  { name: "Cian", value: "#06b6d4" },
];

export const TIMEZONES = [
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/Caracas",
  "America/La_Paz",
  "America/Montevideo",
];

/** 12 standard Peruvian holidays — editable per year. */
export function getPeruHolidays(year: number): Holiday[] {
  return [
    { date: `${year}-01-01`, name: "Año Nuevo" },
    { date: `${year}-04-02`, name: "Jueves Santo" },
    { date: `${year}-04-03`, name: "Viernes Santo" },
    { date: `${year}-05-01`, name: "Día del Trabajo" },
    { date: `${year}-06-29`, name: "San Pedro y San Pablo" },
    { date: `${year}-07-28`, name: "Fiestas Patrias" },
    { date: `${year}-07-29`, name: "Fiestas Patrias" },
    { date: `${year}-08-30`, name: "Santa Rosa de Lima" },
    { date: `${year}-10-08`, name: "Combate de Angamos" },
    { date: `${year}-11-01`, name: "Todos los Santos" },
    { date: `${year}-12-08`, name: "Inmaculada Concepción" },
    { date: `${year}-12-25`, name: "Navidad" },
  ];
}
