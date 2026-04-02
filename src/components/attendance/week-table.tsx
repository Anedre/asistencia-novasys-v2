"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWeekSummary } from "@/hooks/use-attendance";
import { StatusBadge } from "@/components/attendance/status-badge";
import { RegularizeDialog } from "@/components/attendance/regularize-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Flag,
  Minus,
  PenLine,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { todayInTz } from "@/hooks/use-timezone";

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function formatWeekday(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const wd = d.toLocaleDateString("es-PE", { weekday: "long" });
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}

function shortWeekday(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const wd = d.toLocaleDateString("es-PE", { weekday: "short" });
  return wd.charAt(0).toUpperCase() + wd.slice(1);
}

function isWeekend(iso: string): boolean {
  const d = new Date(iso + "T12:00:00").getDay();
  return d === 0 || d === 6;
}

function formatRange(from: string, to: string): string {
  const f = new Date(from + "T12:00:00");
  const t = new Date(to + "T12:00:00");
  const fd = f.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  const td = t.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
  return `${fd} — ${td}`;
}

const REG_OK = new Set(["MISSING", "NO_RECORD", "ABSENT", "SHORT", "INCOMPLETE"]);

export function WeekTable() {
  const [offset, setOffset] = useState(0);
  const { data: week, isLoading } = useWeekSummary(offset);
  const [regDate, setRegDate] = useState<string | null>(null);

  const totalDelta = week?.totalDeltaMinutes ?? 0;
  const todayStr = todayInTz("America/Lima");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5 text-muted-foreground" />
              Resumen Semanal
            </CardTitle>
            <CardDescription className="mt-0.5">
              {week ? formatRange(week.fromDate, week.toDate) : "Cargando..."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setOffset((o) => o - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {offset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setOffset(0)}
              >
                Hoy
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={offset >= 0}
              onClick={() => setOffset((o) => o + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Week stats bar */}
        {week && !isLoading && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Clock className="size-3.5 text-blue-500" />
                <span className="text-xs font-medium text-muted-foreground">Trabajado</span>
              </div>
              <p className="text-lg font-bold tabular-nums text-blue-600">{week.totalWorkedHHMM}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Minus className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Planificado</span>
              </div>
              <p className="text-lg font-bold tabular-nums">{fmtMin(week.totalPlannedMinutes)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1.5">
                {totalDelta >= 0 ? (
                  <TrendingUp className="size-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="size-3.5 text-red-500" />
                )}
                <span className="text-xs font-medium text-muted-foreground">Balance</span>
              </div>
              <p className={cn("text-lg font-bold tabular-nums", totalDelta >= 0 ? "text-emerald-600" : "text-red-500")}>
                {totalDelta >= 0 ? "+" : ""}{week.totalDeltaHHMM}
              </p>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
          </div>
        )}

        {!isLoading && week?.days.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">Sin datos para esta semana</p>
          </div>
        )}

        {!isLoading && week && (
          <div className="divide-y">
            {week.days.map((day) => {
              const wknd = isWeekend(day.date);
              const isHol = day.status === "HOLIDAY";
              const isToday = day.date === todayStr;
              const noWork = day.status === "NO_RECORD" || day.status === "MISSING";
              const hasData = !!day.firstInLocal;

              const canReg = REG_OK.has(day.status) && day.date < todayStr && !wknd && !isHol;

              return (
                <div
                  key={day.date}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 transition-colors",
                    isToday && "bg-primary/5",
                    isHol && "bg-indigo-50/50 dark:bg-indigo-950/10",
                    wknd && !isHol && "bg-muted/30 opacity-60",
                    !wknd && !isHol && hasData && "hover:bg-muted/30 cursor-pointer",
                  )}
                  onClick={() => {
                    if (hasData && !wknd && !isHol) {
                      window.location.href = "/history";
                    }
                  }}
                >
                  {/* Day info */}
                  <div className="w-24 shrink-0">
                    <div className="flex items-center gap-2">
                      <p className={cn("text-sm font-semibold", isToday && "text-primary")}>
                        {shortWeekday(day.date)}
                      </p>
                      {isToday && (
                        <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground uppercase">
                          Hoy
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateShort(day.date)}</p>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {isHol ? (
                      <div className="flex items-center gap-2">
                        <Flag className="size-3.5 text-indigo-500" />
                        <span className="text-sm font-medium text-indigo-600">
                          {day.holidayName ?? "Feriado"}
                        </span>
                      </div>
                    ) : wknd ? (
                      <span className="text-xs text-muted-foreground/50 italic">No laborable</span>
                    ) : hasData ? (
                      <div className="flex items-center gap-4 text-sm tabular-nums">
                        <span className="text-muted-foreground">
                          {day.firstInLocal?.substring(0, 5) ?? "--:--"}
                          <span className="mx-1 text-muted-foreground/30">→</span>
                          {day.lastOutLocal?.substring(0, 5) ?? "--:--"}
                        </span>
                        {day.breakMinutes > 0 && (
                          <span className="text-xs text-muted-foreground/60">{day.breakMinutes}min break</span>
                        )}
                      </div>
                    ) : noWork ? (
                      <span className="text-xs text-muted-foreground/50">Sin registro</span>
                    ) : null}
                  </div>

                  {/* Worked time */}
                  <div className="w-16 text-right shrink-0">
                    {!wknd && !isHol && (
                      <p className="text-sm font-bold tabular-nums">
                        {day.workedHHMM || "00:00"}
                      </p>
                    )}
                  </div>

                  {/* Balance */}
                  <div className="w-16 text-right shrink-0">
                    {!wknd && !isHol && day.deltaMinutes !== 0 && (
                      <p className={cn(
                        "text-xs font-semibold tabular-nums",
                        day.deltaMinutes > 0 ? "text-emerald-600" : "text-red-500",
                      )}>
                        {day.deltaMinutes > 0 ? "+" : ""}{day.deltaHHMM}
                      </p>
                    )}
                  </div>

                  {/* Status + Actions */}
                  <div className="w-32 shrink-0 flex items-center justify-end gap-2">
                    {!wknd && <StatusBadge status={day.status} />}
                    {canReg && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); setRegDate(day.date); }}
                      >
                        <PenLine className="size-3" />
                        Regularizar
                      </Button>
                    )}
                    {hasData && !wknd && !isHol && (
                      <ExternalLink className="size-3 text-muted-foreground/30" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <RegularizeDialog
        open={regDate !== null}
        onOpenChange={(o) => { if (!o) setRegDate(null); }}
        workDate={regDate ?? ""}
      />
    </Card>
  );
}

function fmtMin(min: number): string {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
