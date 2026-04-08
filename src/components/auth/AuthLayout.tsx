"use client";

/**
 * Split-screen wrapper for every auth page (login, register, register-company,
 * forgot-password, onboarding).
 *
 * Layout:
 *   desktop: [brand panel 50%] [form panel 50%]
 *   mobile:  [form panel 100%] — brand panel hidden
 *
 * Pages can pass a custom `brandPanel` to override the default Novasys marketing
 * panel (e.g. show the invited tenant's logo).
 */

import type { ReactNode } from "react";
import { DefaultBrandPanel } from "./BrandPanel";

interface Props {
  children: ReactNode;
  brandPanel?: ReactNode;
}

export function AuthLayout({ children, brandPanel }: Props) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* ── Brand panel (desktop only) ── */}
      <div className="relative hidden w-1/2 lg:block">
        {brandPanel ?? <DefaultBrandPanel />}
      </div>

      {/* ── Form panel ── */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-8 sm:px-8 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
        <p className="mt-8 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Novasys Asistencia
        </p>
      </div>
    </div>
  );
}
