"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useHREvents } from "@/hooks/use-hr";
import { useCreatePost } from "@/hooks/use-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/nova/page-header";
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
    <div className="hr-grid cols-240">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="hr-stack gap-12">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="hr-skeleton-row">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="h-14 flex-1 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function AnnouncementSkeleton() {
  return (
    <div className="hr-grid cols-280">
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}

function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="hr-grid cols-220">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

function OrgSkeleton() {
  return (
    <div className="hr-stack gap-16">
      <Skeleton className="mx-auto h-20 w-64 rounded-xl" />
      <div className="hr-grid cols-280">
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
      // API accepts "company" | "area" | "private" — "company" = visible to whole tenant
      { content: message, visibility: "company" },
      {
        onSuccess: () => setPublished(true),
        onError: (err) => {
          // Don't fake success on failure
          console.error("Error publicando al feed:", err);
        },
      }
    );
  }

  return (
    <button
      type="button"
      className={`btn ${published ? "ghost" : "outline"} btn-sm`}
      disabled={createPost.isPending || published}
      onClick={handlePublish}
    >
      <IconSvg d={Icons.share} size={13} />
      {published ? "Publicado" : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Birthday hero card                                                */
/* ------------------------------------------------------------------ */

/**
 * Hero card used for both birthday and anniversary highlights at the top of
 * the HR page. The shared layout (emoji + chips on top, name+meta in the
 * middle, optional social-share button at the bottom) is provided by the
 * `.celebration-card` CSS class. Only the emoji, chips, copy and the
 * `--accent` overlay vary by variant.
 */
function CelebrationHero({
  emoji,
  emojiLabel,
  chips,
  name,
  meta,
  detail,
  action,
}: {
  emoji: string;
  emojiLabel: string;
  chips: React.ReactNode;
  name: string;
  meta: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="celebration-card">
      <span className="celebration-card-emoji" role="img" aria-label={emojiLabel}>
        {emoji}
      </span>
      <div className="celebration-card-body">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <p className="celebration-card-name">{name}</p>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>{chips}</div>
        </div>
        <p className="celebration-card-meta">{meta}</p>
        {detail && <p className="celebration-card-detail">{detail}</p>}
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
    </div>
  );
}

function BirthdayHeroCard({
  entry,
  isAdmin,
}: {
  entry: BirthdayEntry;
  isAdmin: boolean;
}) {
  return (
    <CelebrationHero
      emoji="🎂"
      emojiLabel="pastel"
      name={entry.employeeName}
      meta={`${entry.position} · ${entry.area}`}
      detail={`Cumple ${entry.years} años`}
      chips={
        <span className="type-tag accent">
          {entry.day}/{new Date().getMonth() + 1}
        </span>
      }
      action={
        isAdmin && (
          <PublishSocialButton
            label="Publicar en Social"
            message={`🎂 ¡Feliz cumpleaños ${entry.employeeName}! Hoy celebramos su día. ${entry.message}`}
          />
        )
      }
    />
  );
}

function AnniversaryHeroCard({
  entry,
  isAdmin,
}: {
  entry: AnniversaryEntry;
  isAdmin: boolean;
}) {
  return (
    <CelebrationHero
      emoji="🏆"
      emojiLabel="trofeo"
      name={entry.employeeName}
      meta={`${entry.position} · ${entry.area}`}
      chips={
        <>
          {entry.isQuinquenio && <span className="type-tag warn">Quinquenio</span>}
          <span className="type-tag warn">
            {entry.years} año{entry.years === 1 ? "" : "s"}
          </span>
        </>
      }
      action={
        isAdmin && (
          <PublishSocialButton
            label="Publicar en Social"
            message={`🏆 ¡Felicitaciones ${entry.employeeName} por ${entry.years} años en la empresa! ${entry.message}`}
          />
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Upcoming birthday card (with progress-bar countdown)              */
/* ------------------------------------------------------------------ */

function UpcomingTimelineItem({ entry }: { entry: UpcomingBirthday }) {
  // Progress = closeness; 0 days → full bar, 30 days → empty
  const pct = Math.max(0, Math.min(100, ((30 - entry.daysUntil) / 30) * 100));
  const urgency =
    entry.daysUntil === 0 ? "urgent" : entry.daysUntil <= 7 ? "soon" : "";
  const label =
    entry.daysUntil === 0
      ? "¡Hoy!"
      : entry.daysUntil === 1
      ? "Mañana"
      : `En ${entry.daysUntil} días`;

  const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const dateStr = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(entry.eventDate);
    if (!m) return entry.eventDate;
    return `${Number(m[3])} ${MONTHS_ES[Number(m[2]) - 1]}`;
  })();

  return (
    <div className={`hra-upcoming ${urgency}`}>
      <div className="hra-upcoming-head">
        <NovaAvatar name={entry.employeeName} size={36} variant="plain" />
        <div className="hra-upcoming-info">
          <div className="hra-upcoming-name">{entry.employeeName}</div>
          <div className="hra-upcoming-area">
            {entry.area} · {entry.position}
          </div>
        </div>
      </div>
      <div className="hra-upcoming-progress" aria-hidden>
        <div
          className="hra-upcoming-progress-fill"
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      <div className="hra-upcoming-foot">
        <span className="hra-upcoming-date">🎂 {dateStr}</span>
        <span className="hra-upcoming-count">{label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Today celebration big banner                                      */
/* ------------------------------------------------------------------ */

function TodayHeroBanner({
  birthdays,
  anniversaries,
}: {
  birthdays: BirthdayEntry[];
  anniversaries: AnniversaryEntry[];
}) {
  const total = birthdays.length + anniversaries.length;
  const quinq = anniversaries.filter((a) => a.isQuinquenio).length;
  const names = [
    ...birthdays.map((b) => b.employeeName),
    ...anniversaries.map((a) => a.employeeName),
  ];
  const hasBday = birthdays.length > 0;
  const emoji = hasBday ? "🎂" : "🎉";

  let title: string;
  if (total === 1) {
    title = hasBday
      ? `¡Hoy es cumpleaños de ${names[0]}!`
      : `¡Hoy es aniversario de ${names[0]}!`;
  } else {
    title = `¡${total} celebraciones hoy!`;
  }

  const sub = total === 1
    ? hasBday
      ? `${birthdays[0].position} · ${birthdays[0].area}`
      : `${anniversaries[0].years} años en la empresa${quinq > 0 ? " · ¡Quinquenio!" : ""}`
    : `${birthdays.length} cumpleaños · ${anniversaries.length} aniversario(s)${quinq > 0 ? ` · ${quinq} quinquenio(s)` : ""}`;

  return (
    <div className="hra-today">
      <span className="hra-today-emoji" role="img" aria-label="celebración">{emoji}</span>
      <div className="hra-today-main">
        <h3 className="hra-today-title">{title}</h3>
        <p className="hra-today-sub">{sub}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Announcement card                                                 */
/* ------------------------------------------------------------------ */

function AnnouncementCard({ evt }: { evt: HREvent }) {
  const isHoliday = evt.Type === "HOLIDAY";

  return (
    <div className={`panel announcement-card${isHoliday ? " holiday" : ""}`}>
      <div className="announcement-card-meta">
        <span className={`type-tag ${isHoliday ? "muted" : "accent"}`}>
          {isHoliday ? "Feriado" : "Comunicado"}
        </span>
        <span className="announcement-card-date">{evt.EventDate}</span>
      </div>
      <p className="announcement-card-title">{evt.Title}</p>
      <p className="announcement-card-body">{evt.Message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section header helper                                              */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon,
  title,
  variant = "default",
}: {
  icon: React.ReactNode;
  title: string;
  variant?: "default" | "lg";
}) {
  return (
    <div className="hr-section-head">
      <span className="hr-section-head-icon">{icon}</span>
      <h2 className={`hr-section-head-title${variant === "lg" ? " lg" : ""}`}>
        {title}
      </h2>
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="panel"
      style={{
        borderStyle: "dashed",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{description}</div>
    </div>
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
  const quinquenios = anniversaries.filter((a) => a.isQuinquenio).length;

  return (
    <div className="hr-stack gap-28">
      {/* KPI strip — overview at a glance */}
      <div className="hra-kpis">
        <div className="hra-kpi">
          <div className="hra-kpi-icon"><IconSvg d={Icons.cake} size={18} /></div>
          <div className="hra-kpi-main">
            <div className="hra-kpi-value">{birthdays.length}</div>
            <div className="hra-kpi-label">Cumpleaños del mes</div>
          </div>
        </div>
        <div className="hra-kpi">
          <div className="hra-kpi-icon warn"><IconSvg d={Icons.party} size={18} /></div>
          <div className="hra-kpi-main">
            <div className="hra-kpi-value">{anniversaries.length}</div>
            <div className="hra-kpi-label">Aniversarios del mes</div>
          </div>
        </div>
        <div className="hra-kpi">
          <div className="hra-kpi-icon gold"><IconSvg d={Icons.shield} size={18} /></div>
          <div className="hra-kpi-main">
            <div className="hra-kpi-value">{quinquenios}</div>
            <div className="hra-kpi-label">Quinquenios</div>
          </div>
        </div>
        <div className="hra-kpi">
          <div className="hra-kpi-icon success"><IconSvg d={Icons.calendar} size={18} /></div>
          <div className="hra-kpi-main">
            <div className="hra-kpi-value">{upcomingBirthdays.length}</div>
            <div className="hra-kpi-label">Próximos 30 días</div>
          </div>
        </div>
      </div>

      {/* Today's celebrations — big hero banner with confetti */}
      {hasTodayCelebrations && (
        <TodayHeroBanner
          birthdays={todayBirthdays}
          anniversaries={todayAnniversaries}
        />
      )}

      {/* Detailed today cards (kept for the social-share button) */}
      <section>
        <SectionHeader
          icon={<IconSvg d={Icons.party} size={20} />}
          title="Celebraciones de Hoy"
          variant="lg"
        />

        {isLoading ? (
          <HeroSkeleton />
        ) : !hasTodayCelebrations ? (
          <EmptyPanel
            icon={<IconSvg d={Icons.party} size={26} />}
            title="Sin celebraciones hoy"
            description="No hay cumpleaños ni aniversarios hoy, pero revisa los próximos eventos más abajo."
          />
        ) : (
          <div className="hr-grid cols-240">
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
      <section>
        <SectionHeader
          icon={<IconSvg d={Icons.cake} size={18} />}
          title="Cumpleaños del Mes"
        />

        {isLoading ? (
          <HeroSkeleton />
        ) : birthdays.length === 0 ? (
          <EmptyPanel
            icon={<IconSvg d={Icons.cake} size={24} />}
            title="Sin cumpleaños"
            description="No hay cumpleaños este mes."
          />
        ) : (
          <div className="hr-grid cols-240">
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
      <section>
        <SectionHeader
          icon={<IconSvg d={Icons.party} size={18} />}
          title="Aniversarios"
        />

        {isLoading ? (
          <HeroSkeleton />
        ) : anniversaries.length === 0 ? (
          <EmptyPanel
            icon={<IconSvg d={Icons.party} size={24} />}
            title="Sin aniversarios"
            description="No hay aniversarios laborales este mes."
          />
        ) : (
          <div className="hr-grid cols-240">
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

      {/* Upcoming birthdays — modern grid with countdown bars */}
      <section>
        <SectionHeader
          icon={<IconSvg d={Icons.clock} size={18} />}
          title="Próximos Cumpleaños"
        />

        {isLoading ? (
          <TimelineSkeleton />
        ) : upcomingBirthdays.length === 0 ? (
          <EmptyPanel
            icon={<IconSvg d={Icons.calendar} size={24} />}
            title="Sin próximos cumpleaños"
            description="No hay cumpleaños en los próximos 30 días."
          />
        ) : (
          <div className="hra-upcoming-grid">
            {upcomingBirthdays.map((u) => (
              <UpcomingTimelineItem key={u.employeeId} entry={u} />
            ))}
          </div>
        )}
      </section>

      {/* Announcements & holidays */}
      <section>
        <SectionHeader
          icon={<IconSvg d={Icons.bell} size={18} />}
          title="Comunicados y Feriados"
        />

        {isLoading ? (
          <AnnouncementSkeleton />
        ) : announcements.length === 0 ? (
          <EmptyPanel
            icon={<IconSvg d={Icons.bell} size={24} />}
            title="Sin comunicados"
            description="No hay comunicados ni feriados este mes."
          />
        ) : (
          <div className="hr-grid cols-280">
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
        icon={Icons.users}
        title="No se pudo cargar el organigrama"
        description={error}
      />
    );
  }

  return (
    <div className="hr-stack gap-24">
      {/* Company header */}
      <div className="hr-org-header-wrap">
        <div className="panel hr-org-header">
          <div className="hr-org-header-icon">
            <IconSvg d={Icons.building} size={20} />
          </div>
          <div>
            <p className="hr-org-header-title">Organigrama</p>
            <p className="hr-org-header-sub">
              {employees.length} colaboradores &middot; {grouped.length} areas
            </p>
          </div>
        </div>
      </div>

      {/* Search + expand/collapse */}
      <div className="hr-stack gap-12 hr-toolbar">
        <div className="hr-search-wrap">
          <span className="hr-search-icon">
            <IconSvg d={Icons.search} size={14} />
          </span>
          <input
            type="text"
            className="form-input hr-search-input"
            placeholder="Buscar por nombre, cargo o area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn outline btn-sm hr-toolbar-btn"
          onClick={toggleAll}
        >
          {expandedAreas.size === grouped.length
            ? "Colapsar todo"
            : "Expandir todo"}
        </button>
      </div>

      {/* Area sections */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={Icons.users}
          title="Sin resultados"
          description="Ningun empleado coincide con tu busqueda — prueba con otro termino"
        />
      ) : (
        <div className="hr-stack gap-12">
          {grouped.map(([area, members]) => {
            const isExpanded = expandedAreas.has(area);
            return (
              <div key={area} className="panel hr-org-area-panel">
                <button
                  type="button"
                  onClick={() => toggleArea(area)}
                  className="hr-org-area-button"
                >
                  <IconSvg
                    d={Icons.chevron}
                    size={14}
                    className={`hr-org-area-chevron${isExpanded ? " open" : ""}`}
                  />
                  <div className="hr-org-area-icon">
                    <IconSvg d={Icons.briefcase} size={16} />
                  </div>
                  <div className="hr-org-area-text">
                    <p className="hr-org-area-name">{area}</p>
                    <p className="hr-org-area-count">
                      {members.length} miembro
                      {members.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="type-tag muted">{members.length}</span>
                </button>

                {isExpanded && (
                  <div className="hr-org-area-body">
                    <div className="hr-org-member-grid">
                      {members.map((emp) => (
                        <div key={emp.EmployeeID} className="hr-org-member-card">
                          <NovaAvatar
                            name={emp.FullName}
                            image={emp.AvatarUrl}
                            size={40}
                            variant="plain"
                          />
                          <div className="hr-org-member-text">
                            <p className="hr-org-member-name">{emp.FullName}</p>
                            <p className="hr-org-member-pos">{emp.Position}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @media (min-width: 640px) {
          :global(.hr-toolbar) {
            flex-direction: row !important;
            align-items: center;
            justify-content: space-between;
          }
        }
      `}</style>
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
        icon={Icons.users}
        title="No se pudo cargar el directorio"
        description={error}
      />
    );
  }

  return (
    <div className="hr-stack gap-24">
      {/* Filters */}
      <div className="hr-stack gap-12 hr-toolbar">
        <div className="hr-search-wrap">
          <span className="hr-search-icon">
            <IconSvg d={Icons.search} size={14} />
          </span>
          <input
            type="text"
            className="form-input hr-search-input"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select hr-toolbar-select"
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
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
          icon={Icons.users}
          title="Sin resultados"
          description="Ningun empleado coincide con los filtros — prueba ajustando la busqueda o el area"
        />
      ) : (
        <div className="hr-grid cols-220">
          {filtered.map((emp) => (
            <div key={emp.EmployeeID} className="panel hr-dir-card">
              <div className="hr-dir-body">
                <NovaAvatar
                  name={emp.FullName}
                  image={emp.AvatarUrl}
                  size={64}
                  variant="plain"
                />

                <h3 className="hr-dir-name">{emp.FullName}</h3>
                <p className="hr-dir-position">{emp.Position}</p>
                <span className="type-tag muted hr-dir-area-tag">
                  {emp.Area}
                </span>

                <div className="hr-dir-contact">
                  {emp.Email && (
                    <div className="hr-dir-contact-row">
                      <IconSvg d={Icons.mail} size={13} />
                      <span className="hr-dir-contact-text">{emp.Email}</span>
                    </div>
                  )}
                  {emp.Phone && (
                    <div className="hr-dir-contact-row">
                      <IconSvg d={Icons.phone} size={13} />
                      <span className="hr-dir-contact-text">{emp.Phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="hr-footer-count">
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

function getFileIcon(contentType: string): React.ReactNode {
  // All map to Icons.doc — design icon set has no spreadsheet/image-specific glyph
  if (contentType.startsWith("image/")) return Icons.eye;
  return Icons.doc;
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
      // Accept both legacy bare-array and `{ok, documents}` shapes for safety
      const list = Array.isArray(json) ? json : (json.documents ?? []);
      setDocs(list);
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
        icon={Icons.doc}
        title="No se pudieron cargar los documentos"
        description={error}
      />
    );
  }

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={Icons.doc}
        title="Aún no hay documentos publicados"
        description="Los administradores pueden subir documentos desde el panel de gestion"
      />
    );
  }

  return (
    <div className="hr-stack gap-24">
      {/* Filters */}
      <div className="hr-stack gap-12 hr-toolbar">
        <div className="hr-search-wrap">
          <span className="hr-search-icon">
            <IconSvg d={Icons.search} size={14} />
          </span>
          <input
            type="text"
            className="form-input hr-search-input"
            placeholder="Buscar documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select hr-toolbar-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
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
          icon={Icons.doc}
          title="Sin resultados"
          description="Ningun documento coincide con los filtros — prueba ajustando la busqueda o la categoria"
        />
      ) : (
        <div className="hr-grid cols-280">
          {filtered.map((doc) => {
            const iconNode = getFileIcon(doc.contentType);
            return (
              <div key={doc.id} className="panel hr-doc-card">
                <div className="hr-doc-head">
                  <div className="hr-doc-icon">
                    <IconSvg d={iconNode} size={20} />
                  </div>
                  <div className="hr-doc-info">
                    <h3 className="hr-doc-title">{doc.title}</h3>
                    <p className="hr-doc-filename">{doc.fileName}</p>
                  </div>
                </div>

                <div className="hr-doc-meta">
                  <span className="type-tag muted">{doc.category}</span>
                  <span className="hr-doc-size">
                    {formatFileSize(doc.fileSize)}
                  </span>
                </div>

                <p className="hr-doc-uploaded">
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
                  className="btn outline btn-sm hr-doc-download"
                >
                  <IconSvg d={Icons.download} size={14} />
                  Descargar
                </a>
              </div>
            );
          })}
        </div>
      )}

      <p className="hr-footer-count">
        Mostrando {filtered.length} de {docs.length} documentos
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

type TabKey = "celebraciones" | "organigrama" | "directorio" | "documentos";

export default function HRPage() {
  const { data, isLoading } = useHREvents();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  // URL-persisted tab state — supports deep-links & browser back/forward
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as TabKey | null;
  const validTab = (["celebraciones", "organigrama", "directorio", "documentos"] as TabKey[]).includes(tabFromUrl as TabKey)
    ? (tabFromUrl as TabKey)
    : "celebraciones";

  const [activeTab, setActiveTabState] = useState<TabKey>(validTab);

  // Keep state in sync if URL changes externally (e.g. back/forward)
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab && (["celebraciones", "organigrama", "directorio", "documentos"] as TabKey[]).includes(tabFromUrl)) {
      setActiveTabState(tabFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const setActiveTab = useCallback((tab: TabKey) => {
    setActiveTabState(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  const birthdays: BirthdayEntry[] = data?.birthdays ?? [];
  const anniversaries: AnniversaryEntry[] = data?.anniversaries ?? [];
  const upcomingBirthdays: UpcomingBirthday[] = data?.upcomingBirthdays ?? [];
  const announcements: HREvent[] = data?.announcements ?? [];

  const {
    employees,
    isLoading: employeesLoading,
    error: employeesError,
  } = useEmployees();

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Recursos Humanos"
        subtitle="Celebraciones, organigrama, directorio y documentos del equipo."
      />

      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === "celebraciones" ? "active" : ""}`}
          onClick={() => setActiveTab("celebraciones")}
        >
          <IconSvg d={Icons.party} size={14} />
          <span className="hr-tab-label">Celebraciones</span>
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "organigrama" ? "active" : ""}`}
          onClick={() => setActiveTab("organigrama")}
        >
          <IconSvg d={Icons.building} size={14} />
          <span className="hr-tab-label">Organigrama</span>
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "directorio" ? "active" : ""}`}
          onClick={() => setActiveTab("directorio")}
        >
          <IconSvg d={Icons.users} size={14} />
          <span className="hr-tab-label">Directorio</span>
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "documentos" ? "active" : ""}`}
          onClick={() => setActiveTab("documentos")}
        >
          <IconSvg d={Icons.doc} size={14} />
          <span className="hr-tab-label">Documentos</span>
        </button>
      </div>

      {activeTab === "celebraciones" && (
        <CelebracionesTab
          isLoading={isLoading}
          birthdays={birthdays}
          anniversaries={anniversaries}
          upcomingBirthdays={upcomingBirthdays}
          announcements={announcements}
          isAdmin={isAdmin}
        />
      )}
      {activeTab === "organigrama" && (
        <OrganigramaTab
          employees={employees}
          isLoading={employeesLoading}
          error={employeesError}
        />
      )}
      {activeTab === "directorio" && (
        <DirectorioTab
          employees={employees}
          isLoading={employeesLoading}
          error={employeesError}
        />
      )}
      {activeTab === "documentos" && <DocumentosTab />}

      <style jsx>{`
        @media (max-width: 640px) {
          :global(.hr-tab-label) {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
