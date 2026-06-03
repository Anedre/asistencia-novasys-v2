"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useState } from "react";
import { IconSvg, Icons } from "@/components/nova/icons";
import { EmptyState } from "@/components/shared/empty-state";

interface TenantDetail {
  TenantID: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  maxEmployees: number;
  branding: Record<string, string>;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tenantId = decodeURIComponent(id);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ tenant: TenantDetail; employeeCount: number }>({
    queryKey: ["super-admin", "tenant", tenantId],
    queryFn: async () => {
      const res = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenantId)}`);
      if (!res.ok) throw new Error("Failed to fetch tenant");
      return res.json();
    },
  });

  const [plan, setPlan] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const res = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenantId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update tenant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin", "tenant", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["super-admin", "tenants"] });
    },
  });

  const tenant = data?.tenant;
  const employeeCount = data?.employeeCount ?? 0;

  // Set initial values when data loads
  if (tenant && !plan) setPlan(tenant.plan);
  if (tenant && !status) setStatus(tenant.status);

  const handleSave = () => {
    const updates: Record<string, unknown> = {};
    if (plan && plan !== tenant?.plan) updates.plan = plan;
    if (status && status !== tenant?.status) updates.status = status;
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    }
  };

  return (
    <div className="nva-app" data-theme="light" data-density="comfortable">
      <div className="page-header">
        <div className="page-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/super-admin/dashboard" className="btn ghost btn-sm" aria-label="Volver">
              <IconSvg d={Icons.arrowLeft} size={16} />
            </Link>
            <div>
              <h1
                className="page-title"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <IconSvg d={Icons.building} size={22} />
                {isLoading ? <Skeleton className="h-8 w-48" /> : tenant?.name}
              </h1>
              <p className="page-sub" style={{ fontFamily: "var(--font-mono)" }}>
                {tenantId}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : tenant ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
          }}
        >
          <div className="panel">
            <div className="panel-title" style={{ marginBottom: 16 }}>
              Informacion General
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                fontSize: 13,
              }}
            >
              <div>
                <p style={{ margin: 0, color: "var(--text-muted)" }}>Slug</p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-primary)",
                  }}
                >
                  {tenant.slug}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: "var(--text-muted)" }}>Empleados</p>
                <p style={{ margin: "4px 0 0", fontWeight: 600, color: "var(--text-primary)" }}>
                  {employeeCount} / {tenant.maxEmployees}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: "var(--text-muted)" }}>Creado</p>
                <p style={{ margin: "4px 0 0", fontWeight: 600, color: "var(--text-primary)" }}>
                  {new Date(tenant.createdAt).toLocaleDateString("es-PE")}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: "var(--text-muted)" }}>Actualizado</p>
                <p style={{ margin: "4px 0 0", fontWeight: 600, color: "var(--text-primary)" }}>
                  {new Date(tenant.updatedAt).toLocaleDateString("es-PE")}
                </p>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title" style={{ marginBottom: 16 }}>
              Gestion
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="tenant-plan">
                Plan
              </label>
              <select
                id="tenant-plan"
                className="form-select"
                value={plan}
                onChange={(e) => e.target.value && setPlan(e.target.value)}
              >
                <option value="FREE">Free</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="tenant-status">
                Estado
              </label>
              <select
                id="tenant-status"
                className="form-select"
                value={status}
                onChange={(e) => e.target.value && setStatus(e.target.value)}
              >
                <option value="ACTIVE">Activo</option>
                <option value="SUSPENDED">Suspendido</option>
              </select>
            </div>

            <button
              type="button"
              className="btn primary"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {updateMutation.isPending && (
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    border: "2px solid currentColor",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.6s linear infinite",
                    marginRight: 6,
                  }}
                  aria-hidden
                />
              )}
              Guardar Cambios
            </button>

            {updateMutation.isSuccess && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: "var(--success)",
                  textAlign: "center",
                }}
              >
                Cambios guardados
              </p>
            )}
          </div>

          <div className="panel" style={{ gridColumn: "1 / -1" }}>
            <div className="panel-title" style={{ marginBottom: 16 }}>
              Branding
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {tenant.branding?.primaryColor && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      backgroundColor: tenant.branding.primaryColor,
                    }}
                  />
                  <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>
                    {tenant.branding.primaryColor}
                  </span>
                </div>
              )}
              {tenant.branding?.secondaryColor && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      backgroundColor: tenant.branding.secondaryColor,
                    }}
                  />
                  <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>
                    {tenant.branding.secondaryColor}
                  </span>
                </div>
              )}
              {tenant.branding?.accentColor && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      backgroundColor: tenant.branding.accentColor,
                    }}
                  />
                  <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>
                    {tenant.branding.accentColor}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Icons.building}
          title="Tenant no encontrado"
          description="El identificador no corresponde a ninguna empresa registrada"
        />
      )}
    </div>
  );
}
