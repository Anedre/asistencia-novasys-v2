"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Settings index — sends users to the General section.
 *
 * This used to call the server-side `redirect()`, but throwing the redirect
 * during a client-side navigation render made React reconcile a partial tree
 * and crash with "Rendered more hooks than during the previous render."
 * A client-side `router.replace` in an effect avoids that entirely while still
 * redirecting on direct URL loads.
 */
export default function SettingsIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/settings/general");
  }, [router]);
  return (
    <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
      Cargando…
    </div>
  );
}
