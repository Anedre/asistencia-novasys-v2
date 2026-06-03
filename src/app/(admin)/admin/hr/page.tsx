"use client";

/**
 * RRHH admin — rediseñado.
 *
 * Layout sections (top → bottom):
 *   1. PageHeader (month picker + create event)
 *   2. KPI strip — 4 stats (cumples, aniversarios, quinquenios, documentos)
 *   3. "Celebraciones HOY" hero banner — visible only when someone has a
 *      birthday or anniversary on today's date (confetti CSS animation)
 *   4. Two-column row: Cumpleaños del mes  |  Aniversarios del mes
 *      (avatar-rich rows; quinquenios highlighted with gold pill)
 *   5. Próximos cumpleaños (cards with progress-bar countdown)
 *   6. Documentos RRHH — sidebar category filter + main list with file-
 *      type icons. Upload moved into a side drawer (opens on "+ Subir")
 *   7. Comunicados — timeline with metadata (date, type) and inline
 *      reenviar/archive actions
 *
 * APIs unchanged. Inline styles removed in favor of `hra-*` classes.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useHREvents, useArchiveHREvent, useResendAnnouncement } from "@/hooks/use-hr";
import { IconSvg, Icons } from "@/components/nova/icons";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/nova/page-header";
import { NovaAvatar } from "@/components/nova/avatar";
import type { BirthdayEntry, AnniversaryEntry, UpcomingBirthday, HREvent } from "@/lib/types";

/* ---------------------------------------------------------------- helpers */

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function shortDate(yyyymmdd: string): string {
  if (!yyyymmdd) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(yyyymmdd);
  if (!m) return yyyymmdd;
  const day = Number(m[3]);
  const monthIdx = Number(m[2]) - 1;
  return `${day} ${(MONTH_NAMES[monthIdx] ?? "").slice(0, 3)}`;
}

