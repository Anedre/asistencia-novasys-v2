"use client";

/**
 * Bell icon with unread count badge + popover dropdown listing the recent
 * notifications. Plugs into the header.
 *
 * Behavior:
 *   - Polls every 60s via useNotifications().
 *   - Detects new unread items by id since the previous poll and plays the
 *     corresponding sound (respecting the global mute preference).
 *   - Opening the dropdown marks all as read after a 2s debounce.
 *   - Toggle button in the header of the popover mutes/unmutes the sounds
 *     (localStorage-persisted).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Volume2, VolumeX, CheckCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  useNotifications,
  useMarkAllRead,
} from "@/hooks/use-notifications";
import {
  useNotificationSound,
  defaultSoundFor,
} from "@/hooks/use-notification-sound";
import { NotificationItem } from "./NotificationItem";
import type { UserNotification } from "@/lib/types/api";
import { cn } from "@/lib/utils";

export function NotificationDropdown() {
  const { data, isLoading } = useNotifications();
  const markAllRead = useMarkAllRead();
  const { play, enabled: soundEnabled, setEnabled: setSoundEnabled } =
    useNotificationSound();

  const notifications = useMemo<UserNotification[]>(
    () => data?.notifications ?? [],
    [data]
  );
  const unreadCount = data?.unreadCount ?? 0;

  const [open, setOpen] = useState(false);
  const previousIds = useRef<Set<string>>(new Set());
  const seeded = useRef(false);
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play a sound for any new unread notification since last poll.
  useEffect(() => {
    if (notifications.length === 0) return;

    const currentIds = new Set(notifications.map((n) => n.notificationId));

    // Seed the "seen" set on first load — we don't want to play sounds for
    // every existing notification when the page opens.
    if (!seeded.current) {
      previousIds.current = currentIds;
      seeded.current = true;
      return;
    }

    // Find the newest unread notification we haven't seen before.
    const freshUnread = notifications.find(
      (n) => !n.read && !previousIds.current.has(n.notificationId)
    );
    if (freshUnread) {
      const soundType = freshUnread.soundType ?? defaultSoundFor(freshUnread.type);
      play(soundType);
    }

    previousIds.current = currentIds;
  }, [notifications, play]);

  // Debounced auto-mark when the dropdown opens.
  useEffect(() => {
    if (!open) {
      if (markTimer.current) {
        clearTimeout(markTimer.current);
        markTimer.current = null;
      }
      return;
    }
    if (unreadCount === 0) return;

    markTimer.current = setTimeout(() => {
      markAllRead.mutate();
    }, 2000);

    return () => {
      if (markTimer.current) {
        clearTimeout(markTimer.current);
        markTimer.current = null;
      }
    };
  }, [open, unreadCount, markAllRead]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            aria-label="Notificaciones"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 sm:w-[420px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Notificaciones</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} sin leer`
                : "Todo al día"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Silenciar" : "Activar sonido"}
              aria-label={soundEnabled ? "Silenciar" : "Activar sonido"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Marcar todas
            </Button>
          </div>
        </div>

        <Separator />

        {/* List */}
        {isLoading ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            Cargando…
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-xs text-muted-foreground">
            <BellOff className="h-6 w-6 opacity-40" />
            No tienes notificaciones
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className={cn("divide-y")}>
              {notifications.map((n) => (
                <NotificationItem
                  key={n.notificationId}
                  notification={n}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
