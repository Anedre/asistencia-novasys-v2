"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/attendance/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useAdminAttendance } from "@/hooks/use-employee";
import { Users, Clock, AlertTriangle } from "lucide-react";

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime(isoOrLocal: string | null): string {
  if (!isoOrLocal) return "—";
  // If it's an ISO string with T, extract the time part
  if (isoOrLocal.includes("T")) {
    const timePart = isoOrLocal.split("T")[1];
    // Remove timezone offset, keep HH:MM:SS or HH:MM
    return timePart?.replace(/[-+]\d{2}:\d{2}$/, "").slice(0, 8) ?? isoOrLocal;
  }
  return isoOrLocal;
}

function getTodayLima(): string {
  return new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

interface AttendanceSummary {
  employeeId: string;
  workDate: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  status: string;
  anomalies: string[];
  hasOpenBreak: boolean;
  hasOpenShift: boolean;
}

interface AttendanceResponse {
  ok: boolean;
  date: string;
  summaries: AttendanceSummary[];
}

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(getTodayLima);
  const { data, isLoading, isError } = useAdminAttendance(selectedDate);
  const response = data as AttendanceResponse | undefined;
  const summaries = response?.summaries ?? [];

  const totalPresentes = summaries.filter(
    (s) => s.firstInLocal !== null
  ).length;
  const enBreak = summaries.filter((s) => s.hasOpenBreak).length;
  const conAnomalias = summaries.filter((s) => s.anomalies.length > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Asistencia del Dia
          </h1>
          <p className="text-muted-foreground">
            Vista de asistencia de todos los empleados
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="date-select">Fecha</Label>
            <Input
              id="date-select"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
            />
          </div>
        </div>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          Error al cargar la asistencia. Intenta de nuevo.
        </p>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Presentes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : totalPresentes}
            </div>
            <p className="text-xs text-muted-foreground">
              han marcado entrada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Break</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : enBreak}
            </div>
            <p className="text-xs text-muted-foreground">
              actualmente en descanso
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
              {isLoading ? <Skeleton className="h-8 w-12" /> : conAnomalias}
            </div>
            <p className="text-xs text-muted-foreground">
              registros con alertas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Registro del {selectedDate}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : summaries.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin registros"
              description="No hay registros de asistencia para esta fecha."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Trabajo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Anomalias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => {
                    const email = s.employeeId.split("#")[1] ?? s.employeeId;
                    return (
                      <TableRow key={s.employeeId}>
                        <TableCell className="font-medium">{email}</TableCell>
                        <TableCell>{formatTime(s.firstInLocal)}</TableCell>
                        <TableCell>{formatTime(s.lastOutLocal)}</TableCell>
                        <TableCell>{formatMinutes(s.breakMinutes)}</TableCell>
                        <TableCell>{formatMinutes(s.workedMinutes)}</TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell>
                          {s.anomalies.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.anomalies.map((a) => (
                                <Badge key={a} variant="destructive">
                                  {a}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
