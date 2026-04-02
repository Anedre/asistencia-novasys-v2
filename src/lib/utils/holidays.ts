/**
 * Holiday utilities — checks tenant-configured holidays.
 */

import { getTenantById } from "@/lib/db/tenants";
import type { WorkPolicy } from "@/lib/types/tenant";

export interface Holiday {
  date: string; // "YYYY-MM-DD"
  name: string;
}

/** Cached tenant config per tenant for 5 minutes */
interface TenantCache {
  holidays: Holiday[];
  plannedMinutes: number;
  workPolicy: WorkPolicy;
  expiresAt: number;
}

const cache = new Map<string, TenantCache>();
const CACHE_TTL = 5 * 60 * 1000;

const DEFAULT_WORK_POLICY: WorkPolicy = {
  allowHolidayWork: false,
  allowOvertime: true,
  strictSchedule: false,
};

/**
 * Get cached tenant config (holidays, planned minutes, work policy).
 */
async function getTenantConfig(tenantId: string): Promise<TenantCache> {
  const now = Date.now();
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > now) return cached;

  const tenant = await getTenantById(tenantId);
  const settings = tenant?.settings;

  // Calculate planned minutes from schedule
  let plannedMinutes = 480; // default 8h
  if (settings?.defaultSchedule) {
    const { startTime, endTime, breakMinutes } = settings.defaultSchedule;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm) - breakMinutes;
    if (total > 0) plannedMinutes = total;
  }

  const entry: TenantCache = {
    holidays: settings?.holidays ?? [],
    plannedMinutes,
    workPolicy: settings?.workPolicy ?? DEFAULT_WORK_POLICY,
    expiresAt: now + CACHE_TTL,
  };
  cache.set(tenantId, entry);
  return entry;
}

/**
 * Get holidays for a tenant. Cached for 5 minutes.
 */
export async function getHolidays(tenantId: string): Promise<Holiday[]> {
  return (await getTenantConfig(tenantId)).holidays;
}

/**
 * Get the configured planned minutes per day for a tenant.
 */
export async function getTenantPlannedMinutes(tenantId: string): Promise<number> {
  return (await getTenantConfig(tenantId)).plannedMinutes;
}

/**
 * Get the work policy for a tenant.
 */
export async function getTenantWorkPolicy(tenantId: string): Promise<WorkPolicy> {
  return (await getTenantConfig(tenantId)).workPolicy;
}

/**
 * Check if a date string (YYYY-MM-DD) is a holiday for the given tenant.
 */
export async function isHoliday(
  tenantId: string,
  date: string
): Promise<{ isHoliday: boolean; name?: string }> {
  const holidays = await getHolidays(tenantId);
  const match = holidays.find((h) => h.date === date);
  return match
    ? { isHoliday: true, name: match.name }
    : { isHoliday: false };
}

/**
 * Get planned minutes for a date, considering holidays and weekends.
 * Uses tenant's configured schedule instead of hardcoded 480.
 */
export async function getPlannedMinutes(
  tenantId: string,
  date: string
): Promise<{ planned: number; isHoliday: boolean; holidayName?: string }> {
  const config = await getTenantConfig(tenantId);

  // Check weekend first
  const dow = new Date(date + "T12:00:00").getDay();
  if (dow === 0 || dow === 6) {
    return { planned: 0, isHoliday: false };
  }

  // Check holiday
  const match = config.holidays.find((h) => h.date === date);
  if (match) {
    return { planned: 0, isHoliday: true, holidayName: match.name };
  }

  return { planned: config.plannedMinutes, isHoliday: false };
}

/**
 * Build a Map of holiday date strings for quick lookup.
 */
export async function getHolidaySet(
  tenantId: string
): Promise<Map<string, string>> {
  const holidays = await getHolidays(tenantId);
  const map = new Map<string, string>();
  for (const h of holidays) {
    map.set(h.date, h.name);
  }
  return map;
}
