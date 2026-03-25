"use client";

import { useAdminDashboard } from "@/hooks/use-employee";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Clock, CheckSquare, AlertTriangle, Activity } from "lucide-react";

interface DashboardData {
  ok: boolean;
  totalActiveEmployees: number;
  presentToday: number;
  pendingRequests: number;
  anomaliesToday: number;
  onBreakNow: number;
  absentToday: number;
  statusBreakdown?: {
    ok: number;
    open: number;
    short: number;
    missing: number;
    absence: number;
    regularized: number;
  };
}

function StatBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading, isError } = useAdminDashboard();
  const dashboard = data as DashboardData | undefined;

  const activeEmployees = dashboard?.totalActiveEmployees ?? 0;
  const presentToday = dashboard?.presentToday ?? 0;
  const pendingRequests = dashboard?.pendingRequests ?? 0;
  const anomalies = dashboard?.anomaliesToday ?? 0;
  const breakdown = dashboard?.statusBreakdown;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Panel de Administracion
        </h1>
        <p className="text-muted-foreground">
          Vista general del sistema de asistencia
        </p>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          Error al cargar el dashboard. Intenta de nuevo.
        </p>
      )}

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Empleados Activos
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : activeEmployees}
            </div>
            <p className="text-xs text-muted-foreground">total registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Presentes Hoy
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : presentToday}
            </div>
            <p className="text-xs text-muted-foreground">
              han marcado entrada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : pendingRequests}
            </div>
            <p className="text-xs text-muted-foreground">
              solicitudes por aprobar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : anomalies}
            </div>
            <p className="text-xs text-muted-foreground">
              registros incompletos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      {breakdown && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-medium">
              Desglose de Estado Hoy
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <StatBar
              label="Trabajando"
              value={breakdown.open}
              total={activeEmployees}
              color="bg-green-500"
            />
            <StatBar
              label="Jornada completa"
              value={breakdown.ok}
              total={activeEmployees}
              color="bg-blue-500"
            />
            <StatBar
              label="Jornada corta"
              value={breakdown.short}
              total={activeEmployees}
              color="bg-yellow-500"
            />
            <StatBar
              label="Ausentes"
              value={breakdown.absence}
              total={activeEmployees}
              color="bg-red-500"
            />
            <StatBar
              label="Sin registro"
              value={breakdown.missing}
              total={activeEmployees}
              color="bg-gray-400"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
