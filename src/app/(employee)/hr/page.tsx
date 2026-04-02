"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Cake,
  Trophy,
  Calendar,
  Megaphone,
  PartyPopper,
  Share2,
  Clock,
  Sparkles,
  GitBranch,
  Users,
  FolderOpen,
  Search,
  ChevronDown,
  ChevronRight,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Download,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
} from "lucide-react";
import { useHREvents } from "@/hooks/use-hr";
import { useCreatePost } from "@/hooks/use-feed";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  BirthdayEntry,
  AnniversaryEntry,
  UpcomingBirthday,
  HREvent,
  Employee,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Skeletons                                                         */
/* ------------------------------------------------------------------ */

function HeroSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="h-14 flex-1 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function AnnouncementSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}

function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

function OrgSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="mx-auto h-20 w-64 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Social post button                                                */
/* ------------------------------------------------------------------ */

function PublishSocialButton({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  const createPost = useCreatePost();
  const [published, setPublished] = useState(false);

  function handlePublish() {
    if (published) return;
    createPost.mutate(
      { content: message, visibility: "ALL" },
      { onSuccess: () => setPublished(true) }
    );
  }

  return (
    <Button
      variant={published ? "secondary" : "outline"}
      size="sm"
      disabled={createPost.isPending || published}
      onClick={handlePublish}
    >
      <Share2 className="size-3.5" />
      {published ? "Publicado" : label}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: initials from name                                        */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Birthday hero card                                                */
/* ------------------------------------------------------------------ */

function BirthdayHeroCard({
  entry,
  isAdmin,
}: {
  entry: BirthdayEntry;
  isAdmin: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 ring-1 ring-pink-200/60 dark:from-pink-950/30 dark:via-rose-950/20 dark:to-orange-950/20 dark:ring-pink-800/40">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-2 -top-2 size-16 rounded-full bg-pink-200/30 dark:bg-pink-700/20" />
        <div className="absolute bottom-3 left-3 size-8 rounded-full bg-orange-200/40 dark:bg-orange-700/20" />
        <div className="absolute right-8 top-8 size-5 rounded-full bg-yellow-200/50 dark:bg-yellow-700/20" />
      </div>

      <CardContent className="relative space-y-3 p-5">
        <div className="flex items-start justify-between">
          <span className="text-3xl" role="img" aria-label="pastel">
            🎂
          </span>
          <Badge
            variant="secondary"
            className="bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"
          >
            {entry.day}/{new Date().getMonth() + 1}
          </Badge>
        </div>

        <div>
          <p className="text-lg font-semibold tracking-tight text-pink-900 dark:text-pink-100">
            {entry.employeeName}
          </p>
          <p className="text-sm text-pink-700/80 dark:text-pink-300/70">
            {entry.position} &middot; {entry.area}
          </p>
          <p className="mt-1 text-xs font-medium text-pink-600/70 dark:text-pink-400/60">
            Cumple {entry.years} anos
          </p>
        </div>

        {isAdmin && (
          <PublishSocialButton
            label="Publicar en Social"
            message={`🎂 Feliz cumpleanos ${entry.employeeName}! Hoy celebramos su dia. ${entry.message}`}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Anniversary hero card                                             */
/* ------------------------------------------------------------------ */

function AnniversaryHeroCard({
  entry,
  isAdmin,
}: {
  entry: AnniversaryEntry;
  isAdmin: boolean;
}) {
  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 ring-1 ring-amber-200/60 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/20 dark:ring-amber-800/40">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-2 -top-2 size-14 rounded-full bg-amber-200/30 dark:bg-amber-700/20" />
        <div className="absolute bottom-2 right-4 size-10 rounded-full bg-yellow-200/40 dark:bg-yellow-700/20" />
      </div>

      <CardContent className="relative space-y-3 p-5">
        <div className="flex items-start justify-between">
          <span className="text-3xl" role="img" aria-label="trofeo">
            🏆
          </span>
          <div className="flex items-center gap-1.5">
            {entry.isQuinquenio && (
              <Badge className="bg-amber-500 text-white dark:bg-amber-600">
                Quinquenio
              </Badge>
            )}
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            >
              {entry.years} ano{entry.years === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>

        <div>
          <p className="text-lg font-semibold tracking-tight text-amber-900 dark:text-amber-100">
            {entry.employeeName}
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-300/70">
            {entry.position} &middot; {entry.area}
          </p>
        </div>

        {isAdmin && (
          <PublishSocialButton
            label="Publicar en Social"
            message={`🏆 Felicitaciones ${entry.employeeName} por ${entry.years} anos en la empresa! ${entry.message}`}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Upcoming timeline item                                            */
/* ------------------------------------------------------------------ */

function UpcomingTimelineItem({ entry }: { entry: UpcomingBirthday }) {
  const urgencyColor =
    entry.daysUntil === 0
      ? "bg-pink-500 ring-pink-300 dark:ring-pink-700"
      : entry.daysUntil <= 3
        ? "bg-orange-400 ring-orange-200 dark:ring-orange-700"
        : "bg-sky-400 ring-sky-200 dark:ring-sky-700";

  const urgencyLabel =
    entry.daysUntil === 0
      ? "Hoy!"
      : entry.daysUntil === 1
        ? "Manana"
        : `En ${entry.daysUntil} dias`;

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`size-3 shrink-0 rounded-full ring-4 ${urgencyColor}`}
        />
      </div>

      <div className="flex flex-1 items-center justify-between rounded-lg border bg-card/50 p-3 transition-colors hover:bg-muted/40">
        <div className="min-w-0">
          <p className="truncate font-medium">🎂 {entry.employeeName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {entry.area} &middot; {entry.position}
          </p>
        </div>
        <Badge
          variant={entry.daysUntil === 0 ? "default" : "secondary"}
          className={
            entry.daysUntil === 0
              ? "bg-pink-500 text-white dark:bg-pink-600"
              : ""
          }
        >
          {urgencyLabel}
        </Badge>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Announcement card                                                 */
/* ------------------------------------------------------------------ */

function AnnouncementCard({ evt }: { evt: HREvent }) {
  const isHoliday = evt.Type === "HOLIDAY";
  const badgeClass = isHoliday
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  const accentBorder = isHoliday
    ? "border-l-emerald-500"
    : "border-l-blue-500";

  return (
    <Card
      className={`border-l-4 ${accentBorder} transition-shadow hover:shadow-md`}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={badgeClass}>
            {isHoliday ? "Feriado" : "Comunicado"}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            {evt.EventDate}
          </span>
        </div>
        <p className="font-semibold leading-tight">{evt.Title}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {evt.Message}
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 1: Celebraciones                                              */
/* ------------------------------------------------------------------ */

function CelebracionesTab({
  isLoading,
  birthdays,
  anniversaries,
  upcomingBirthdays,
  announcements,
  isAdmin,
}: {
  isLoading: boolean;
  birthdays: BirthdayEntry[];
  anniversaries: AnniversaryEntry[];
  upcomingBirthdays: UpcomingBirthday[];
  announcements: HREvent[];
  isAdmin: boolean;
}) {
  const todayBirthdays = birthdays.filter(
    (b) => b.day === new Date().getDate()
  );
  const todayAnniversaries = anniversaries.filter(
    (a) => a.day === new Date().getDate()
  );
  const hasTodayCelebrations =
    todayBirthdays.length > 0 || todayAnniversaries.length > 0;

  return (
    <div className="space-y-6">
      {/* Today's celebrations */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <PartyPopper className="size-5 text-pink-500" />
          <h2 className="text-xl font-bold tracking-tight">
            Celebraciones de Hoy
          </h2>
          <Sparkles className="size-4 text-amber-400" />
        </div>

        {isLoading ? (
          <HeroSkeleton />
        ) : !hasTodayCelebrations ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/30">
                <PartyPopper className="size-7 text-pink-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                Sin celebraciones hoy
              </h3>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                No hay cumpleanos ni aniversarios hoy, pero revisa los
                proximos eventos mas abajo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {todayBirthdays.map((b) => (
              <BirthdayHeroCard
                key={b.employeeId}
                entry={b}
                isAdmin={isAdmin}
              />
            ))}
            {todayAnniversaries.map((a) => (
              <AnniversaryHeroCard
                key={a.employeeId}
                entry={a}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </section>

      {/* Birthdays of the month */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Cake className="size-5 text-pink-500" />
          <h2 className="text-lg font-semibold">Cumpleanos del Mes</h2>
        </div>

        {isLoading ? (
          <HeroSkeleton />
        ) : birthdays.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-pink-50 dark:bg-pink-950/30">
                <Cake className="size-6 text-pink-400" />
              </div>
              <h3 className="mt-3 font-semibold">Sin cumpleanos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No hay cumpleanos este mes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {birthdays.map((b) => (
              <BirthdayHeroCard
                key={b.employeeId}
                entry={b}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </section>

      {/* Anniversaries */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Aniversarios</h2>
        </div>

        {isLoading ? (
          <HeroSkeleton />
        ) : anniversaries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
                <Trophy className="size-6 text-amber-400" />
              </div>
              <h3 className="mt-3 font-semibold">Sin aniversarios</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No hay aniversarios laborales este mes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {anniversaries.map((a) => (
              <AnniversaryHeroCard
                key={a.employeeId}
                entry={a}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming birthdays timeline */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-sky-500" />
          <h2 className="text-lg font-semibold">Proximos Cumpleanos</h2>
        </div>

        {isLoading ? (
          <TimelineSkeleton />
        ) : upcomingBirthdays.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-950/30">
                <Calendar className="size-6 text-sky-400" />
              </div>
              <h3 className="mt-3 font-semibold">Sin proximos cumpleanos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No hay cumpleanos en los proximos 30 dias.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {upcomingBirthdays.map((u) => (
              <UpcomingTimelineItem key={u.employeeId} entry={u} />
            ))}
          </div>
        )}
      </section>

      {/* Announcements & holidays */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-blue-500" />
          <h2 className="text-lg font-semibold">Comunicados y Feriados</h2>
        </div>

        {isLoading ? (
          <AnnouncementSkeleton />
        ) : announcements.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30">
                <Megaphone className="size-6 text-blue-400" />
              </div>
              <h3 className="mt-3 font-semibold">Sin comunicados</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No hay comunicados ni feriados este mes.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {announcements.map((evt) => (
              <AnnouncementCard key={evt.NotificationID} evt={evt} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook: fetch employees for Organigrama + Directorio                */
/* ------------------------------------------------------------------ */

function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/employees/directory");
        if (!res.ok) throw new Error("Error al cargar empleados");
        const json = await res.json();
        if (!cancelled) {
          setEmployees(Array.isArray(json) ? json : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error desconocido");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { employees, isLoading, error };
}

/* ------------------------------------------------------------------ */
/*  Tab 2: Organigrama                                                */
/* ------------------------------------------------------------------ */

function OrganigramaTab({
  employees,
  isLoading,
  error,
}: {
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
}) {
  const [search, setSearch] = useState("");
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.FullName.toLowerCase().includes(q) ||
        e.Position.toLowerCase().includes(q) ||
        e.Area.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const emp of filtered) {
      const area = emp.Area || "Sin Area";
      if (!map.has(area)) map.set(area, []);
      map.get(area)!.push(emp);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Expand all areas when searching
  useEffect(() => {
    if (search.trim()) {
      setExpandedAreas(new Set(grouped.map(([area]) => area)));
    }
  }, [search, grouped]);

  function toggleArea(area: string) {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  }

  function toggleAll() {
    if (expandedAreas.size === grouped.length) {
      setExpandedAreas(new Set());
    } else {
      setExpandedAreas(new Set(grouped.map(([area]) => area)));
    }
  }

  if (isLoading) return <OrgSkeleton />;

  if (error) {
    return (
      <EmptyState
        icon={GitBranch}
        title="Error al cargar organigrama"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Company header */}
      <div className="flex justify-center">
        <Card className="w-fit border-0 bg-gradient-to-r from-indigo-50 to-blue-50 ring-1 ring-indigo-200/60 dark:from-indigo-950/30 dark:to-blue-950/20 dark:ring-indigo-800/40">
          <CardContent className="flex items-center gap-3 px-6 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
              <Building2 className="size-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-indigo-900 dark:text-indigo-100">
                Organigrama
              </p>
              <p className="text-sm text-indigo-600/70 dark:text-indigo-400/60">
                {employees.length} colaboradores &middot; {grouped.length} areas
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + expand/collapse */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, cargo o area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={toggleAll}>
          {expandedAreas.size === grouped.length
            ? "Colapsar todo"
            : "Expandir todo"}
        </Button>
      </div>

      {/* Area sections */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin resultados"
          description="No se encontraron empleados con ese criterio de busqueda."
        />
      ) : (
        <div className="space-y-3">
          {grouped.map(([area, members]) => {
            const isExpanded = expandedAreas.has(area);
            return (
              <Card key={area} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleArea(area)}
                  className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex size-8 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/50">
                    <Briefcase className="size-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{area}</p>
                    <p className="text-xs text-muted-foreground">
                      {members.length} miembro
                      {members.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">{members.length}</Badge>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {members.map((emp) => (
                        <div
                          key={emp.EmployeeID}
                          className="flex items-center gap-3 rounded-lg border bg-card/50 p-3 transition-colors hover:bg-muted/40"
                        >
                          <Avatar size="lg">
                            {emp.AvatarUrl && (
                              <AvatarImage
                                src={emp.AvatarUrl}
                                alt={emp.FullName}
                              />
                            )}
                            <AvatarFallback>
                              {getInitials(emp.FullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {emp.FullName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {emp.Position}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 3: Directorio                                                 */
/* ------------------------------------------------------------------ */

function DirectorioTab({
  employees,
  isLoading,
  error,
}: {
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
}) {
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("all");

  const areas = useMemo(() => {
    const set = new Set(employees.map((e) => e.Area).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    let list = employees;
    if (areaFilter !== "all") {
      list = list.filter((e) => e.Area === areaFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.FullName.toLowerCase().includes(q) ||
          e.Email.toLowerCase().includes(q) ||
          e.Position.toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, search, areaFilter]);

  if (isLoading) return <CardGridSkeleton count={8} />;

  if (error) {
    return (
      <EmptyState
        icon={Users}
        title="Error al cargar directorio"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="all">Todas las areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Employee grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin resultados"
          description="No se encontraron empleados con los filtros aplicados."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((emp) => (
            <Card
              key={emp.EmployeeID}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="flex flex-col items-center text-center">
                  <Avatar size="lg" className="size-16">
                    {emp.AvatarUrl && (
                      <AvatarImage src={emp.AvatarUrl} alt={emp.FullName} />
                    )}
                    <AvatarFallback className="text-lg">
                      {getInitials(emp.FullName)}
                    </AvatarFallback>
                  </Avatar>

                  <h3 className="mt-3 font-semibold leading-tight">
                    {emp.FullName}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {emp.Position}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {emp.Area}
                  </Badge>

                  <div className="mt-4 w-full space-y-2 text-left">
                    {emp.Email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="size-3.5 shrink-0" />
                        <span className="truncate">{emp.Email}</span>
                      </div>
                    )}
                    {emp.Phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="size-3.5 shrink-0" />
                        <span className="truncate">{emp.Phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Mostrando {filtered.length} de {employees.length} colaboradores
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 4: Documentos                                                 */
/* ------------------------------------------------------------------ */

interface HRDocItem {
  id: string;
  title: string;
  category: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  contentType: string;
  uploadedBy: string;
  createdAt: string;
}

function getFileIcon(contentType: string) {
  if (contentType === "application/pdf") return FileText;
  if (contentType.includes("spreadsheet")) return FileSpreadsheet;
  if (contentType.includes("presentation")) return File;
  if (contentType.startsWith("image/")) return ImageIcon;
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOC_CATEGORIES = ["Todos", "Politicas", "Manuales", "Formatos", "Otros"];

function DocumentosTab() {
  const [docs, setDocs] = useState<HRDocItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");

  const loadDocs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/hr/documents");
      if (!res.ok) throw new Error("Error al cargar documentos");
      const json = await res.json();
      setDocs(Array.isArray(json) ? json : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(() => {
    let list = docs;
    if (categoryFilter !== "Todos") {
      list = list.filter((d) => d.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.fileName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [docs, search, categoryFilter]);

  if (isLoading) return <CardGridSkeleton count={6} />;

  if (error) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Error al cargar documentos"
        description={error}
      />
    );
  }

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Sin documentos"
        description="Aun no hay documentos publicados. Los administradores pueden subir documentos desde el panel de gestion."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {DOC_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "Todos" ? "Todas las categorias" : c}
            </option>
          ))}
        </select>
      </div>

      {/* Document grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin resultados"
          description="No se encontraron documentos con los filtros aplicados."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => {
            const Icon = getFileIcon(doc.contentType);
            return (
              <Card
                key={doc.id}
                className="transition-shadow hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold leading-tight">
                        {doc.title}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {doc.fileName}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="secondary">{doc.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSize)}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Subido por {doc.uploadedBy} el{" "}
                    {new Date(doc.createdAt).toLocaleDateString("es-PE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>

                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Download className="size-4" />
                    Descargar
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Mostrando {filtered.length} de {docs.length} documentos
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function HRPage() {
  const { data, isLoading } = useHREvents();
  const { data: session } = useSession();
  const isAdmin =
    (session?.user as { role?: string })?.role === "ADMIN";

  const birthdays: BirthdayEntry[] = data?.birthdays ?? [];
  const anniversaries: AnniversaryEntry[] = data?.anniversaries ?? [];
  const upcomingBirthdays: UpcomingBirthday[] =
    data?.upcomingBirthdays ?? [];
  const announcements: HREvent[] = data?.announcements ?? [];

  const {
    employees,
    isLoading: employeesLoading,
    error: employeesError,
  } = useEmployees();

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Recursos Humanos
        </h1>
        <p className="text-muted-foreground">
          Celebraciones, organigrama, directorio y documentos del equipo
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="celebraciones">
        <TabsList>
          <TabsTrigger value="celebraciones">
            <PartyPopper className="size-4" />
            <span className="hidden sm:inline">Celebraciones</span>
          </TabsTrigger>
          <TabsTrigger value="organigrama">
            <GitBranch className="size-4" />
            <span className="hidden sm:inline">Organigrama</span>
          </TabsTrigger>
          <TabsTrigger value="directorio">
            <Users className="size-4" />
            <span className="hidden sm:inline">Directorio</span>
          </TabsTrigger>
          <TabsTrigger value="documentos">
            <FolderOpen className="size-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="celebraciones">
          <CelebracionesTab
            isLoading={isLoading}
            birthdays={birthdays}
            anniversaries={anniversaries}
            upcomingBirthdays={upcomingBirthdays}
            announcements={announcements}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="organigrama">
          <OrganigramaTab
            employees={employees}
            isLoading={employeesLoading}
            error={employeesError}
          />
        </TabsContent>

        <TabsContent value="directorio">
          <DirectorioTab
            employees={employees}
            isLoading={employeesLoading}
            error={employeesError}
          />
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
