"use client";

import { Cake, Trophy, Calendar, Megaphone } from "lucide-react";
import { useHREvents } from "@/hooks/use-hr";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type { BirthdayEntry, AnniversaryEntry, UpcomingBirthday, HREvent } from "@/lib/types";

function SectionSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function HRPage() {
  const { data, isLoading } = useHREvents();

  const birthdays: BirthdayEntry[] = data?.birthdays ?? [];
  const anniversaries: AnniversaryEntry[] = data?.anniversaries ?? [];
  const upcomingBirthdays: UpcomingBirthday[] = data?.upcomingBirthdays ?? [];
  const announcements: HREvent[] = data?.announcements ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Noticias y Eventos</h1>
        <p className="text-muted-foreground">
          Novedades, cumpleaños y aniversarios del equipo
        </p>
      </div>

      {/* Cumpleaños del Mes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="size-5" />
            🎂 Cumpleaños del Mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SectionSkeleton />
          ) : birthdays.length === 0 ? (
            <EmptyState
              icon={Cake}
              title="Sin cumpleaños"
              description="No hay cumpleaños este mes"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {birthdays.map((b) => (
                <Card key={b.employeeId}>
                  <CardContent className="p-4">
                    <p className="font-medium">🎂 {b.employeeName}</p>
                    <p className="text-sm text-muted-foreground">{b.area}</p>
                    <p className="text-sm text-muted-foreground">
                      {b.eventDate} — {b.years} años
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aniversarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            🏆 Aniversarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SectionSkeleton />
          ) : anniversaries.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Sin aniversarios"
              description="No hay aniversarios este mes"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {anniversaries.map((a) => (
                <Card key={a.employeeId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{a.employeeName}</p>
                      {a.isQuinquenio && (
                        <Badge variant="default">🏆 Quinquenio</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {a.years} año{a.years === 1 ? "" : "s"} en la empresa
                    </p>
                    <p className="text-sm text-muted-foreground">{a.area}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Próximos Cumpleaños */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Próximos Cumpleaños
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SectionSkeleton />
          ) : upcomingBirthdays.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Sin próximos cumpleaños"
              description="No hay cumpleaños en los próximos 30 días"
            />
          ) : (
            <div className="space-y-2">
              {upcomingBirthdays.map((u) => (
                <div
                  key={u.employeeId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
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
                        : `En ${u.daysUntil} días`}
                  </Badge>
                </div>
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
            📢 Comunicados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SectionSkeleton />
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Sin comunicados"
              description="No hay comunicados ni feriados este mes"
            />
          ) : (
            <div className="space-y-3">
              {announcements.map((evt) => (
                <Card key={evt.NotificationID}>
                  <CardContent className="p-4 space-y-1">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
