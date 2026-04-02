"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTodayStatus, useRecordEvent } from "@/hooks/use-attendance";
import { StatusBadge } from "@/components/attendance/status-badge";
import {
  LogIn,
  LogOut,
  Coffee,
  PlayCircle,
  Clock,
  Zap,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { EventType } from "@/lib/types";
import { useTenantTimezone, timePartsInTz } from "@/hooks/use-timezone";

function useRealtimeClock() {
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function ClockWidget() {
  const now = useRealtimeClock();
  const tz = useTenantTimezone();
  const { data: today, isLoading } = useTodayStatus();
  const recordEvent = useRecordEvent();
  const [pendingType, setPendingType] = useState<EventType | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customStartTime, setCustomStartTime] = useState("09:00");

  const status = today?.status ?? "NO_RECORD";
  const hasOpenShift = today?.hasOpenShift ?? false;
  const hasOpenBreak = today?.hasOpenBreak ?? false;
  const isHoliday = today?.isHoliday ?? false;

  const handleRecord = useCallback(
    async (eventType: EventType, customTime?: string) => {
      setPendingType(eventType);
      try {
        const result = await recordEvent.mutateAsync({ eventType, customTime });
        toast.success(result.message ?? "¡Registro exitoso!");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo registrar. Intenta de nuevo.");
      } finally {
        setPendingType(null);
      }
    },
    [recordEvent],
  );

  const handleStartClick = () => { setCustomStartTime("09:00"); setShowTimePicker(true); };
  const handleStartNow = () => { setShowTimePicker(false); handleRecord("START"); };
  const handleStartCustom = () => { setShowTimePicker(false); handleRecord("START", customStartTime); };

  const clockStr = now.toLocaleTimeString("es", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });

  const dateStr = now.toLocaleDateString("es", {
    timeZone: tz, weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Live worked calculation
  const liveWorked = (() => {
    if (today?.hasOpenShift && today?.firstInLocal) {
      const [h, m, s] = today.firstInLocal.split(":").map(Number);
      const startMin = h * 60 + m + (s || 0) / 60;
      const tp = timePartsInTz(tz);
      const nowMin = tp.hours * 60 + tp.minutes + tp.seconds / 60;
      return Math.max(0, Math.floor(nowMin - startMin) - (today.breakMinutes || 0));
    }
    return today?.workedMinutes ?? 0;
  })();
  const plannedDay = today?.plannedMinutes ?? 480;
  const pct = Math.min(Math.round((liveWorked / (plannedDay || 480)) * 100), 100);
  const workedHH = Math.floor(liveWorked / 60);
  const workedMM = liveWorked % 60;
  const workedStr = `${String(workedHH).padStart(2, "0")}:${String(workedMM).padStart(2, "0")}`;

  const actions: {
    type: EventType; label: string; icon: React.ReactNode;
    enabled: boolean; variant: "default" | "outline" | "secondary" | "destructive";
    customHandler?: () => void;
  }[] = [
    { type: "START", label: "Entrada", icon: <LogIn className="size-4" />, enabled: status === "NO_RECORD", variant: "default", customHandler: handleStartClick },
    { type: "BREAK_START", label: "Break", icon: <Coffee className="size-4" />, enabled: hasOpenShift && !hasOpenBreak, variant: "secondary" },
    { type: "BREAK_END", label: "Fin Break", icon: <PlayCircle className="size-4" />, enabled: hasOpenBreak, variant: "outline" },
    { type: "END", label: "Salida", icon: <LogOut className="size-4" />, enabled: hasOpenShift && !hasOpenBreak, variant: "destructive" },
  ];

  return (
    <>
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Holiday banner */}
        {isHoliday && (
          <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/30 px-5 py-2.5 border-b border-indigo-100 dark:border-indigo-900/30">
            <Flag className="size-4 text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              Hoy es feriado: {today?.holidayName ?? "Feriado"}
            </span>
          </div>
        )}

        <div className="p-6">
          {/* Clock + Date */}
          <div className="text-center mb-6">
            <div className="text-7xl font-mono font-black tabular-nums tracking-tighter bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
              {clockStr}
            </div>
            <p className="mt-1.5 text-sm capitalize text-muted-foreground">{dateStr}</p>
          </div>

          {/* Progress bar (jornada) */}
          {hasOpenShift && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium">Progreso de jornada</span>
                <span className="font-bold">{pct}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Today stats chips */}
          {!isLoading && today && (
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="flex items-center gap-2 rounded-full border bg-muted/30 px-4 py-2">
                <LogIn className="size-3.5 text-emerald-500" />
                <span className="text-sm font-semibold tabular-nums">
                  {today.firstInLocal?.substring(0, 5) ?? "--:--"}
                </span>
                <span className="text-xs text-muted-foreground">entrada</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border bg-muted/30 px-4 py-2">
                <Coffee className="size-3.5 text-amber-500" />
                <span className="text-sm font-semibold tabular-nums">
                  {today.breakMinutes > 0 ? `${today.breakMinutes}m` : "--"}
                </span>
                <span className="text-xs text-muted-foreground">break</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border bg-muted/30 px-4 py-2">
                <Clock className="size-3.5 text-blue-500" />
                <span className="text-sm font-bold tabular-nums">{workedStr}</span>
                <span className="text-xs text-muted-foreground">trabajado</span>
              </div>
            </div>
          )}

          {/* Status badge */}
          <div className="flex justify-center mb-5">
            <StatusBadge status={status} />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-4 gap-2 max-w-lg mx-auto">
            {actions.map((action) => (
              <Button
                key={action.type}
                variant={action.variant}
                size="lg"
                disabled={!action.enabled || isLoading || pendingType !== null}
                onClick={() => action.customHandler ? action.customHandler() : handleRecord(action.type)}
                className="flex-col gap-1 h-auto py-3"
              >
                {pendingType === action.type ? (
                  <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  action.icon
                )}
                <span className="text-[11px] font-semibold">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Time picker dialog */}
      <Dialog open={showTimePicker} onOpenChange={setShowTimePicker}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-5 text-primary" />
              Marcar Entrada
            </DialogTitle>
            <DialogDescription>
              Selecciona la hora de inicio de tu jornada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Hora de entrada</label>
              <input
                type="time"
                value={customStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-lg font-mono text-center focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground text-center">
                Hora actual: {clockStr.slice(0, 5)}
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleStartCustom} disabled={pendingType === "START"} className="w-full gap-2">
              {pendingType === "START" ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Clock className="size-4" />}
              Marcar a las {customStartTime}
            </Button>
            <Button variant="outline" onClick={handleStartNow} disabled={pendingType === "START"} className="w-full gap-2">
              <Zap className="size-4" />
              Marcar ahora ({clockStr.slice(0, 5)})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
