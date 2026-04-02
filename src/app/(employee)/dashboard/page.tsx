"use client";

import { useState, useEffect, useMemo } from "react";
import { useTenantTimezone, timePartsInTz, todayInTz } from "@/hooks/use-timezone";
import { useTenantConfig } from "@/hooks/use-tenant";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  LogIn,
  Target,
  Cake,
  Flag,
  Megaphone,
  History,
  FileText,
  UserCircle,
  PenLine,
  Users,
  ArrowRight,
  Calendar,
  Trophy,
} from "lucide-react";
import { useTodayStatus, useWeekSummary } from "@/hooks/use-attendance";
import { useMyProfile } from "@/hooks/use-employee";
import { useHREvents } from "@/hooks/use-hr";
import { useMyRequests } from "@/hooks/use-requests";
import { ClockWidget } from "@/components/attendance/clock-widget";
import { WeekTable } from "@/components/attendance/week-table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BirthdayEntry, AnniversaryEntry, HREvent } from "@/lib/types";

function fmtMins(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getGreeting(hours: number): string {
  if (hours < 12) return "Buenos días";
  if (hours < 18) return "Buenas tardes";
  return "Buenas noches";
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const tz = useTenantTimezone();
  const user = session?.user;

  const { data: profile } = useMyProfile();
  const { data: today } = useTodayStatus();
  const { data: week } = useWeekSummary(0);
  const { data: tenant } = useTenantConfig();

  // HR events for current month
  const todayDate = todayInTz(tz);
  const monthStr = todayDate.substring(0, 7);
  const { data: hrData } = useHREvents(monthStr);

  // Requests
  const { data: requestsData } = useMyRequests();

  // Redirect to onboarding
  useEffect(() => {
    if (profile?.employee?.dni?.startsWith("PENDING")) {
      router.push("/onboarding");
    }
  }, [profile, router]);

  const todayStatus = today?.status ?? "NO_RECORD";
  const weekPlanned = week?.totalPlannedMinutes ?? 0;

  // Live worked time (timezone-aware)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!today?.hasOpenShift) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [today?.hasOpenShift]);

  const liveWorkedMinutes = (() => {
    if (today?.hasOpenShift && today?.firstInLocal) {
      const [h, m, s] = today.firstInLocal.split(":").map(Number);
      const startMin = h * 60 + m + (s || 0) / 60;
      const tp = timePartsInTz(tz);
      const nowMin = tp.hours * 60 + tp.minutes + tp.seconds / 60;
      return Math.max(0, Math.floor(nowMin - startMin) - (today.breakMinutes || 0));
    }
    return today?.workedMinutes ?? 0;
  })();

  const workedHHMM = fmtMins(liveWorkedMinutes);
  const plannedDay = today?.plannedMinutes ?? 480;
  const pct = Math.min(Math.round((liveWorkedMinutes / (plannedDay || 480)) * 100), 100);

  // Week totals
  const weekStaticWorked = week?.totalWorkedMinutes ?? 0;
  const todayStaticWorked = today?.workedMinutes ?? 0;
  const weekLiveWorked = weekStaticWorked - todayStaticWorked + liveWorkedMinutes;
  const weekDelta = weekLiveWorked - weekPlanned;

  // Greeting
  const tp = timePartsInTz(tz);
  const greeting = getGreeting(tp.hours);
  const firstName = user?.name?.split(" ")[0] || "Usuario";

  // Completed days & workable days (excluding holidays and weekends)
  const completedDays = week?.days.filter((d) =>
    ["OK", "CLOSED", "REGULARIZED"].includes(d.status)
  ).length ?? 0;
  const holidaysInWeek = week?.days.filter((d) => d.status === "HOLIDAY").length ?? 0;
  const weekendsInWeek = week?.days.filter((d) => {
    const dow = new Date(d.date + "T12:00:00").getDay();
    return dow === 0 || dow === 6;
  }).length ?? 0;
  const workableDays = 7 - weekendsInWeek - holidaysInWeek;

  // Today's birthdays
  const todayBirthdays = useMemo(() => {
    const birthdays: BirthdayEntry[] = hrData?.birthdays ?? [];
    const dayStr = todayDate.substring(5); // "MM-DD"
    return birthdays.filter((b) => b.eventDate.substring(5) === dayStr);
  }, [hrData, todayDate]);

  // Today's anniversaries
  const todayAnniversaries = useMemo(() => {
    const anniversaries: AnniversaryEntry[] = hrData?.anniversaries ?? [];
    const dayStr = todayDate.substring(5);
    return anniversaries.filter((a) => a.eventDate.substring(5) === dayStr);
  }, [hrData, todayDate]);

  // Upcoming holidays (next 30 days)
  const upcomingHolidays = useMemo(() => {
    const holidays = tenant?.settings?.holidays ?? [];
    const today = new Date(todayDate + "T12:00:00");
    return holidays
      .map((h) => {
        const hDate = new Date(h.date + "T12:00:00");
        const diff = Math.floor((hDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...h, daysUntil: diff };
      })
      .filter((h) => h.daysUntil > 0 && h.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 3);
  }, [tenant, todayDate]);

  // Latest announcement
  const latestAnnouncement = useMemo(() => {
    const announcements: HREvent[] = hrData?.announcements ?? [];
    return announcements.filter((a) => a.Type === "ANNOUNCEMENT")[0] ?? null;
  }, [hrData]);

  // Pending requests count
  const pendingRequests = useMemo(() => {
    const requests = requestsData?.requests ?? [];
    return requests.filter((r: { status: string }) => r.status === "PENDING").length;
  }, [requestsData]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {today?.isHoliday
              ? `Hoy es feriado — ${today.holidayName ?? "¡Disfruta tu día!"}`
              : today?.hasOpenShift
                ? "Tu jornada está en curso"
                : todayStatus === "OK" || todayStatus === "CLOSED"
                  ? "¡Jornada completada! Buen trabajo"
                  : "Marca tu entrada para iniciar la jornada"}
          </p>
        </div>
        {today?.hasOpenShift && (
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">En jornada</span>
          </div>
        )}
      </div>

      {/* Stats grid — all clickable → /history */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/history" className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hoy</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <Clock className="size-4 text-blue-500" />
            </div>
          </div>
          <p className="text-3xl font-black tabular-nums">{workedHHMM}</p>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">de {fmtMins(plannedDay)}</span>
              <span className="font-bold">{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-700",
                pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-primary/60")}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
          {today?.firstInLocal && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <LogIn className="size-3" /> Entrada a las {today.firstInLocal.substring(0, 5)}
            </p>
          )}
        </Link>

        <Link href="/history" className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semana</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30">
              <CalendarDays className="size-4 text-violet-500" />
            </div>
          </div>
          <p className="text-3xl font-black tabular-nums">{fmtMins(weekLiveWorked)}</p>
          <p className="mt-1 text-xs text-muted-foreground">de {fmtMins(weekPlanned)} planificadas</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-violet-500 transition-all duration-700"
              style={{ width: `${weekPlanned > 0 ? Math.min(100, Math.round((weekLiveWorked / weekPlanned) * 100)) : 0}%` }} />
          </div>
        </Link>

        <Link href="/history" className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Balance</span>
            <div className={cn("flex size-8 items-center justify-center rounded-lg",
              weekDelta >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30")}>
              {weekDelta >= 0 ? <TrendingUp className="size-4 text-emerald-500" /> : <TrendingDown className="size-4 text-red-500" />}
            </div>
          </div>
          <p className={cn("text-3xl font-black tabular-nums", weekDelta >= 0 ? "text-emerald-600" : "text-red-500")}>
            {weekDelta >= 0 ? "+" : "-"}{fmtMins(Math.abs(weekDelta))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{weekDelta >= 0 ? "horas a favor" : "horas pendientes"}</p>
        </Link>

        <Link href="/history" className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jornadas</span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <Target className="size-4 text-amber-500" />
            </div>
          </div>
          <p className="text-3xl font-black tabular-nums">{completedDays}<span className="text-lg text-muted-foreground font-medium">/{workableDays}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">completas esta semana</p>
        </Link>
      </div>

      {/* Events strip — all clickable */}
      {(todayBirthdays.length > 0 || todayAnniversaries.length > 0 || upcomingHolidays.length > 0 || latestAnnouncement) && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {todayBirthdays.map((b) => (
            <Link key={b.employeeId} href="/hr" className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group">
              <div className="flex size-10 items-center justify-center rounded-full bg-pink-100 dark:bg-pink-950/30">
                <Cake className="size-5 text-pink-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">🎂 {b.employeeName}</p>
                <p className="text-xs text-muted-foreground">¡Cumple años hoy!</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
            </Link>
          ))}

          {todayAnniversaries.map((a) => (
            <Link key={a.employeeId} href="/hr" className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
                <Trophy className="size-5 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">🏆 {a.employeeName}</p>
                <p className="text-xs text-muted-foreground">{a.years} años en la empresa</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
            </Link>
          ))}

          {upcomingHolidays.map((h) => (
            <Link key={h.date} href="/hr" className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 group">
              <div className="flex size-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950/30">
                <Flag className="size-5 text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.daysUntil === 1 ? "Mañana" : `En ${h.daysUntil} días`}
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
            </Link>
          ))}

          {latestAnnouncement && (
            <Link href="/hr" className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm sm:col-span-2 lg:col-span-1 transition-all hover:shadow-md hover:-translate-y-0.5 group">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/30">
                <Megaphone className="size-5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{latestAnnouncement.Title}</p>
                <p className="text-xs text-muted-foreground truncate">{latestAnnouncement.Message?.substring(0, 60)}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
            </Link>
          )}
        </div>
      )}

      {/* Quick access */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acceso rápido</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y">
          <QuickLink href="/history" icon={History} label="Historial" color="text-blue-500" />
          <QuickLink href="/requests" icon={FileText} label="Solicitudes" color="text-violet-500" badge={pendingRequests > 0 ? pendingRequests : undefined} />
          <QuickLink href="/hr" icon={Users} label="RRHH" color="text-emerald-500" />
          <QuickLink href="/profile" icon={UserCircle} label="Mi Perfil" color="text-amber-500" />
          {tenant?.settings?.features?.social !== false && (
            <QuickLink href="/feed" icon={Megaphone} label="Feed" color="text-pink-500" />
          )}
        </div>
      </div>

      {/* Clock Widget */}
      <ClockWidget />

      {/* Week Table */}
      <WeekTable />
    </div>
  );
}

function QuickLink({
  href, icon: Icon, label, color, badge,
}: {
  href: string; icon: typeof Clock; label: string; color: string; badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 group"
    >
      <Icon className={cn("size-5", color)} />
      <span className="text-sm font-medium group-hover:text-primary transition-colors">{label}</span>
      {badge !== undefined && (
        <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
          {badge}
        </Badge>
      )}
      <ArrowRight className="size-3.5 text-muted-foreground/30 ml-auto group-hover:text-primary/50 transition-colors" />
    </Link>
  );
}
