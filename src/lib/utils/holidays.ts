/**
 * Holiday utilities — checks tenant-configured holidays.
 */

import { getTenantById } from "@/lib/db/tenants";

export interface Holiday {
  date: string; // "YYYY-MM-DD"
  name: string;
}

/** Cache holidays per tenant for 5 minutes to avoid repeated DB reads */
const cache = new Map<string, { holidays: Holiday[]; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get holidays for a tenant. Cached for 5 minutes.
 */
export async function getHolidays(tenantId: string): Promise<Holiday[]> {
  const now = Date.now();
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > now) {
    return cached.holidays;
  }

  const tenant = await getTenantById(tenantId);
  const holidays = tenant?.settings?.holidays ?? [];
  cache.set(tenantId, { holidays, expiresAt: now + CACHE_TTL });
  return holidays;
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
 * Returns 0 for holidays and weekends, 480 (8h) for regular workdays.
 */
export async function getPlannedMinutes(
  tenantId: string,
  date: string
): Promise<{ planned: number; isHoliday: boolean; holidayName?: string }> {
  // Check weekend first
  const dow = new Date(date + "T12:00:00").getDay();
  if (dow === 0 || dow === 6) {
    return { planned: 0, isHoliday: false };
  }

  // Check holiday
  const hol = await isHoliday(tenantId, date);
  if (hol.isHoliday) {
    return { planned: 0, isHoliday: true, holidayName: hol.name };
  }

  return { planned: 480, isHoliday: false };
}

/**
 * Build a Set of holiday date strings for quick lookup.
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
