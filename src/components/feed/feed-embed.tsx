"use client";

import {
  Clock,
  LogIn,
  LogOut,
  Coffee,
  TrendingUp,
  TrendingDown,
  Calendar,
  Trophy,
  Flame,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostEmbed } from "@/lib/types/post";

/* ── Helpers ─────────────────────────────────────────────────── */

function fmtMin(min: number): string {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ── Main Component ──────────────────────────────────────────── */

export function FeedEmbed({ embed }: { embed: PostEmbed }) {
  switch (embed.type) {
    case "attendance_today":
      return <AttendanceTodayEmbed data={embed.data} />;
    case "week_summary":
      return <WeekSummaryEmbed data={embed.data} />;
    case "achievement":
      return <AchievementEmbed data={embed.data} />;
    default:
      return null;
  }
}

/* ── Attendance Today ────────────────────────────────────────── */

function AttendanceTodayEmbed({ data }: { data: Record<string, unknown> }) {
  const firstIn = (data.firstIn as string) ?? "--:--";
  const lastOut = (data.lastOut as string) ?? "--:--";
  const worked = (data.workedHHMM as string) ?? "00:00";
  const planned = Number(data.plannedMinutes ?? 480);
  const workedMin = Number(data.workedMinutes ?? 0);
  const delta = Number(data.deltaMinutes ?? 0);
  const breakMin = Number(data.breakMinutes ?? 0);
  const status = (data.status as string) ?? "NO_RECORD";
  const date = (data.date as string) ?? "";
  const pct = Math.min(Math.round((workedMin / (planned || 480)) * 100), 100);

  return (
    <div className="mt-3 rounded-xl border bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-100 dark:border-blue-900/30">
        <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10">
          <Clock className="size-3.5 text-blue-500" />
        </div>
        <div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Mi jornada de hoy</p>
          {date && <p className="text-[10px] text-muted-foreground">{new Date(date + "T12:00:00").toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</p>}
        </div>
        <div className="ml-auto">
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold",
            status === "OK" || status === "CLOSED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : status === "OPEN" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "bg-muted text-muted-foreground"
          )}>
            {status === "OK" || status === "CLOSED" ? "Completo" : status === "OPEN" ? "En curso" : status}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-px bg-blue-100/50 dark:bg-blue-900/10">
        <StatCell icon={LogIn} label="Entrada" value={firstIn} color="text-emerald-500" />
        <StatCell icon={LogOut} label="Salida" value={lastOut} color="text-red-400" />
        <StatCell icon={Coffee} label="Break" value={`${breakMin}m`} color="text-amber-500" />
        <StatCell icon={Clock} label="Trabajado" value={worked} color="text-blue-500" bold />
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-muted-foreground">Progreso</span>
          <span className="font-bold">{pct}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-primary/60",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">de {fmtMin(planned)}</span>
          <span className={cn("text-xs font-bold", delta >= 0 ? "text-emerald-600" : "text-red-500")}>
            {delta >= 0 ? "+" : ""}{fmtMin(delta)} balance
          </span>
        </div>
      </div>
    </div>
  );
}

function StatCell({ icon: Icon, label, value, color, bold }: {
  icon: typeof Clock; label: string; value: string; color: string; bold?: boolean;
}) {
  return (
    <div className="flex flex-col items-center py-2.5 bg-card/80">
      <Icon className={cn("size-3.5 mb-1", color)} />
      <p className={cn("text-sm tabular-nums", bold ? "font-black" : "font-semibold")}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ── Week Summary ────────────────────────────────────────────── */

function WeekSummaryEmbed({ data }: { data: Record<string, unknown> }) {
  const totalWorked = (data.totalWorkedHHMM as string) ?? "00:00";
  const totalPlanned = Number(data.totalPlannedMinutes ?? 0);
  const totalDelta = Number(data.totalDeltaMinutes ?? 0);
  const days = (data.days as Array<{ weekday: string; workedMinutes: number; status: string; date: string }>) ?? [];
  const fromDate = (data.fromDate as string) ?? "";
  const toDate = (data.toDate as string) ?? "";
  const maxWorked = Math.max(...days.map((d) => d.workedMinutes), 480);

  return (
    <div className="mt-3 rounded-xl border bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-100 dark:border-violet-900/30">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10">
            <Calendar className="size-3.5 text-violet-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Resumen semanal</p>
            {fromDate && toDate && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(fromDate + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" })} — {new Date(toDate + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-black tabular-nums">{totalWorked}</p>
          <p className={cn("text-[10px] font-semibold", totalDelta >= 0 ? "text-emerald-600" : "text-red-500")}>
            {totalDelta >= 0 ? "+" : ""}{fmtMin(totalDelta)}
          </p>
        </div>
      </div>

      {/* Day bars chart */}
      <div className="px-4 py-3">
        <div className="flex items-end gap-1.5 h-20">
          {days.map((day) => {
            const h = day.workedMinutes > 0 ? Math.max(8, (day.workedMinutes / maxWorked) * 100) : 4;
            const isWeekend = new Date(day.date + "T12:00:00").getDay() % 6 === 0;
            const isComplete = day.status === "OK" || day.status === "CLOSED" || day.status === "REGULARIZED";
            const isHoliday = day.status === "HOLIDAY";
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "64px" }}>
                  <div
                    className={cn(
                      "w-full max-w-[24px] rounded-t-md transition-all",
                      isHoliday ? "bg-indigo-300 dark:bg-indigo-600"
                        : isComplete ? "bg-violet-500"
                        : isWeekend ? "bg-muted"
                        : day.workedMinutes > 0 ? "bg-violet-300 dark:bg-violet-600" : "bg-muted/50",
                    )}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium">
                  {day.weekday?.substring(0, 2) ?? new Date(day.date + "T12:00:00").toLocaleDateString("es-PE", { weekday: "narrow" })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
          <span>{fmtMin(totalPlanned)} planificadas</span>
          <span className={cn("font-semibold", totalDelta >= 0 ? "text-emerald-600" : "text-red-500")}>
            {totalDelta >= 0 ? <TrendingUp className="size-3 inline mr-0.5" /> : <TrendingDown className="size-3 inline mr-0.5" />}
            {totalDelta >= 0 ? "A favor" : "Pendiente"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Achievement ─────────────────────────────────────────────── */

function AchievementEmbed({ data }: { data: Record<string, unknown> }) {
  const title = (data.title as string) ?? "¡Logro desbloqueado!";
  const description = (data.description as string) ?? "";
  const stat = (data.stat as string) ?? "";
  const statLabel = (data.statLabel as string) ?? "";
  const icon = (data.icon as string) ?? "trophy";

  const IconComponent = icon === "flame" ? Flame : icon === "target" ? Target : Trophy;

  return (
    <div className="mt-3 rounded-xl border bg-gradient-to-br from-amber-50/60 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/20">
          <IconComponent className="size-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">{title}</p>
          {description && <p className="text-xs text-amber-700/70 dark:text-amber-300/70 mt-0.5">{description}</p>}
        </div>
        {stat && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{stat}</p>
            {statLabel && <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60">{statLabel}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
