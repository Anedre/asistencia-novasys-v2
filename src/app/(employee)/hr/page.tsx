"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useHREvents } from "@/hooks/use-hr";
import { useCreatePost } from "@/hooks/use-feed";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  BirthdayEntry,
  AnniversaryEntry,
  UpcomingBirthday,
  HREvent,
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
      {/* confetti dots */}
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
      {/* timeline dot */}
      <div className="flex flex-col items-center">
        <div
          className={`size-3 shrink-0 rounded-full ring-4 ${urgencyColor}`}
        />
      </div>

      {/* content */}
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
    ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  const accentBorder = isHoliday
    ? "border-l-sky-500"
    : "border-l-amber-500";

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

  // Separate today's events from the rest
  const todayBirthdays = birthdays.filter(
    (b) => b.day === new Date().getDate()
  );
  const todayAnniversaries = anniversaries.filter(
    (a) => a.day === new Date().getDate()
  );
  const hasTodayCelebrations =
    todayBirthdays.length > 0 || todayAnniversaries.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Noticias y Eventos
        </h1>
        <p className="text-muted-foreground">
          Novedades, cumpleanos y aniversarios del equipo
        </p>
      </div>

      {/* ============================================ */}
      {/* TODAY'S CELEBRATIONS - big & prominent       */}
      {/* ============================================ */}
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

      {/* ============================================ */}
      {/* BIRTHDAYS OF THE MONTH                       */}
      {/* ============================================ */}
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
                No hay cumpleanos este mes. El siguiente mes traera
                nuevas celebraciones.
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

      {/* ============================================ */}
      {/* ANNIVERSARIES                                */}
      {/* ============================================ */}
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
                No hay aniversarios laborales este mes. Pronto habra mas
                hitos que celebrar.
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

      {/* ============================================ */}
      {/* UPCOMING - timeline style                    */}
      {/* ============================================ */}
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
              <h3 className="mt-3 font-semibold">
                Sin proximos cumpleanos
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No hay cumpleanos en los proximos 30 dias. Disfruta la
                calma antes de la siguiente celebracion.
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

      {/* ============================================ */}
      {/* ANNOUNCEMENTS - card grid                    */}
      {/* ============================================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-violet-500" />
          <h2 className="text-lg font-semibold">Comunicados</h2>
        </div>

        {isLoading ? (
          <AnnouncementSkeleton />
        ) : announcements.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/30">
                <Megaphone className="size-6 text-violet-400" />
              </div>
              <h3 className="mt-3 font-semibold">Sin comunicados</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No hay comunicados ni feriados este mes. Cuando haya
                novedades las veras aqui.
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
