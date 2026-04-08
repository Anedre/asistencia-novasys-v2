"use client";

/**
 * Vertical sidebar for /admin/settings.
 *
 * Renders as a sticky sidebar on desktop and collapses to a horizontal
 * scrolling pill list on mobile.
 *
 * Each entry shows icon + label + short description and highlights the
 * active route via usePathname. Consumers can pass a `dirty` map to show an
 * amber dot next to sections with unsaved changes.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Palette,
  Clock,
  CalendarDays,
  Bell,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const ITEMS: Item[] = [
  {
    href: "/admin/settings/general",
    label: "General",
    description: "Nombre, zona horaria, plan",
    icon: Building2,
  },
  {
    href: "/admin/settings/branding",
    label: "Marca",
    description: "Logo y colores",
    icon: Palette,
  },
  {
    href: "/admin/settings/schedule",
    label: "Horarios",
    description: "Jornada y política",
    icon: Clock,
  },
  {
    href: "/admin/settings/holidays",
    label: "Feriados",
    description: "Días no laborables",
    icon: CalendarDays,
  },
  {
    href: "/admin/settings/notifications",
    label: "Notificaciones",
    description: "Alertas por email",
    icon: Bell,
  },
  {
    href: "/admin/settings/features",
    label: "Funcionalidades",
    description: "Chat, social, IA",
    icon: Sparkles,
  },
];

interface Props {
  /** Map keyed by href that marks a section as having unsaved changes. */
  dirty?: Record<string, boolean>;
}

export function SettingsSidebar({ dirty }: Props) {
  const pathname = usePathname();

  return (
    <>
      {/* ── Mobile: horizontal scroll of pills ── */}
      <div className="lg:hidden">
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2">
          {ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 snap-start items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-foreground/30"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                {dirty?.[item.href] && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Desktop: vertical sticky sidebar ── */}
      <nav className="hidden lg:block">
        <div className="sticky top-6 space-y-1">
          {ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition",
                  active
                    ? "border-primary/20 bg-primary/5"
                    : "hover:bg-muted/60"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-foreground/10 group-hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        active ? "text-foreground" : "text-foreground/90"
                      )}
                    >
                      {item.label}
                    </p>
                    {dirty?.[item.href] && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-amber-500"
                        title="Cambios sin guardar"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
