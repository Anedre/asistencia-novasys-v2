"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Bridges the next-themes resolved theme into the `data-theme` attribute the
 * design system reads. The Nova CSS keys off `.nva-app[data-theme="dark"]`
 * selectors, but next-themes only writes `class="dark"` on `<html>`, so we
 * sync the data-theme attribute on every parent `.nva-app` shell.
 *
 * Renders nothing. Mount once per layout root.
 */
export function ThemeBridge() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const theme = resolvedTheme === "dark" ? "dark" : "light";
    const apps = document.querySelectorAll<HTMLElement>(".nva-app");
    apps.forEach((el) => {
      el.dataset.theme = theme;
    });
  }, [resolvedTheme]);

  return null;
}
