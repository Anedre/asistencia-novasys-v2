"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/super-admin/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {isLoading ? <Skeleton className="h-8 w-48" /> : tenant?.name}
          </h1>
          <p className="text-muted-foreground">{tenantId}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : tenant ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informacion General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Slug</p>
                  <p className="font-medium font-mono">{tenant.slug}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Empleados</p>
                  <p className="font-medium">{employeeCount} / {tenant.maxEmployees}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Creado</p>
                  <p className="font-medium">{new Date(tenant.createdAt).toLocaleDateString("es-PE")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Actualizado</p>
                  <p className="font-medium">{new Date(tenant.updatedAt).toLocaleDateString("es-PE")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gestion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Plan</label>
                <Select value={plan} onValueChange={(v) => v && setPlan(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Estado</label>
                <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Activo</SelectItem>
                    <SelectItem value="SUSPENDED">Suspendido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="w-full"
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>

              {updateMutation.isSuccess && (
                <p className="text-sm text-green-600 text-center">Cambios guardados</p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {tenant.branding?.primaryColor && (
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded border" style={{ backgroundColor: tenant.branding.primaryColor }} />
                    <span className="text-sm font-mono">{tenant.branding.primaryColor}</span>
                  </div>
                )}
                {tenant.branding?.secondaryColor && (
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded border" style={{ backgroundColor: tenant.branding.secondaryColor }} />
                    <span className="text-sm font-mono">{tenant.branding.secondaryColor}</span>
                  </div>
                )}
                {tenant.branding?.accentColor && (
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded border" style={{ backgroundColor: tenant.branding.accentColor }} />
                    <span className="text-sm font-mono">{tenant.branding.accentColor}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8">Tenant no encontrado</p>
      )}
    </div>
  );
}
