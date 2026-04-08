"use client";

/**
 * Settings section layout — sidebar on the left (desktop) or horizontal
 * scroller (mobile) + content pane on the right.
 *
 * The outer admin layout already provides the global sidebar + header,
 * so this layout just organizes the inner split.
 */

import type { ReactNode } from "react";
import { SettingsSidebar } from "@/components/admin/settings/SettingsSidebar";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Administra la información y las preferencias de tu empresa
        </p>
      </div>

      {/* Grid: sidebar 260px + main */}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <SettingsSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
