"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Cake,
  Trophy,
  Calendar,
  Plus,
  Trash2,
  Megaphone,
} from "lucide-react";
import { useHREvents, useArchiveHREvent } from "@/hooks/use-hr";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import type { BirthdayEntry, AnniversaryEntry, UpcomingBirthday, HREvent } from "@/lib/types";

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function AdminHRPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data, isLoading } = useHREvents(month);
  const archiveMutation = useArchiveHREvent();

  const birthdays: BirthdayEntry[] = data?.birthdays ?? [];
  const anniversaries: AnniversaryEntry[] = data?.anniversaries ?? [];
  const upcomingBirthdays: UpcomingBirthday[] = data?.upcomingBirthdays ?? [];
  const announcements: HREvent[] = data?.announcements ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión RRHH</h1>
          <p className="text-muted-foreground">
            Administra eventos, cumpleaños y aniversarios
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="month-select">Mes</Label>
            <Input
              id="month-select"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <Button render={<Link href="/admin/hr/create" />}>
            <Plus className="size-4" />
            Crear Evento
          </Button>
        </div>
      </div>

      {/* Cumpleaños del Mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="size-5" />
            Cumpleaños del Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : birthdays.length === 0 ? (
            <EmptyState
              icon={Cake}
              title="Sin cumpleaños"
              description="No hay cumpleaños este mes"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Edad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {birthdays.map((b) => (
                  <TableRow key={b.employeeId}>
                    <TableCell className="font-medium">
                      🎂 {b.employeeName}
                    </TableCell>
                    <TableCell>{b.area}</TableCell>
                    <TableCell>{b.position}</TableCell>
                    <TableCell>{b.eventDate}</TableCell>
                    <TableCell>{b.years} años</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Aniversarios del Mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            Aniversarios del Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : anniversaries.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Sin aniversarios"
              description="No hay aniversarios este mes"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Fecha Ingreso</TableHead>
                  <TableHead>Años</TableHead>
                  <TableHead>Quinquenio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anniversaries.map((a) => (
                  <TableRow key={a.employeeId}>
                    <TableCell className="font-medium">
                      {a.employeeName}
                    </TableCell>
                    <TableCell>{a.area}</TableCell>
                    <TableCell>{a.position}</TableCell>
                    <TableCell>{a.eventDate}</TableCell>
                    <TableCell>{a.years} años</TableCell>
                    <TableCell>
                      {a.isQuinquenio ? (
                        <Badge variant="default">🏆 Quinquenio</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Próximos Cumpleaños */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Próximos Cumpleaños (30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : upcomingBirthdays.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin próximos cumpleaños"
              description="No hay cumpleaños en los próximos 30 días"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingBirthdays.map((u) => (
                <Card key={u.employeeId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">🎂 {u.employeeName}</p>
                        <p className="text-sm text-muted-foreground">
                          {u.area} — {u.position}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {u.daysUntil === 0
                          ? "¡Hoy!"
                          : u.daysUntil === 1
                            ? "Mañana"
                            : `${u.daysUntil} días`}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comunicados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-5" />
            Comunicados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Sin comunicados"
              description="No hay comunicados ni feriados este mes"
            />
          ) : (
            <div className="space-y-3">
              {announcements.map((evt) => (
                <div
                  key={evt.NotificationID}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={evt.Type === "HOLIDAY" ? "secondary" : "default"}>
                        {evt.Type === "HOLIDAY" ? "Feriado" : "Comunicado"}
                      </Badge>
                      <span className="font-medium">{evt.Title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{evt.Message}</p>
                    <p className="text-xs text-muted-foreground">
                      Fecha: {evt.EventDate}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => archiveMutation.mutate(evt.NotificationID)}
                    disabled={archiveMutation.isPending}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
