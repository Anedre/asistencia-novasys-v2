"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppEvent } from "@/lib/types/event";

export function useEvents() {
  return useQuery<{ events: AppEvent[] }>({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Error al cargar eventos");
      return res.json();
    },
    refetchInterval: 30000,
  });
}

export function useEvent(eventId: string) {
  return useQuery<{ event: AppEvent }>({
    queryKey: ["events", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("Error al cargar evento");
      return res.json();
    },
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string; description?: string; type: string;
      visibility: string; targetArea?: string;
      startDate: string; endDate?: string; location?: string;
    }) => {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error"); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useRSVP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: string }) => {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Error al responder");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}
