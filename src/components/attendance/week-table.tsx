"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useWeekSummary } from "@/hooks/use-attendance";
import { StatusBadge } from "@/components/attendance/status-badge";
import { ChevronLeft, ChevronRight } from "lucide-react";

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatWeekday(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return capitalize(
    d.toLocaleDateString("es", { weekday: "short" }),
  );
}

function deltaClass(delta: number): string {
  if (delta > 0) return "text-green-600 dark:text-green-400";
  if (delta < 0) return "text-destructive";
  return "";
}

export function WeekTable() {
  const [offset, setOffset] = useState(0);
  const { data: week, isLoading } = useWeekSummary(offset);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Resumen Semanal</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[7rem] text-center text-sm font-medium">
              {week ? `${week.fromDate} — ${week.toDate}` : "..."}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={offset >= 0}
              onClick={() => setOffset((o) => o + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead className="text-right">Break</TableHead>
                <TableHead className="text-right">Trabajo</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Cargando...
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && week?.days.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Sin datos para esta semana
                  </TableCell>
                </TableRow>
              )}

              {week?.days.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="font-medium">
                    {formatWeekday(day.date)}
                  </TableCell>
                  <TableCell>{formatDate(day.date)}</TableCell>
                  <TableCell>{day.firstInLocal ?? "--:--"}</TableCell>
                  <TableCell>{day.lastOutLocal ?? "--:--"}</TableCell>
                  <TableCell className="text-right">
                    {day.breakMinutes > 0 ? `${day.breakMinutes} min` : "--"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {day.workedHHMM || "00:00"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${deltaClass(day.deltaMinutes)}`}
                  >
                    {day.deltaHHMM || "00:00"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={day.status} />
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals row */}
              {week && (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell colSpan={4}>Total</TableCell>
                  <TableCell className="text-right">
                    {week.totalBreakMinutes > 0
                      ? `${week.totalBreakMinutes} min`
                      : "--"}
                  </TableCell>
                  <TableCell className="text-right">
                    {week.totalWorkedHHMM || "00:00"}
                  </TableCell>
                  <TableCell
                    className={`text-right ${deltaClass(week.totalDeltaMinutes)}`}
                  >
                    {week.totalDeltaHHMM || "00:00"}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
