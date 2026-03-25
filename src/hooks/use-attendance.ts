"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EventType, TodayStatus, WeekSummary } from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function useTodayStatus() {
  return useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () =>
      fetchJson<TodayStatus & { ok: boolean }>("/api/attendance/today"),
    refetchInterval: (query) => (query.state.error ? false : 30000),
    retry: false,
  });
}

export function useWeekSummary(offset = 0) {
  return useQuery({
    queryKey: ["attendance", "week", offset],
    queryFn: () =>
      fetchJson<WeekSummary & { ok: boolean }>(
        `/api/attendance/week?offset=${offset}`
      ),
  });
}

export function useAttendanceHistory(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ["attendance", "history", dateFrom, dateTo],
    queryFn: () =>
      fetchJson<{ ok: boolean; days: unknown[] }>(
        `/api/attendance/history?dateFrom=${dateFrom}&dateTo=${dateTo}`
      ),
    enabled: !!dateFrom && !!dateTo,
  });
}

export function useRecordEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      eventType: EventType;
      note?: string;
    }) => {
      const res = await fetch("/api/attendance/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          clientTime: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al registrar");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}
