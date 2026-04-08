"use client";

/**
 * React Query hook for the tenant settings endpoint.
 * Used by all /admin/settings/* sub-pages to share a single cache entry.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tenant } from "@/lib/types/tenant";

interface TenantResponse {
  tenant: Tenant;
}

const QUERY_KEY = ["admin", "tenant", "settings"];

export function useTenantSettings() {
  return useQuery<TenantResponse>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/tenant/settings");
      if (!res.ok) throw new Error("Error al cargar la configuración");
      return res.json();
    },
    staleTime: 30_000,
  });
}

/** Save a partial settings/branding payload and invalidate the cache. */
export function useSaveTenantSettings() {
  const queryClient = useQueryClient();
  return async (payload: {
    settings?: Record<string, unknown>;
    branding?: Record<string, unknown>;
    SettingKey?: string;
    value?: unknown;
  }) => {
    const res = await fetch("/api/tenant/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? "Error al guardar");
    }
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    return res.json();
  };
}
