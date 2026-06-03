"use client";

/**
 * AuthLayout — wraps the auth pages in the original design system's
 * `.nva-auth` scope so all `.auth-shell`, `.auth-brand`, `.auth-pane`,
 * `.btn`, `.form-input`, etc. classes work exactly like the source.
 */

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  /**
   * Deprecated: kept for backwards-compat with callers that still pass it.
   * The auth surface no longer renders any top-level navigator.
   */
  hideTabs?: boolean;
  /**
   * Optional override for the brand panel on the left side. When provided,
   * pages can show a custom panel instead of the default DefaultBrandPanel
   * (used by /register?invite to show the inviting tenant's branding).
   *
   * Currently consumed by `register-company` and `register?invite=...`.
   */
  brandPanel?: ReactNode;
}

export function AuthLayout({ children }: Props) {
  return (
    <div className="nva-app" data-theme="light" data-density="comfortable">
      {children}
    </div>
  );
}
