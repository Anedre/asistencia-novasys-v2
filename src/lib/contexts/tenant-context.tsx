"use client";

import { createContext, useContext } from "react";
import type { TenantBranding } from "@/lib/types/tenant";

interface TenantContextValue {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  branding: TenantBranding;
}

const defaultBranding: TenantBranding = {
  primaryColor: "#1e40af",
  secondaryColor: "#1e3a5f",
  accentColor: "#f59e0b",
};

const TenantContext = createContext<TenantContextValue>({
  tenantId: "TENANT#novasys",
  tenantSlug: "novasys",
  tenantName: "Novasys Peru",
  branding: defaultBranding,
});

export function TenantProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: TenantContextValue;
}) {
  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
