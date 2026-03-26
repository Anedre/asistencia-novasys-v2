"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, Shield } from "lucide-react";
import Link from "next/link";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Super Admin Dashboard
        </h1>
        <p className="text-muted-foreground">Gestion global de tenants y empresas</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{tenants.length}</div>
            )}
            <p className="text-xs text-muted-foreground">{activeCount} activos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{totalEmployees}</div>
            )}
            <p className="text-xs text-muted-foreground">En todas las empresas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresas Registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : tenants.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay tenants registrados</p>
          ) : (
            <div className="space-y-3">
              {tenants.map((tenant) => (
                <Link
                  key={tenant.TenantID}
                  href={`/super-admin/tenants/${encodeURIComponent(tenant.TenantID)}`}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{tenant.name}</p>
                      <p className="text-sm text-muted-foreground">{tenant.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p>{tenant.employeeCount} empleados</p>
                      <p className="text-muted-foreground">max {tenant.maxEmployees}</p>
                    </div>
                    <Badge variant={tenant.plan === "ENTERPRISE" ? "default" : "outline"}>
                      {tenant.plan}
                    </Badge>
                    <Badge variant={tenant.status === "ACTIVE" ? "default" : "destructive"}>
                      {tenant.status === "ACTIVE" ? "Activo" : "Suspendido"}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
