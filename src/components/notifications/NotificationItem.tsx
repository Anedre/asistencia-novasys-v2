"use client";

/**
 * Single row inside the notifications dropdown.
 * Picks an icon and tint based on the notification type, shows relative time,
 * and highlights unread rows with a dot + background tint.
 */

import {
  CheckCircle2,
  XCircle,
  Inbox,
  MessageSquare,
  Newspaper,
  Cake,
  Gift,
  Trophy,
  Megaphone,
  Clock,
  Bell,
} from "lucide-react";
import type { NotificationType, UserNotification } from "@/lib/types/api";
import { cn } from "@/lib/utils";

interface IconDef {
  icon: React.ElementType;
  tint: string;
}

const ICONS: Record<NotificationType, IconDef> = {
  REQUEST_APPROVED: {
    icon: CheckCircle2,
    tint: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  },
  REQUEST_REJECTED: {
    icon: XCircle,
    tint: "text-red-600 bg-red-50 dark:bg-red-950/40",
  },
  NEW_REQUEST: {
    icon: Inbox,
    tint: "text-sky-600 bg-sky-50 dark:bg-sky-950/40",
  },
  HR_EVENT: {
    icon: Megaphone,
    tint: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
  },
  ANNOUNCEMENT: {
    icon: Megaphone,
    tint: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
  },
  SYSTEM: {
    icon: Bell,
    tint: "text-zinc-600 bg-zinc-50 dark:bg-zinc-800/60",
  },
  NEW_MESSAGE: {
    icon: MessageSquare,
    tint: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
  },
  NEW_POST: {
    icon: Newspaper,
    tint: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40",
  },
  BIRTHDAY_TODAY: {
    icon: Cake,
    tint: "text-pink-600 bg-pink-50 dark:bg-pink-950/40",
  },
  BIRTHDAY_UPCOMING: {
    icon: Gift,
    tint: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/40",
  },
  WORK_ANNIVERSARY: {
    icon: Trophy,
    tint: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  },
  PENDING_REMINDER: {
    icon: Clock,
    tint: "text-orange-600 bg-orange-50 dark:bg-orange-950/40",
  },
};

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = now - then;
    if (diffMs < 0) return "ahora";

    const s = Math.floor(diffMs / 1000);
    if (s < 60) return "ahora";
    const m = Math.floor(s / 60);
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `hace ${d}d`;
    return new Date(iso).toLocaleDateString("es-PE", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

interface Props {
  notification: UserNotification;
  onClick?: () => void;
}

export function NotificationItem({ notification: n, onClick }: Props) {
  const def = ICONS[n.type] ?? ICONS.SYSTEM;
  const Icon = def.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition",
        n.read
          ? "hover:bg-muted/60"
          : "bg-primary/5 hover:bg-primary/10"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          def.tint
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-medium">{n.title}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatRelative(n.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {n.message}
        </p>
      </div>
      {!n.read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
