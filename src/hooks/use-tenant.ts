"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tenant, TenantSettings, TenantBranding } from "@/lib/types/tenant";

async function fetchTenant(): Promise<Tenant> {
  const res = await fetch("/api/tenant");
  if (!res.ok) throw new Error("Error al cargar configuracion del tenant");
  const data = await res.json();
  return data.tenant;
}

export function useTenantConfig() {
  return useQuery({
    queryKey: ["tenant"],
    queryFn: fetchTenant,
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });
}

export function useUpdateTenantSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      settings?: Partial<TenantSettings>;
      branding?: Partial<TenantBranding>;
    }) => {
      const res = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al actualizar configuracion");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant"] }),
  });
}
