"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTodayStatus, useRecordEvent } from "@/hooks/use-attendance";
import { StatusBadge } from "@/components/attendance/status-badge";
import {
  LogIn,
  LogOut,
  Coffee,
  PlayCircle,
} from "lucide-react";
import type { EventType } from "@/lib/types";

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
  const { data: today, isLoading } = useTodayStatus();
  const recordEvent = useRecordEvent();
  const [pendingType, setPendingType] = useState<EventType | null>(null);

  const status = today?.status ?? "NO_RECORD";
  const hasOpenShift = today?.hasOpenShift ?? false;
  const hasOpenBreak = today?.hasOpenBreak ?? false;

  const handleRecord = useCallback(
    async (eventType: EventType) => {
      setPendingType(eventType);
      try {
        const result = await recordEvent.mutateAsync({ eventType });
        alert(result.message ?? "Registro exitoso");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Error al registrar");
      } finally {
        setPendingType(null);
      }
    },
    [recordEvent],
  );

  const clockStr = now.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const dateStr = now.toLocaleDateString("es", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const actions: {
    type: EventType;
    label: string;
    icon: React.ReactNode;
    enabled: boolean;
    variant: "default" | "outline" | "secondary" | "destructive";
  }[] = [
    {
      type: "START",
      label: "Marcar Entrada",
      icon: <LogIn className="h-4 w-4" />,
      enabled: status === "NO_RECORD",
      variant: "default",
    },
    {
      type: "BREAK_START",
      label: "Inicio Break",
      icon: <Coffee className="h-4 w-4" />,
      enabled: hasOpenShift && !hasOpenBreak,
      variant: "secondary",
    },
    {
      type: "BREAK_END",
      label: "Fin Break",
      icon: <PlayCircle className="h-4 w-4" />,
      enabled: hasOpenBreak,
      variant: "outline",
    },
    {
      type: "END",
      label: "Marcar Salida",
      icon: <LogOut className="h-4 w-4" />,
      enabled: hasOpenShift && !hasOpenBreak,
      variant: "destructive",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reloj de Asistencia</CardTitle>
            <CardDescription>
              Marca tu entrada, break y salida desde aqui
            </CardDescription>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col items-center gap-6 py-8">
        {/* Real-time clock */}
        <div className="text-center">
          <div className="text-6xl font-mono font-bold tabular-nums">
            {clockStr}
          </div>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {dateStr}
          </p>
        </div>

        {/* Today summary */}
        {!isLoading && today && (
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="text-center">
              <p className="font-medium text-foreground">
                {today.firstInLocal ?? "--:--"}
              </p>
              <p>Entrada</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">
                {today.breakMinutes > 0 ? `${today.breakMinutes} min` : "--"}
              </p>
              <p>Break</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">
                {today.workedHHMM || "00:00"}
              </p>
              <p>Trabajado</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid w-full max-w-md grid-cols-2 gap-3">
          {actions.map((action) => (
            <Button
              key={action.type}
              variant={action.variant}
              size="lg"
              disabled={
                !action.enabled ||
                isLoading ||
                pendingType !== null
              }
              onClick={() => handleRecord(action.type)}
              className="gap-2"
            >
              {pendingType === action.type ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                action.icon
              )}
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