function isToday(yyyymmdd: string): boolean {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return yyyymmdd === today;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeFromName(name: string): { tag: string; cls: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { tag: "PDF", cls: "pdf" };
  if (["doc", "docx"].includes(ext)) return { tag: "DOC", cls: "doc" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { tag: "XLS", cls: "xls" };
  if (["ppt", "pptx"].includes(ext)) return { tag: "PPT", cls: "ppt" };
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return { tag: "IMG", cls: "img" };
  if (["zip", "rar", "7z"].includes(ext)) return { tag: "ZIP", cls: "zip" };
  return { tag: ext.toUpperCase().slice(0, 3) || "•", cls: "doc" };
}

/* ============================================================ Page */

export default function AdminHRPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data, isLoading } = useHREvents(month);

  const birthdays: BirthdayEntry[] = data?.birthdays ?? [];
  const anniversaries: AnniversaryEntry[] = data?.anniversaries ?? [];
  const upcomingBirthdays: UpcomingBirthday[] = data?.upcomingBirthdays ?? [];
  const announcements: HREvent[] = data?.announcements ?? [];

  const todayBdays = birthdays.filter((b) => isToday(b.eventDate));
  const todayAnniv = anniversaries.filter((a) => isToday(a.eventDate));
  const todayQuinq = todayAnniv.filter((a) => a.isQuinquenio).length;
  const quinquenios = anniversaries.filter((a) => a.isQuinquenio).length;

  return (
    <>
      <PageHeader
        title="Gestión RRHH"
        subtitle="Administra eventos, cumpleaños, aniversarios y comunicados."
        actions={
          <>
            <input
              id="month-select"
              type="month"
              className="form-input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: 160, padding: "6px 10px", fontSize: 13 }}
              aria-label="Mes"
            />
            <Link href="/admin/hr/create" className="btn primary btn-sm">
              <IconSvg d={Icons.plus} size={14} />
              Crear evento
            </Link>
          </>
        }
      />

      {/* ─── KPI strip ─── */}
      <div className="hra-kpis">
        <KpiCard icon={Icons.cake} label="Cumpleaños del mes" value={birthdays.length} />
        <KpiCard icon={Icons.party} label="Aniversarios del mes" value={anniversaries.length} variant="warn" />
        <KpiCard icon={Icons.shield} label="Quinquenios" value={quinquenios} variant="gold" />
        <KpiCard icon={Icons.doc} label="Documentos" value={<DocCount />} variant="success" />
      </div>

      {/* ─── Celebración HOY ─── */}
      {(todayBdays.length > 0 || todayAnniv.length > 0) && (
        <TodayBanner
          birthdays={todayBdays}
          anniversaries={todayAnniv}
          quinqCount={todayQuinq}
        />
      )}

      {/* ─── Cumpleaños + Aniversarios del mes ─── */}
      <div className="hra-cols-2">
        <SectionBlock icon={Icons.cake} title="Cumpleaños del mes" count={birthdays.length}>
          {isLoading ? (
            <LoadingRows />
          ) : birthdays.length === 0 ? (
            <EmptyState
              icon={Icons.cake}
              title="Sin cumpleaños este mes"
              description="Cambia el mes en el selector arriba."
            />
          ) : (
            <div className="hra-list">
              {birthdays.map((b) => (
                <div
                  key={b.employeeId}
                  className={`hra-row${isToday(b.eventDate) ? " today" : ""}`}
                >
                  <NovaAvatar name={b.employeeName} size={36} variant="plain" />
                  <div className="hra-row-main">
                    <div className="hra-row-name">{b.employeeName}</div>
                    <div className="hra-row-meta">
                      {b.area} · {b.position} · {b.years} años
                    </div>
                  </div>
                  <span className="hra-row-day">{shortDate(b.eventDate)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionBlock>

        <SectionBlock icon={Icons.party} title="Aniversarios del mes" count={anniversaries.length}>
          {isLoading ? (
            <LoadingRows />
          ) : anniversaries.length === 0 ? (
            <EmptyState
              icon={Icons.party}
              title="Sin aniversarios este mes"
              description="Ningún empleado celebra aniversario laboral este mes."
            />
          ) : (
            <div className="hra-list">
              {anniversaries.map((a) => (
                <div
                  key={a.employeeId}
                  className={`hra-row${isToday(a.eventDate) ? " today" : ""}`}
                >
                  <NovaAvatar name={a.employeeName} size={36} variant="plain" />
                  <div className="hra-row-main">
                    <div className="hra-row-name-wrap">
                      <span className="hra-row-name">{a.employeeName}</span>
                      {a.isQuinquenio && <span className="hra-quinq">Quinquenio</span>}
                    </div>
                    <div className="hra-row-meta">
                      {a.area} · {a.position} · {a.years} años
                    </div>
                  </div>
                  <span className="hra-row-day">{shortDate(a.eventDate)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionBlock>
      </div>

      {/* ─── Próximos cumpleaños ─── */}
      <SectionBlock icon={Icons.calendar} title="Próximos cumpleaños (30 días)" count={upcomingBirthdays.length}>
        {isLoading ? (
          <LoadingRows />
        ) : upcomingBirthdays.length === 0 ? (
          <EmptyState
            icon={Icons.calendar}
            title="Sin próximos cumpleaños"
            description="No hay cumpleaños en los próximos 30 días."
          />
        ) : (
          <div className="hra-upcoming-grid">
            {upcomingBirthdays.map((u) => (
              <UpcomingCard key={u.employeeId} entry={u} />
            ))}
          </div>
        )}
      </SectionBlock>

      {/* ─── Documentos ─── */}
      <DocumentsLibrary />

      {/* ─── Comunicados ─── */}
      <SectionBlock icon={Icons.bell} title="Comunicados" count={announcements.length}>
        {isLoading ? (
          <LoadingRows />
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={Icons.bell}
            title="Sin comunicados"
            description="No hay comunicados ni feriados este mes. Crea uno para anunciarlo al equipo."
          />
        ) : (
          <AnnouncementList events={announcements} />
        )}
      </SectionBlock>
    </>
  );
}

/* ============================================================ Pieces */

function KpiCard({
  icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  variant?: "default" | "warn" | "success" | "gold";
}) {
  return (
    <div className="hra-kpi">
      <div className={`hra-kpi-icon ${variant === "default" ? "" : variant}`}>
        <IconSvg d={icon} size={18} />
      </div>
      <div className="hra-kpi-main">
        <div className="hra-kpi-value">{value}</div>
        <div className="hra-kpi-label">{label}</div>
      </div>
    </div>
  );
}

function DocCount() {
  const [count, setCount] = useState<number | string>("—");
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/hr/documents")
      .then((r) => r.json())
      .then((d) => alive && setCount(d.documents?.length ?? 0))
      .catch(() => alive && setCount("—"));
    return () => {
      alive = false;
    };
  }, []);
  return <>{count}</>;
}

function TodayBanner({
  birthdays,
  anniversaries,
  quinqCount,
}: {
  birthdays: BirthdayEntry[];
  anniversaries: AnniversaryEntry[];
  quinqCount: number;
}) {
  const names = [
    ...birthdays.map((b) => b.employeeName),
    ...anniversaries.map((a) => a.employeeName),
  ];
  const hasBday = birthdays.length > 0;
  const emoji = hasBday ? "🎂" : "🎉";
  const totalCount = names.length;

  let title: string;
  if (totalCount === 1) {
    title = hasBday
      ? `¡Hoy es cumpleaños de ${names[0]}!`
      : `¡Hoy es aniversario de ${names[0]}!`;
  } else {
    title = `¡${totalCount} celebraciones hoy!`;
  }

  const sub = totalCount === 1
    ? hasBday
      ? `${birthdays[0].position} · ${birthdays[0].area}`
      : `${anniversaries[0].years} años en la empresa${quinqCount > 0 ? " · ¡Quinquenio!" : ""}`
    : `${birthdays.length} cumpleaños · ${anniversaries.length} aniversario(s)${quinqCount > 0 ? ` · ${quinqCount} quinquenio(s)` : ""}`;

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

function SectionBlock({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="hra-section">
      <div className="hra-section-head">
        <span className="hra-section-icon">
          <IconSvg d={icon} size={15} />
        </span>
        <span className="hra-section-title">{title}</span>
        {typeof count === "number" && (
          <span className="hra-section-count">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function UpcomingCard({ entry }: { entry: UpcomingBirthday }) {
  // Progress = "how close we are" — 0 days = full bar, 30 days = empty
  const pct = Math.max(0, Math.min(100, ((30 - entry.daysUntil) / 30) * 100));
  const urgency =
    entry.daysUntil === 0 ? "urgent" : entry.daysUntil <= 7 ? "soon" : "";
  const label =
    entry.daysUntil === 0
      ? "¡Hoy!"
      : entry.daysUntil === 1
      ? "Mañana"
      : `En ${entry.daysUntil} días`;

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
        <span className="hra-upcoming-date">{shortDate(entry.eventDate)}</span>
        <span className="hra-upcoming-count">{label}</span>
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="hra-list">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{ height: 56, background: "var(--bg-subtle)", borderRadius: 12, opacity: 0.6 }}
        />
      ))}
    </div>
  );
}

/* ============================================================ Documents */

interface AdminDoc {
  DocID: string;
  Title: string;
  Category: string;
  FileName: string;
  FileSize: number;
  UploadedByName: string;
  CreatedAt: string;
}

const CATEGORIES = ["Politicas", "Manuales", "Formatos", "Otros"] as const;

function DocumentsLibrary() {
  const [docs, setDocs] = useState<AdminDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("Todos");
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/hr/documents");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setDocs(json.documents ?? []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { Todos: docs.length };
    for (const c of CATEGORIES) m[c] = 0;
    for (const d of docs) m[d.Category] = (m[d.Category] ?? 0) + 1;
    return m;
  }, [docs]);

  const filtered = useMemo(
    () => (filter === "Todos" ? docs : docs.filter((d) => d.Category === filter)),
    [docs, filter]
  );

  async function handleDelete(docId: string) {
    try {
      await fetch(`/api/admin/hr/documents/${docId}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.DocID !== docId));
      toast.success("Documento eliminado");
    } catch {
      toast.error("Error al eliminar documento");
    }
  }

  return (
    <SectionBlock icon={Icons.doc} title="Documentos RRHH" count={docs.length}>
      <div className="hra-docs">
        <aside className="hra-docs-side">
          {(["Todos", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`hra-docs-side-cat${filter === c ? " active" : ""}`}
              onClick={() => setFilter(c)}
            >
              <span>{c}</span>
              <span className="hra-docs-side-cat-count">{counts[c] ?? 0}</span>
            </button>
          ))}
          <div className="hra-docs-side-divider" />
          <button
            type="button"
            className="hra-docs-upload-btn"
            onClick={() => setUploadOpen(true)}
          >
            <IconSvg d={Icons.upload} size={14} />
            Subir documento
          </button>
        </aside>

        <div>
          {isLoading ? (
            <LoadingRows />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Icons.doc}
              title={filter === "Todos" ? "Sin documentos" : `Sin documentos en ${filter}`}
              description={
                filter === "Todos"
                  ? "Sube el primero usando el botón a la izquierda."
                  : "Cambia el filtro o sube uno nuevo."
              }
            />
          ) : (
            <div>
              {filtered.map((doc) => {
                const ft = fileTypeFromName(doc.FileName);
                return (
                  <div key={doc.DocID} className="hra-doc-row">
                    <div className={`hra-doc-ftype ${ft.cls}`}>{ft.tag}</div>
                    <div className="hra-doc-info">
                      <div className="hra-doc-name">{doc.Title}</div>
                      <div className="hra-doc-sub">
                        <span>{doc.Category}</span>
                        <span className="hra-doc-sub-sep">·</span>
                        <span>{formatFileSize(doc.FileSize)}</span>
                        <span className="hra-doc-sub-sep">·</span>
                        <span>{doc.UploadedByName}</span>
                        <span className="hra-doc-sub-sep">·</span>
                        <span>
                          {new Date(doc.CreatedAt).toLocaleDateString("es-PE", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="hra-doc-actions">
                      <button
                        type="button"
                        className="btn ghost btn-sm"
                        onClick={() => handleDelete(doc.DocID)}
                        style={{ color: "var(--danger)" }}
                        aria-label="Eliminar documento"
                      >
                        <IconSvg d={Icons.trash} size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {uploadOpen && (
        <UploadDrawer
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            load();
          }}
        />
      )}
    </SectionBlock>
  );
}

function UploadDrawer({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("Politicas");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) {
      toast.error("Título y archivo son obligatorios");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title.trim());
      fd.append("category", category);
      const res = await fetch("/api/admin/hr/documents", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al subir");
        return;
      }
      toast.success("Documento subido");
      onUploaded();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="hra-drawer-backdrop" onClick={onClose} />
      <aside className="hra-drawer" role="dialog" aria-label="Subir documento">
        <div className="hra-drawer-head">
          <h3 className="hra-drawer-title">Subir documento</h3>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IconSvg d={Icons.x} size={14} />
          </button>
        </div>
        <div className="hra-drawer-body">
          <div className="form-group">
            <label className="form-label" htmlFor="upload-title">
              Título<span className="req">*</span>
            </label>
            <input
              id="upload-title"
              className="form-input"
              placeholder="Ej: Política de vacaciones 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="upload-cat">
              Categoría
            </label>
            <select
              id="upload-cat"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="upload-file">
              Archivo<span className="req">*</span>
            </label>
            <input
              id="upload-file"
              type="file"
              className="form-input"
              ref={fileRef}
              accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp"
            />
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              PDF, DOC, XLS, PPT o imagen. Máx 10 MB.
            </p>
          </div>
        </div>
        <div className="hra-drawer-foot">
          <button type="button" className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            <IconSvg d={Icons.upload} size={13} />
            {uploading ? "Subiendo…" : "Subir"}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ============================================================ Announcements */

function AnnouncementList({ events }: { events: HREvent[] }) {
  const archive = useArchiveHREvent();
  const [resendId, setResendId] = useState<string | null>(null);
  const resendEvent = events.find((e) => e.NotificationID === resendId);

  return (
    <>
      <div className="hra-announce-list">
        {events.map((evt) => {
          const isHoliday = evt.Type === "HOLIDAY";
          return (
            <div
              key={evt.NotificationID}
              className={`hra-announce${isHoliday ? " holiday" : ""}`}
            >
              <div className="hra-announce-icon">
                <IconSvg d={isHoliday ? Icons.flag : Icons.bell} size={16} />
              </div>
              <div className="hra-announce-body">
                <div className="hra-announce-head">
                  <span className={`type-tag ${isHoliday ? "warn" : "accent"}`}>
                    {isHoliday ? "Feriado" : "Comunicado"}
                  </span>
                  <span className="hra-announce-title">{evt.Title}</span>
                </div>
                <p className="hra-announce-msg">{evt.Message}</p>
                <div className="hra-announce-meta">
                  <span className="hra-announce-meta-item">
                    <IconSvg d={Icons.calendar} size={11} />
                    {evt.EventDate}
                  </span>
                  {evt.Audience && (
                    <span className="hra-announce-meta-item">
                      <IconSvg d={Icons.users} size={11} />
                      {evt.Audience}
                    </span>
                  )}
                </div>
              </div>
              <div className="hra-announce-actions">
                {!isHoliday && (
                  <button
                    type="button"
                    className="btn ghost btn-sm"
                    title="Reenviar"
                    onClick={() => setResendId(evt.NotificationID)}
                  >
                    <IconSvg d={Icons.send} size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  title="Archivar"
                  onClick={() => {
                    archive.mutate(evt.NotificationID, {
                      onSuccess: () => toast.success("Comunicado archivado"),
                      onError: () => toast.error("Error al archivar"),
                    });
                  }}
                  disabled={archive.isPending}
                  style={{ color: "var(--danger)" }}
                >
                  <IconSvg d={Icons.trash} size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {resendEvent && (
        <ResendDialog event={resendEvent} onClose={() => setResendId(null)} />
      )}
    </>
  );
}

/* ============================================================ Resend dialog */

interface EmployeeOption {
  EmployeeID: string;
  FullName: string;
}

function normalizeEmployee(raw: Record<string, unknown>): EmployeeOption {
  return {
    EmployeeID: (raw.EmployeeID as string) ?? (raw.employeeId as string) ?? "",
    FullName: (raw.FullName as string) ?? (raw.fullName as string) ?? "Sin nombre",
  };
}

function ResendDialog({
  event,
  onClose,
}: {
  event: HREvent;
  onClose: () => void;
}) {
  const resendMutation = useResendAnnouncement();
  const [broadcast, setBroadcast] = useState(true);
  const [sendDMs, setSendDMs] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [employeeList, setEmployeeList] = useState<EmployeeOption[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingEmps(true);
      try {
        const res = await fetch("/api/admin/employees");
        const data = await res.json();
        const raw = (data.employees ?? data ?? []) as Record<string, unknown>[];
        setEmployeeList(raw.map(normalizeEmployee));
      } catch {
        // silent
      } finally {
        setLoadingEmps(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return employeeList;
    const q = search.toLowerCase();
    return employeeList.filter((e) => e.FullName.toLowerCase().includes(q));
  }, [employeeList, search]);

  function toggleEmployee(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const canSend = broadcast || (sendDMs && selectedIds.length > 0);

  async function handleSend() {
    try {
      await resendMutation.mutateAsync({
        id: event.NotificationID,
        broadcast,
        employeeIds: sendDMs ? selectedIds : undefined,
      });
      toast.success("Comunicado reenviado");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al reenviar");
    }
  }

  return (
    <>
      <div className="hra-drawer-backdrop" onClick={onClose} />
      <aside className="hra-drawer" role="dialog" aria-label="Reenviar comunicado">
        <div className="hra-drawer-head">
          <div>
            <h3 className="hra-drawer-title">Reenviar comunicado</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
              {event.Title}
            </p>
          </div>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IconSvg d={Icons.x} size={14} />
          </button>
        </div>

        <div className="hra-drawer-body">
          <ChannelOption
            icon={Icons.users}
            title="Enviar al grupo de broadcast"
            desc="Crea un grupo con todos los empleados de la empresa"
            checked={broadcast}
            onChange={setBroadcast}
          />
          <ChannelOption
            icon={Icons.send}
            title="Enviar como mensaje directo"
            desc="Envía un mensaje individual a empleados seleccionados"
            checked={sendDMs}
            onChange={setSendDMs}
          />

          {sendDMs && (
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Empleados</label>
              <input
                className="form-input"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div
                style={{
                  maxHeight: 240,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: 6,
                }}
              >
                {loadingEmps ? (
                  <p style={{ padding: 12, fontSize: 13, color: "var(--text-muted)" }}>
                    Cargando…
                  </p>
                ) : filtered.length === 0 ? (
                  <p style={{ padding: 12, fontSize: 13, color: "var(--text-muted)" }}>
                    No se encontraron empleados
                  </p>
                ) : (
                  filtered.slice(0, 30).map((emp) => {
                    const selected = selectedIds.includes(emp.EmployeeID);
                    return (
                      <button
                        key={emp.EmployeeID}
                        type="button"
                        onClick={() => toggleEmployee(emp.EmployeeID)}
                        className="hra-row"
                        style={{
                          width: "100%",
                          marginBottom: 4,
                          border: "1px solid transparent",
                          background: selected
                            ? "var(--accent-soft, color-mix(in srgb, var(--accent) 10%, transparent))"
                            : "transparent",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <NovaAvatar name={emp.FullName} size={28} variant="plain" />
                        <span className="hra-row-name" style={{ flex: 1, textAlign: "left" }}>
                          {emp.FullName}
                        </span>
                        {selected && (
                          <span style={{ color: "var(--accent-strong, var(--accent))" }}>
                            <IconSvg d={Icons.check} size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              {selectedIds.length > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                  {selectedIds.length} empleado{selectedIds.length !== 1 ? "s" : ""}{" "}
                  seleccionado{selectedIds.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="hra-drawer-foot">
          <button type="button" className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleSend}
            disabled={!canSend || resendMutation.isPending}
          >
            <IconSvg d={Icons.send} size={13} />
            {resendMutation.isPending ? "Enviando…" : "Reenviar"}
          </button>
        </div>
      </aside>
    </>
  );
}

function ChannelOption({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        marginBottom: 10,
        borderRadius: 12,
        border: `1.5px solid ${checked ? "var(--accent)" : "var(--border)"}`,
        background: checked
          ? "var(--accent-soft, color-mix(in srgb, var(--accent) 8%, transparent))"
          : "transparent",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16 }}
      />
      <span style={{ color: "var(--accent-strong, var(--accent))", display: "flex" }}>
        <IconSvg d={icon} size={18} />
      </span>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{title}</p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>{desc}</p>
      </div>
    </label>
  );
}
