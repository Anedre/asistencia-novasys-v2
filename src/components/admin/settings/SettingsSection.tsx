"use client";

/**
 * Wrapper component for a single settings subsection.
 * Renders a consistent header (icon + title + description) above the body.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  icon: React.ElementType;
  title: string;
  description: string;
  /** Optional pill shown to the right of the title, e.g. "Plan Free". */
  rightSlot?: ReactNode;
  /** Optional extra classes for the body wrapper. */
  bodyClassName?: string;
  children: ReactNode;
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  rightSlot,
  bodyClassName,
  children,
}: Props) {
  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {rightSlot}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </header>

      {/* Body */}
      <div className={cn("space-y-6", bodyClassName)}>{children}</div>
    </section>
  );
}
