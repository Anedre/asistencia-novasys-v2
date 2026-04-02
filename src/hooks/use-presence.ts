"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const PRESENCE_POLL_INTERVAL = 10_000; // 10 seconds

/**
 * Sends heartbeat every 30s to keep user "online".
 * Also handles typing indicators.
 */
export function useHeartbeat() {
  const typingChannelRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Send initial heartbeat
    fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});

    const id = setInterval(() => {
      fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
    }, HEARTBEAT_INTERVAL);

    // Set offline on page unload
    const handleUnload = () => {
      navigator.sendBeacon("/api/presence", JSON.stringify({ offline: true }));
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  const startTyping = useCallback((channelId: string) => {
    if (typingChannelRef.current === channelId) return;
    typingChannelRef.current = channelId;

    fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typingInChannel: channelId }),
    }).catch(() => {});

    // Auto-clear typing after 5 seconds
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingChannelRef.current = null;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typingInChannel: null }),
      }).catch(() => {});
    }, 5000);
  }, []);

  const stopTyping = useCallback(() => {
    if (!typingChannelRef.current) return;
    typingChannelRef.current = null;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ typingInChannel: null }),
    }).catch(() => {});
  }, []);

  return { startTyping, stopTyping };
}

/**
 * Poll presence status for a list of employee IDs.
 */
export function usePresence(employeeIds: string[]) {
  const idsKey = employeeIds.sort().join(",");

  return useQuery({
    queryKey: ["presence", idsKey],
    queryFn: async () => {
      if (!idsKey) return {};
      const res = await fetch(`/api/presence?ids=${encodeURIComponent(idsKey)}`);
      if (!res.ok) return {};
      const data = await res.json();
      return data.presence as Record<string, { status: string; lastActivity: string; typingIn?: string }>;
    },
    refetchInterval: PRESENCE_POLL_INTERVAL,
    enabled: employeeIds.length > 0,
  });
}

/**
 * Format "last seen" time in Spanish.
 */
export function formatLastSeen(isoStr: string): string {
  if (!isoStr) return "Desconectado";

  const now = new Date();
  const then = new Date(isoStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "Justo ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHour < 24) return `Hace ${diffHour}h`;

  return then.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

/**
 * Get the presence display info.
 */
export function getPresenceDisplay(status: string): {
  label: string;
  color: string;
  dotColor: string;
} {
  switch (status) {
    case "online":
      return { label: "En línea", color: "text-emerald-600", dotColor: "bg-emerald-500" };
    case "idle":
      return { label: "Ausente", color: "text-amber-600", dotColor: "bg-amber-500" };
    default:
      return { label: "Desconectado", color: "text-muted-foreground", dotColor: "bg-gray-400" };
  }
}
