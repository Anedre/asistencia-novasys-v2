"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEmployeeDetail } from "@/hooks/use-employee";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/attendance/status-badge";

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatTime(local: string | null): string {
  if (!local) return "-";
  // local is ISO string, extract time portion
  try {
    return local.slice(11, 16);
  } catch {
    return local;
  }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "-"}</span>
    </div>
  );
}

function workModeBadge(mode: string) {
  const styles: Record<string, string> = {
    REMOTE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ONSITE:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    HYBRID:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  };
  const labels: Record<string, string> = {
    REMOTE: "Remoto",
    ONSITE: "Presencial",
    HYBRID: "Hibrido",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[mode] ?? ""}`}
    >
      {labels[mode] ?? mode}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, isLoading, isError } = useEmployeeDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="outline" render={<Link href="/admin/employees" />}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <DetailSkeleton />
      </div>
    );
  }

  if (isError || !data?.employee) {
    return (
      <div className="space-y-6">
        <Button variant="outline" render={<Link href="/admin/employees" />}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <p className="text-sm text-destructive">
          Error al cargar el detalle del empleado.
        </p>
      </div>
    );
  }

  const emp = data.employee;
  const attendance = data.recentAttendance ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" render={<Link href="/admin/employees" />}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{emp.fullName}</h1>
          <p className="text-muted-foreground">{emp.email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Employee Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informacion Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              {emp.avatarUrl ? (
                <img
                  src={emp.avatarUrl}
                  alt={emp.fullName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                  {emp.firstName?.[0] ?? ""}
                  {emp.lastName?.[0] ?? ""}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold">{emp.fullName}</p>
                <p className="text-sm text-muted-foreground">{emp.position}</p>
              </div>
            </div>
            <InfoRow label="Email" value={emp.email} />
            <InfoRow label="Telefono" value={emp.phone} />
            <InfoRow label="DNI" value={emp.dni} />
            <InfoRow label="Area" value={emp.area} />
            <InfoRow label="Cargo" value={emp.position} />
            <InfoRow
              label="Rol"
              value={
                <Badge variant={emp.role === "ADMIN" ? "default" : "outline"}>
                  {emp.role}
                </Badge>
              }
            />
            <InfoRow label="Modalidad" value={workModeBadge(emp.workMode)} />
          </CardContent>
        </Card>

        {/* Schedule & Dates Card */}
        <Card>
          <CardHeader>
            <CardTitle>Datos Laborales</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Fecha de Ingreso" value={emp.hireDate} />
            <InfoRow label="Fecha de Nacimiento" value={emp.birthDate} />
            <InfoRow
              label="Horario"
              value={
                emp.schedule
                  ? `${emp.schedule.startTime} - ${emp.schedule.endTime}`
                  : "-"
              }
            />
            <InfoRow
              label="Break Programado"
              value={
                emp.schedule
                  ? `${emp.schedule.breakMinutes} min`
                  : "-"
              }
            />
            <InfoRow
              label="Estado"
              value={
                emp.status === "ACTIVE" ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    Inactivo
                  </span>
                )
              }
            />
            <InfoRow label="Creado" value={emp.createdAt?.slice(0, 10)} />
            <InfoRow label="Actualizado" value={emp.updatedAt?.slice(0, 10)} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Asistencia Reciente (30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Sin registros de asistencia en los ultimos 30 dias.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Trabajado</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map(
                  (a: {
                    date: string;
                    firstInLocal: string | null;
                    lastOutLocal: string | null;
                    breakMinutes: number;
                    workedMinutes: number;
                    status: string;
                  }) => (
                    <TableRow key={a.date}>
                      <TableCell className="font-medium">{a.date}</TableCell>
                      <TableCell>{formatTime(a.firstInLocal)}</TableCell>
                      <TableCell>{formatTime(a.lastOutLocal)}</TableCell>
                      <TableCell>{a.breakMinutes} min</TableCell>
                      <TableCell>{formatMinutes(a.workedMinutes)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
