"use client";

import Link from "next/link";
import { useAdminDashboard } from "@/hooks/use-employee";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Clock,
  CheckSquare,
  AlertTriangle,
  Activity,
  Timer,
  CalendarCheck,
  ArrowRight,
  ClipboardList,
  FileBarChart,
  FilePenLine,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardData {
  ok: boolean;
  totalActiveEmployees: number;
  presentToday: number;
  pendingRequests: number;
  anomaliesToday: number;
  onBreakNow: number;
  absentToday: number;
  avgHoursPerDay?: number;
  weeklyAttendancePct?: number;
  recentActivity?: Array<{
    id: string;
    employeeName: string;
    action: string;
    time: string;
  }>;
  statusBreakdown?: {
    ok: number;
    open: number;
    short: number;
    missing: number;
    absence: number;
    regularized: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Metric card                                                       */
/* ------------------------------------------------------------------ */

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentFrom,
  accentTo,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  accentFrom: string;
  accentTo: string;
  loading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      {/* gradient accent bar at top */}
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentFrom} ${accentTo}`}
      />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${accentFrom} ${accentTo} text-white`}
        >
          <Icon className="size-4" />
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        {loading ? (
          <Skeleton className="mb-1 h-8 w-20" />
        ) : (
          <p className="text-3xl font-bold tracking-tight">{value}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat bar (enhanced)                                                */
/* ------------------------------------------------------------------ */

function StatBar({
  label,
  value,
  total,
  colorClass,
  bgClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
  bgClass: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className={`inline-block size-2.5 rounded-full ${colorClass}`} />
          <span className="font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2 tabular-nums">
          <span className="text-muted-foreground">{value}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {pct}%
          </Badge>
        </div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${bgClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick action link                                                  */
/* ------------------------------------------------------------------ */

function QuickAction({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="group cursor-pointer transition-all hover:shadow-md hover:ring-primary/30">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-tight">{label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {description}
            </p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </CardContent>
      </Card>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function AdminDashboard() {
  const { data, isLoading, isError } = useAdminDashboard();
  const dashboard = data as DashboardData | undefined;

  const activeEmployees = dashboard?.totalActiveEmployees ?? 0;
  const presentToday = dashboard?.presentToday ?? 0;
  const pendingRequests = dashboard?.pendingRequests ?? 0;
  const anomalies = dashboard?.anomaliesToday ?? 0;
  const breakdown = dashboard?.statusBreakdown;

  const attendancePct =
    dashboard?.weeklyAttendancePct ??
    (activeEmployees > 0
      ? Math.round((presentToday / activeEmployees) * 100)
      : 0);

  const avgHours = dashboard?.avgHoursPerDay ?? 0;
  const recentActivity = dashboard?.recentActivity ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Panel de Administracion
        </h1>
        <p className="text-muted-foreground">
          Vista general del sistema de asistencia
        </p>
      </div>

      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">
              Error al cargar el dashboard. Intenta de nuevo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* METRIC CARDS                                 */}
      {/* ============================================ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Empleados Activos"
          value={activeEmployees}
          subtitle="total registrados"
          icon={Users}
          accentFrom="from-blue-500"
          accentTo="to-cyan-400"
          loading={isLoading}
        />
        <MetricCard
          title="Presentes Hoy"
          value={presentToday}
          subtitle="han marcado entrada"
          icon={Clock}
          accentFrom="from-green-500"
          accentTo="to-emerald-400"
          loading={isLoading}
        />
        <MetricCard
          title="Pendientes"
          value={pendingRequests}
          subtitle="solicitudes por aprobar"
          icon={CheckSquare}
          accentFrom="from-amber-500"
          accentTo="to-yellow-400"
          loading={isLoading}
        />
        <MetricCard
          title="Anomalias"
          value={anomalies}
          subtitle="registros incompletos"
          icon={AlertTriangle}
          accentFrom="from-red-500"
          accentTo="to-orange-400"
          loading={isLoading}
        />
        <MetricCard
          title="Promedio horas/dia"
          value={isLoading ? "..." : avgHours > 0 ? `${avgHours.toFixed(1)}h` : "--"}
          subtitle="jornada laboral promedio"
          icon={Timer}
          accentFrom="from-violet-500"
          accentTo="to-purple-400"
          loading={false}
        />
        <MetricCard
          title="Asistencia semana"
          value={isLoading ? "..." : `${attendancePct}%`}
          subtitle="porcentaje semanal"
          icon={CalendarCheck}
          accentFrom="from-teal-500"
          accentTo="to-cyan-400"
          loading={false}
        />
      </div>

      {/* ============================================ */}
      {/* STATUS BREAKDOWN + RECENT ACTIVITY           */}
      {/* ============================================ */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Status Breakdown */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              <CardTitle className="text-base">
                Desglose de Estado Hoy
              </CardTitle>
            </div>
            <CardDescription>
              Distribucion de estados de asistencia entre{" "}
              {activeEmployees} empleados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : breakdown ? (
              <>
                <StatBar
                  label="Trabajando"
                  value={breakdown.open}
                  total={activeEmployees}
                  colorClass="bg-green-500"
                  bgClass="bg-gradient-to-r from-green-500 to-emerald-400"
                />
                <StatBar
                  label="Jornada completa"
                  value={breakdown.ok}
                  total={activeEmployees}
                  colorClass="bg-blue-500"
                  bgClass="bg-gradient-to-r from-blue-500 to-sky-400"
                />
                <StatBar
                  label="Jornada corta"
                  value={breakdown.short}
                  total={activeEmployees}
                  colorClass="bg-yellow-500"
                  bgClass="bg-gradient-to-r from-yellow-500 to-amber-400"
                />
                <StatBar
                  label="Ausentes"
                  value={breakdown.absence}
                  total={activeEmployees}
                  colorClass="bg-red-500"
                  bgClass="bg-gradient-to-r from-red-500 to-rose-400"
                />
                <StatBar
                  label="Sin registro"
                  value={breakdown.missing}
                  total={activeEmployees}
                  colorClass="bg-gray-400"
                  bgClass="bg-gradient-to-r from-gray-400 to-gray-300"
                />
                {breakdown.regularized > 0 && (
                  <StatBar
                    label="Regularizados"
                    value={breakdown.regularized}
                    total={activeEmployees}
                    colorClass="bg-violet-500"
                    bgClass="bg-gradient-to-r from-violet-500 to-purple-400"
                  />
                )}
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay datos de estado disponibles
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="size-5 text-primary" />
              <CardTitle className="text-base">
                Actividad Reciente
              </CardTitle>
            </div>
            <CardDescription>
              Ultimos eventos de asistencia
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Activity className="size-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.employeeName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.action}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Activity className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm font-medium">Sin actividad reciente</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Los eventos de asistencia aparecen aqui
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* QUICK ACTIONS                                */}
      {/* ============================================ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Acciones Rapidas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            href="/admin/approvals"
            icon={ClipboardList}
            label="Aprobar Solicitudes"
            description={`${pendingRequests} solicitudes pendientes`}
          />
          <QuickAction
            href="/admin/reports"
            icon={FileBarChart}
            label="Ver Reportes"
            description="Reportes de asistencia y horas"
          />
          <QuickAction
            href="/admin/attendance"
            icon={FilePenLine}
            label="Regularizar"
            description="Corregir registros de asistencia"
          />
        </div>
      </section>
    </div>
  );
}
