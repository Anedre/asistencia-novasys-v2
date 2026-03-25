"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useHREvents(month?: string) {
  return useQuery({
    queryKey: ["hr", "events", month],
    queryFn: async () => {
      const url = month ? `/api/hr/events?month=${month}` : "/api/hr/events";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error fetching HR events");
      return res.json();
    },
  });
}

export function useCreateHREvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/admin/hr/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error creating event");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr"] }),
  });
}

export function useArchiveHREvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/hr/events/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error archiving event");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr"] }),
  });
}
