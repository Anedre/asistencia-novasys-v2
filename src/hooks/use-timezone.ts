"use client";

import { useTenantConfig } from "@/hooks/use-tenant";

const DEFAULT_TZ = "America/Lima";

/**
 * Hook that returns the tenant's configured timezone.
 */
export function useTenantTimezone(): string {
  const { data: tenant } = useTenantConfig();
  return tenant?.settings?.timezone ?? DEFAULT_TZ;
}

/**
 * Get current Date object adjusted to a specific timezone.
 * Returns a Date whose getHours/getMinutes/etc reflect the target tz.
 */
export function nowInTz(tz: string): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

/**
 * Get today's date string (YYYY-MM-DD) in a specific timezone.
 */
export function todayInTz(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Format a Date as time string (HH:MM:SS) in a specific timezone.
 */
export function clockInTz(tz: string, d?: Date): string {
  return (d ?? new Date()).toLocaleString("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Get hours, minutes, seconds from current time in a timezone.
 */
export function timePartsInTz(tz: string): { hours: number; minutes: number; seconds: number } {
  const parts = clockInTz(tz).split(":").map(Number);
  return { hours: parts[0], minutes: parts[1], seconds: parts[2] };
}

/**
 * Format a Date for display in a specific timezone.
 */
export function formatTimeInTz(tz: string, d?: Date): {
  time: string;
  date: string;
  weekday: string;
} {
  const date = d ?? new Date();
  return {
    time: date.toLocaleTimeString("es-PE", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
    date: date.toLocaleDateString("es-PE", {
      timeZone: tz,
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    weekday: date.toLocaleDateString("es-PE", {
      timeZone: tz,
      weekday: "long",
    }),
  };
}
