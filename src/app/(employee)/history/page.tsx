"use client";

import { useState } from "react";
import { useAttendanceHistory } from "@/hooks/use-attendance";
import { StatusBadge } from "@/components/attendance/status-badge";
import { RegularizeDialog } from "@/components/attendance/regularize-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PenLineIcon } from "lucide-react";

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Statuses that allow self-regularization */
const REGULARIZABLE_STATUSES = new Set([
  "MISSING",
  "NO_RECORD",
  "ABSENT",
  "SHORT",
  "INCOMPLETE",
]);

interface HistoryDay {
  date: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  workedHHMM: string;
  status: string;
  reasonCode?: string;
  reasonLabel?: string;
  anomalies?: string[];
}

export default function HistoryPage() {
  const defaultRange = getMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [regularizeDate, setRegularizeDate] = useState<string | null>(null);

  const { data, isLoading, isError } = useAttendanceHistory(dateFrom, dateTo);
  const days = (data?.days ?? []) as HistoryDay[];

  const totalWorked = days.reduce((acc, d) => acc + (d.workedMinutes ?? 0), 0);
  const totalBreak = days.reduce((acc, d) => acc + (d.breakMinutes ?? 0), 0);

  // Only allow regularizing past dates (not today or future)
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Historial de Asistencia
        </h1>
        <p className="text-muted-foreground">
          Revisa tu historial de marcaciones
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="dateFrom">Desde</Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dateTo">Hasta</Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Results Table */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando historial...</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Error al cargar el historial. Intenta de nuevo.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Trabajo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Razon</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No hay registros en el rango seleccionado
                  </TableCell>
                </TableRow>
              ) : (
                days.map((day) => {
                  const canRegularize =
                    REGULARIZABLE_STATUSES.has(day.status) && day.date < today;

                  return (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">{day.date}</TableCell>
                      <TableCell>{day.firstInLocal ?? "--:--"}</TableCell>
                      <TableCell>{day.lastOutLocal ?? "--:--"}</TableCell>
                      <TableCell>{formatMinutes(day.breakMinutes)}</TableCell>
                      <TableCell>{day.workedHHMM ?? formatMinutes(day.workedMinutes)}</TableCell>
                      <TableCell>
                        <StatusBadge status={day.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {day.reasonLabel ?? day.reasonCode ?? "-"}
                      </TableCell>
                      <TableCell>
                        {canRegularize && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setRegularizeDate(day.date)}
                          >
                            <PenLineIcon className="size-3.5" />
                            Regularizar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {days.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">Total</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="font-bold">{formatMinutes(totalBreak)}</TableCell>
                  <TableCell className="font-bold">{formatMinutes(totalWorked)}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}

      {/* Regularize Dialog */}
      <RegularizeDialog
        open={regularizeDate !== null}
        onOpenChange={(open) => {
          if (!open) setRegularizeDate(null);
        }}
        workDate={regularizeDate ?? ""}
      />
    </div>
  );
}
