"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { TenantBranding } from "@/lib/types/tenant";

interface TenantContextValue {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  branding: TenantBranding;
  logoUrl?: string;
  isLoading: boolean;
}

const defaultBranding: TenantBranding = {
  primaryColor: "#2563eb",
  secondaryColor: "#1e40af",
  accentColor: "#3b82f6",
};

const defaultValue: TenantContextValue = {
  tenantId: "",
  tenantSlug: "",
  tenantName: "",
  branding: defaultBranding,
  isLoading: true,
};

const TenantContext = createContext<TenantContextValue>(defaultValue);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [tenantData, setTenantData] = useState<TenantContextValue>(defaultValue);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setTenantData((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    async function fetchTenant() {
      try {
        const res = await fetch("/api/tenant");
        if (!res.ok) throw new Error("Failed to fetch tenant");
        const data = await res.json();

        const branding = data.tenant?.branding || defaultBranding;

        setTenantData({
          tenantId: data.tenant?.TenantID || (session?.user as Record<string, string>)?.tenantId || "",
          tenantSlug: data.tenant?.slug || (session?.user as Record<string, string>)?.tenantSlug || "",
          tenantName: data.tenant?.name || "Mi Empresa",
          branding,
          logoUrl: branding.logoUrl,
          isLoading: false,
        });

        // Apply CSS variables for branding
        if (typeof document !== "undefined") {
          const root = document.documentElement;
          if (branding.primaryColor) {
            root.style.setProperty("--tenant-primary", branding.primaryColor);
          }
          if (branding.secondaryColor) {
            root.style.setProperty("--tenant-secondary", branding.secondaryColor);
          }
          if (branding.accentColor) {
            root.style.setProperty("--tenant-accent", branding.accentColor);
          }
        }
      } catch (err) {
        console.error("[TenantProvider] Error fetching tenant:", err);
        setTenantData((prev) => ({ ...prev, isLoading: false }));
      }
    }

    fetchTenant();
  }, [status, session]);

  return (
    <TenantContext.Provider value={tenantData}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
