"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, CalendarDays, TrendingUp } from "lucide-react";
import { useTodayStatus, useWeekSummary } from "@/hooks/use-attendance";
import { useMyProfile } from "@/hooks/use-employee";
import { ClockWidget } from "@/components/attendance/clock-widget";
import { WeekTable } from "@/components/attendance/week-table";
import { StatusBadge } from "@/components/attendance/status-badge";

function formatPlanned(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  const { data: profile } = useMyProfile();
  const { data: today } = useTodayStatus();
  const { data: week } = useWeekSummary(0);

  // Redirect to onboarding if profile is incomplete
  useEffect(() => {
    if (profile?.employee?.dni?.startsWith("PENDING")) {
      router.push("/onboarding");
    }
  }, [profile, router]);

  const todayStatus = today?.status ?? "NO_RECORD";
  const workedHHMM = today?.workedHHMM ?? "00:00";
  const weekWorkedHHMM = week?.totalWorkedHHMM ?? "00:00";
  const weekPlanned = week?.totalPlannedMinutes ?? 0;
  const weekDeltaHHMM = week?.totalDeltaHHMM ?? "00:00";
  const weekDelta = week?.totalDeltaMinutes ?? 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {user?.name?.split(" ")[0] || "Usuario"}
        </h1>
        <p className="text-muted-foreground">
          Bienvenido al sistema de asistencia
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado Hoy</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{workedHHMM}</span>
              <StatusBadge status={todayStatus} />
            </div>
            <p className="text-xs text-muted-foreground">
              {today?.firstInLocal
                ? `Entrada a las ${today.firstInLocal}`
                : "Marca tu entrada para iniciar"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekWorkedHHMM}</div>
            <p className="text-xs text-muted-foreground">
              de {formatPlanned(weekPlanned)} horas planificadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                weekDelta >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive"
              }`}
            >
              {weekDeltaHHMM}
            </div>
            <p className="text-xs text-muted-foreground">
              {weekDelta >= 0
                ? "horas a favor esta semana"
                : "horas pendientes esta semana"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clock Widget */}
      <ClockWidget />

      {/* Week Table */}
      <WeekTable />
    </div>
  );
}
