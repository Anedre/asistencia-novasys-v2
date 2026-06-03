"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { IconSvg, Icons } from "@/components/nova/icons";
import { EmptyState } from "@/components/shared/empty-state";

interface TenantWithCount {
  TenantID: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  maxEmployees: number;
  employeeCount: number;
  createdAt: string;
}

export default function SuperAdminDashboard() {
  const { data, isLoading } = useQuery<{ tenants: TenantWithCount[] }>({
    queryKey: ["super-admin", "tenants"],
    queryFn: async () => {
      const res = await fetch("/api/super-admin/tenants");
      if (!res.ok) throw new Error("Failed to fetch tenants");
      return res.json();
    },
  });

  const tenants = data?.tenants ?? [];
  const totalEmployees = tenants.reduce((sum, t) => sum + t.employeeCount, 0);
  const activeCount = tenants.filter((t) => t.status === "ACTIVE").length;

  return (
    <div className="nva-app" data-theme="light" data-density="comfortable">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Super Admin Dashboard</h1>
            <p className="page-sub">Gestion global de tenants y empresas.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="stat-card">
          <div className="stat-head">
            <div className="stat-icon">
              <IconSvg d={Icons.building} size={16} />
            </div>
            <div className="stat-label">Total Tenants</div>
          </div>
          <div className="stat-row">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="stat-value">{tenants.length}</div>
            )}
          </div>
          <div className="stat-hint">{activeCount} activos</div>
        </div>

        <div className="stat-card">
          <div className="stat-head">
            <div className="stat-icon">
              <IconSvg d={Icons.users} size={16} />
            </div>
            <div className="stat-label">Total Empleados</div>
          </div>
          <div className="stat-row">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="stat-value">{totalEmployees}</div>
            )}
          </div>
          <div className="stat-hint">En todas las empresas</div>
        </div>
      </div>

      {/* Tenant List */}
      <div className="panel">
        <div
          className="panel-title"
          style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}
        >
          <IconSvg d={Icons.building} size={18} />
          Empresas Registradas
        </div>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <EmptyState
            icon={Icons.building}
            title="Aún no hay empresas registradas"
            description="Las empresas que se registren apareceran aqui automaticamente"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tenants.map((tenant) => (
              <Link
                key={tenant.TenantID}
                href={`/super-admin/tenants/${encodeURIComponent(tenant.TenantID)}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 16,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)",
                  background: "var(--bg-elevated)",
                  transition: "background 0.12s",
                  textDecoration: "none",
                  color: "inherit",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="avatar accent" style={{ width: 40, height: 40, fontSize: 16 }}>
                    <span className="avatar-text">{tenant.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>
                      {tenant.name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {tenant.slug}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right", fontSize: 13 }}>
                    <p style={{ margin: 0, color: "var(--text-primary)" }}>
                      {tenant.employeeCount} empleados
                    </p>
                    <p style={{ margin: 0, color: "var(--text-muted)" }}>max {tenant.maxEmployees}</p>
                  </div>
                  <span
                    className={`type-tag ${tenant.plan === "ENTERPRISE" ? "accent" : "muted"}`}
                  >
                    {tenant.plan}
                  </span>
                  <span
                    className={`type-tag ${tenant.status === "ACTIVE" ? "success" : "danger"}`}
                  >
                    {tenant.status === "ACTIVE" ? "Activo" : "Suspendido"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
