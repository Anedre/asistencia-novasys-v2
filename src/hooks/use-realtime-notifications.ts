"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export function useRealtimeNotifications() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const { data, refetch } = useNotifications();
  const prevCountRef = useRef<number>(0);
  const hasPermissionRef = useRef(false);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        hasPermissionRef.current = true;
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((p) => {
          hasPermissionRef.current = p === "granted";
        });
      }
    }
  }, []);

  // Detect new notifications and show toast
  useEffect(() => {
    if (!data?.notifications) return;

    const unreadCount = data.notifications.filter((n) => !n.read).length;

    if (prevCountRef.current > 0 && unreadCount > prevCountRef.current) {
      const newest = data.notifications.find((n) => !n.read);
      if (newest) {
        const message = newest.message || "Nueva notificacion";
        toast.info(message, { duration: 5000 });

        // Browser notification
        if (hasPermissionRef.current) {
          try {
            new Notification("Asistencia", { body: message, icon: "/favicon.ico" });
          } catch { /* ignore */ }
        }
      }
    }

    prevCountRef.current = unreadCount;
  }, [data]);

  // Manual polling removed: useNotifications already runs `refetchInterval:
  // 60000` (or whatever the base hook sets). Stacking a second 12s setInterval
  // here on top compounded the request rate ~5x and bombarded the server.
  // If a faster realtime cadence is needed, bump the base hook's
  // refetchInterval instead of layering polls.
  void isAuthed;

  return data;
}
