"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  Shield,
  User,
  Coffee,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/attendance/status-badge";

/* ── Helpers ── */

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatTime(local: string | null): string {
  if (!local) return "-";
  try {
    return local.slice(11, 16);
  } catch {
    return local;
  }
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[mode] ?? "bg-muted text-muted-foreground"}`}
    >
      {labels[mode] ?? mode}
    </span>
  );
}

function statusBadgeInline(status: string) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Activo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Inactivo
    </span>
  );
}

/* ── Info row for detail cards ── */

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {Icon && (
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div className="flex flex-1 items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right">{value ?? "-"}</span>
      </div>
    </div>
  );
}

/* ── Loading skeleton ── */

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

/* ── Main Page ── */

export default function EmployeeDetailPage() {
  const params = useParams();
  // URL-decode the id to handle special characters like "#" (e.g., "EMP#uuid")
  const rawId = params.id as string;
  const id = decodeURIComponent(rawId);

  const { data, isLoading, isError } = useEmployeeDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" render={<Link href="/admin/employees" />}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Volver a empleados
        </Button>
        <DetailSkeleton />
      </div>
    );
  }

  if (isError || !data?.employee) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" render={<Link href="/admin/employees" />}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Volver a empleados
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">
              Error al cargar el detalle del empleado.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              render={<Link href="/admin/employees" />}
            >
              Regresar al listado
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emp = data.employee;
  const attendance = data.recentAttendance ?? [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" render={<Link href="/admin/employees" />}>
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Volver a empleados
      </Button>

      {/* ── Profile header ── */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar className="h-20 w-20 text-xl">
          {emp.avatarUrl ? (
            <AvatarImage src={emp.avatarUrl} alt={emp.fullName} />
          ) : null}
          <AvatarFallback className="text-lg font-bold">
            {emp.firstName?.[0] ?? ""}
            {emp.lastName?.[0] ?? ""}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {emp.fullName}
            </h1>
            {statusBadgeInline(emp.status)}
          </div>
          <p className="text-muted-foreground">{emp.position}</p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-muted-foreground">
            {emp.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {emp.email}
              </span>
            )}
            {emp.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {emp.phone}
              </span>
            )}
            {emp.area && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {emp.area}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={emp.role === "ADMIN" ? "default" : "outline"}>
            <Shield className="h-3 w-3 mr-1" />
            {emp.role}
          </Badge>
          {workModeBadge(emp.workMode)}
        </div>
      </div>

      <Separator />

      {/* ── Tabs ── */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">
            <User className="h-4 w-4 mr-1.5" />
            Informacion
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <Calendar className="h-4 w-4 mr-1.5" />
            Asistencia
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <Clock className="h-4 w-4 mr-1.5" />
            Horario
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Info ── */}
        <TabsContent value="info" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos Personales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <InfoRow icon={User} label="Nombre completo" value={emp.fullName} />
                <InfoRow icon={Mail} label="Email" value={emp.email} />
                <InfoRow icon={Phone} label="Telefono" value={emp.phone} />
                <InfoRow label="DNI" value={emp.dni} />
                <InfoRow
                  icon={Calendar}
                  label="Fecha de nacimiento"
                  value={emp.birthDate ?? "-"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Datos Laborales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <InfoRow icon={Briefcase} label="Cargo" value={emp.position} />
                <InfoRow icon={MapPin} label="Area" value={emp.area} />
                <InfoRow
                  label="Rol"
                  value={
                    <Badge variant={emp.role === "ADMIN" ? "default" : "outline"}>
                      {emp.role}
                    </Badge>
                  }
                />
                <InfoRow label="Modalidad" value={workModeBadge(emp.workMode)} />
                <InfoRow
                  icon={Calendar}
                  label="Fecha de ingreso"
                  value={emp.hireDate ?? "-"}
                />
                <InfoRow label="Creado" value={emp.createdAt?.slice(0, 10)} />
                <InfoRow label="Actualizado" value={emp.updatedAt?.slice(0, 10)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: Attendance ── */}
        <TabsContent value="attendance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Asistencia Reciente (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sin registros de asistencia en los ultimos 30 dias.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                            <TableCell className="font-medium">
                              {a.date}
                            </TableCell>
                            <TableCell>{formatTime(a.firstInLocal)}</TableCell>
                            <TableCell>{formatTime(a.lastOutLocal)}</TableCell>
                            <TableCell>{a.breakMinutes} min</TableCell>
                            <TableCell>
                              {formatMinutes(a.workedMinutes)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={a.status} />
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Schedule ── */}
        <TabsContent value="schedule" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Horario Asignado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <InfoRow
                  icon={Clock}
                  label="Hora de entrada"
                  value={emp.schedule?.startTime ?? "-"}
                />
                <InfoRow
                  icon={Clock}
                  label="Hora de salida"
                  value={emp.schedule?.endTime ?? "-"}
                />
                <InfoRow
                  icon={Coffee}
                  label="Break programado"
                  value={
                    emp.schedule?.breakMinutes != null
                      ? `${emp.schedule.breakMinutes} min`
                      : "-"
                  }
                />
                <InfoRow
                  label="Tipo de horario"
                  value={emp.schedule?.type ?? emp.scheduleType ?? "-"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumen de Jornada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                {emp.schedule?.startTime && emp.schedule?.endTime ? (
                  <>
                    <InfoRow
                      label="Jornada"
                      value={`${emp.schedule.startTime} - ${emp.schedule.endTime}`}
                    />
                    <InfoRow
                      label="Horas programadas"
                      value={(() => {
                        const [sh, sm] = emp.schedule.startTime.split(":").map(Number);
                        const [eh, em] = emp.schedule.endTime.split(":").map(Number);
                        const totalMin =
                          eh * 60 + em - (sh * 60 + sm) - (emp.schedule.breakMinutes ?? 0);
                        return formatMinutes(Math.max(0, totalMin));
                      })()}
                    />
                    <InfoRow
                      label="Break"
                      value={`${emp.schedule.breakMinutes ?? 0} min`}
                    />
                    <InfoRow label="Modalidad" value={workModeBadge(emp.workMode)} />
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <Clock className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      No hay horario asignado para este empleado.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
