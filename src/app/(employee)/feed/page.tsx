"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useFeed, useCreatePost } from "@/hooks/use-feed";
import { PostCard } from "@/components/feed/post-card";
import { useHREvents } from "@/hooks/use-hr";
import { useTenantConfig } from "@/hooks/use-tenant";
import { useTenantTimezone, todayInTz } from "@/hooks/use-timezone";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { PageHeader } from "@/components/nova/page-header";
import type { Post } from "@/lib/types/post";
import type { BirthdayEntry, AnniversaryEntry } from "@/lib/types";

/* ============================================================
   Helpers
   ============================================================ */

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Justo ahora";
  if (min < 60) return `Hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ayer";
  if (d < 7) return `Hace ${d} días`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}



/* ============================================================
   Composer
   ============================================================ */

function Composer({ name, userArea }: { name: string; userArea?: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"company" | "area" | "private">("company");
  const create = useCreatePost();

  async function submit() {
    if (!content.trim()) return;
    if (visibility === "area" && !userArea) {
      toast.error("No tienes un área asignada. Pide a RRHH que la configure.");
      return;
    }
    try {
      await create.mutateAsync({
        content: content.trim(),
        visibility,
        ...(visibility === "area" && userArea && { targetArea: userArea }),
      });
      setContent("");
      setOpen(false);
      toast.success("Publicación creada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo publicar");
    }
  }

  if (!open) {
    return (
      <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <NovaAvatar name={name} size={36} variant="accent" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              flex: 1,
              textAlign: "left",
              padding: "10px 14px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r)",
              color: "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Comparte algo con el equipo…
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
          <button type="button" className="btn ghost btn-sm" onClick={() => setOpen(true)}>
            <IconSvg d={Icons.upload} size={13} /> Foto
          </button>
          <button type="button" className="btn ghost btn-sm" onClick={() => setOpen(true)}>
            <IconSvg d={Icons.party} size={13} /> Reconocimiento
          </button>
          <button type="button" className="btn ghost btn-sm" onClick={() => setOpen(true)}>
            <IconSvg d={Icons.calendar} size={13} /> Evento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <NovaAvatar name={name} size={36} variant="accent" />
        <textarea
          className="form-textarea"
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Comparte algo con el equipo…"
          rows={3}
          maxLength={500}
          style={{ flex: 1 }}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <select
          className="form-select"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          style={{ width: "auto", fontSize: 12, padding: "6px 10px" }}
        >
          <option value="company">🌐 Toda la empresa</option>
          <option value="area">👥 Mi área</option>
          <option value="private">🔒 Solo yo</option>
        </select>
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
          {content.length}/500
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => {
              setOpen(false);
              setContent("");
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary btn-sm"
            onClick={submit}
            disabled={create.isPending || !content.trim()}
          >
            <IconSvg d={Icons.send} size={13} />
            {create.isPending ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Right rail panels
   ============================================================ */

function BirthdaysPanel({
  birthdays,
  todayDate,
}: {
  birthdays: BirthdayEntry[];
  todayDate: string;
}) {
  const rows = useMemo(() => {
    const today = new Date(todayDate + "T12:00:00");
    return birthdays
      .map((b) => {
        const month = parseInt(b.eventDate.substring(5, 7), 10) - 1;
        const day = parseInt(b.eventDate.substring(8, 10), 10);
        const next = new Date(today.getFullYear(), month, day, 12);
        if (next < today) next.setFullYear(next.getFullYear() + 1);
        const days = Math.round((next.getTime() - today.getTime()) / 86400000);
        return { who: b.employeeName, days, next };
      })
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [birthdays, todayDate]);

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-head">
        <div>
          <div className="panel-title">Próximos cumpleaños</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 8 }}>
            Sin cumpleaños este mes
          </div>
        ) : (
          rows.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <NovaAvatar name={b.who} size={32} variant="plain" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{b.who}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  🎂{" "}
                  {b.days === 0
                    ? "Hoy"
                    : b.days === 1
                    ? "Mañana"
                    : b.next.toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EventsPanel({
  holidays,
  todayDate,
}: {
  holidays: { date: string; name: string }[];
  todayDate: string;
}) {
  const upcoming = useMemo(() => {
    const todayMs = new Date(todayDate + "T12:00:00").getTime();
    return holidays
      .map((h) => ({
        ...h,
        days: Math.floor((new Date(h.date + "T12:00:00").getTime() - todayMs) / 86400000),
      }))
      .filter((h) => h.days >= 0 && h.days <= 60)
      .sort((a, b) => a.days - b.days)
      .slice(0, 3);
  }, [holidays, todayDate]);

  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-head">
        <div>
          <div className="panel-title">Eventos</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {upcoming.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 8 }}>
            Sin eventos próximos
          </div>
        ) : (
          upcoming.map((e, i) => {
            const date = new Date(e.date + "T12:00:00");
            const dateLabel = date.toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" });
            return (
              <div key={i} className="event-row">
                <div className="event-icon warn">
                  <IconSvg d={Icons.beach} size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="event-title">{e.name}</div>
                  <div className="event-meta">
                    {dateLabel} · {e.days === 0 ? "Hoy" : e.days === 1 ? "Mañana" : `Feriado`}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AnniversariesPanel({ anniversaries }: { anniversaries: AnniversaryEntry[] }) {
  const rows = anniversaries.slice(0, 4);
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Aniversarios laborales</div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {rows.length === 0 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 8 }}>
            Sin aniversarios este mes
          </div>
        ) : (
          rows.map((a, i) => (
            <div key={i}>
              <strong style={{ color: "var(--text-primary)" }}>{a.employeeName}</strong>{" "}
              <span className="muted">cumple {a.years} {a.years === 1 ? "año" : "años"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function FeedPage() {
  const { data: session } = useSession();
  const { data: feedData, isLoading } = useFeed();
  const tz = useTenantTimezone();
  const todayDate = todayInTz(tz);
  const monthStr = todayDate.substring(0, 7);
  const { data: hrData } = useHREvents(monthStr);
  const { data: tenant } = useTenantConfig();

  const posts = feedData?.posts ?? [];
  const userName = session?.user?.name ?? "Usuario";
  const birthdays: BirthdayEntry[] = hrData?.birthdays ?? [];
  const anniversaries: AnniversaryEntry[] = hrData?.anniversaries ?? [];
  const holidays = tenant?.settings?.holidays ?? [];

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Feed de la empresa"
        subtitle="Anuncios, reconocimientos y momentos importantes."
      />

      <div className="feed-layout">
        {/* Left: Composer + Posts */}
        <div className="feed-main">
          <Composer name={userName} userArea={(session?.user as { area?: string } | undefined)?.area} />

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="panel"
                  style={{ padding: 20, opacity: 0.5 }}
                >
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-subtle)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 12, width: "30%", background: "var(--bg-subtle)", borderRadius: 4 }} />
                      <div style={{ height: 10, width: "20%", background: "var(--bg-subtle)", borderRadius: 4, marginTop: 6 }} />
                    </div>
                  </div>
                  <div style={{ height: 14, width: "70%", background: "var(--bg-subtle)", borderRadius: 4, marginTop: 14 }} />
                  <div style={{ height: 12, width: "90%", background: "var(--bg-subtle)", borderRadius: 4, marginTop: 8 }} />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div
              className="panel"
              style={{ padding: "60px 24px", textAlign: "center" }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--bg-subtle)",
                  color: "var(--text-secondary)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <IconSvg d={Icons.feed} size={22} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Sin publicaciones</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, maxWidth: 320, margin: "4px auto 0" }}>
                Sé el primero en compartir algo con tu equipo.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {posts.map((p) => (
                <PostCard key={p.PostID} post={p} currentUserId={session?.user?.id} />
              ))}
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="feed-rail">
          <BirthdaysPanel birthdays={birthdays} todayDate={todayDate} />
          <EventsPanel holidays={holidays} todayDate={todayDate} />
          <AnniversariesPanel anniversaries={anniversaries} />
        </aside>
      </div>

      <style jsx>{`
        .feed-layout {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 20px;
        }
        @media (max-width: 1100px) {
          .feed-layout {
            grid-template-columns: 1fr;
          }
        }
        .feed-main {
          min-width: 0;
        }
        .feed-rail {
          min-width: 0;
        }
      `}</style>
    </>
  );
}
