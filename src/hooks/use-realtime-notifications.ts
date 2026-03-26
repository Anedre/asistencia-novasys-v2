"use client";

import { useEffect, useRef, useCallback } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { toast } from "sonner";

export function useRealtimeNotifications() {
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

  // Poll every 12 seconds
  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 12000);
    return () => clearInterval(interval);
  }, [refetch]);

  return data;
}
