"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useEmployeeDetail } from "@/hooks/use-employee";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { fmtClock } from "@/lib/utils/time";
import { EmptyState } from "@/components/shared/empty-state";
import { AttendanceEditor } from "@/components/admin/AttendanceEditor";
import { PageHeader } from "@/components/nova/page-header";

/* ============================================================
   Tabs
   ============================================================ */

type TabKey = "overview" | "attendance" | "requests" | "documents";

const TABS: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
  { key: "overview", label: "Resumen", icon: Icons.dashboard },
  { key: "attendance", label: "Asistencia", icon: Icons.clock },
  { key: "requests", label: "Solicitudes", icon: Icons.doc },
  { key: "documents", label: "Documentos", icon: Icons.briefcase },
];

const WORK_MODE_LABEL: Record<string, string> = {
  ONSITE: "Presencial",
  REMOTE: "Remoto",
  HYBRID: "Híbrido",
};

function formatDate(s: string | undefined): string {
  if (!s) return "—";
  const d = s.length === 10 ? new Date(s + "T12:00:00") : new Date(s);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMins(min: number): string {
  if (!min) return "0h 00m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}


/* ============================================================
   Info row in profile sidebar
   ============================================================ */

function Info({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 28,
          height: 28,
          background: "var(--bg-subtle)",
          borderRadius: "var(--r-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          flexShrink: 0,
        }}
      >
        <IconSvg d={icon} size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Overview tab — last attendance + heatmap
   ============================================================ */

interface AttendDay {
  date: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  workedMinutes: number;
  breakMinutes?: number;
  status: string;
  isHoliday?: boolean;
}

function EmployeeOverview({ days }: { days: AttendDay[] }) {
  const recent = days.slice(0, 5);

  // Heatmap — last 60 CALENDAR days, in order (oldest → today).
  //
  // Previously this looped over the `days` array by index, so if the
  // employee only had 12 records in the window, slots 0..47 were always
  // empty and the 12 records crowded the right side. We now bucket by
  // `date` (YYYY-MM-DD) and ask each cell "what happened that day?",
  // which renders weekends / absent days correctly and aligns the most
  // recent cell with today.
  const heatmapCells = useMemo(() => {
    const byDate = new Map<string, (typeof days)[number]>();
    days.forEach((d) => byDate.set(d.date, d));
    const cells: { date: string; v: number; minutes: number; status: string | undefined }[] = [];
    const todayMs = Date.now();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(todayMs - i * 86400000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const key = `${yyyy}-${mm}-${dd}`;
      const row = byDate.get(key);
      const minutes = row?.workedMinutes ?? 0;
      cells.push({
        date: key,
        v: Math.min(1, minutes / 540),
        minutes,
        status: row?.status,
      });
    }
    return cells;
  }, [days]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "16px 0 4px" }}>
      <div>
        <div className="panel-sub" style={{ marginBottom: 10 }}>
          Últimas marcaciones
        </div>
        <div className="attend-list">
          {recent.length === 0 ? (
            <div style={{ padding: "16px 0", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              Sin marcaciones registradas
            </div>
          ) : (
            recent.map((a, i) => {
              const date = new Date(a.date + "T12:00:00");
              const dateStr = date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
              const isOpen = a.status === "OPEN";
              const isShort = (a.workedMinutes ?? 0) > 0 && (a.workedMinutes ?? 0) < 480;
              const statusLabel = isOpen ? "Abierta" : isShort ? "Corta" : a.status === "ABSENT" ? "Ausente" : "OK";
              const statusCls = isOpen || isShort ? "warn" : a.status === "ABSENT" ? "danger" : "success";
              return (
                <div key={i} className="attend-row">
                  <div style={{ width: 60, fontSize: 12, fontWeight: 600 }}>{dateStr}</div>
                  <div className="attend-times" style={{ fontSize: 12 }}>
                    <span>{fmtClock(a.firstInLocal)}</span>
                    <span className="time-sep">→</span>
                    <span>{fmtClock(a.lastOutLocal)}</span>
                  </div>
                  <div className="attend-hours">
                    {a.workedMinutes > 0 ? fmtMins(a.workedMinutes) : "En curso"}
                  </div>
                  <span className={`type-tag ${statusCls}`}>{statusLabel}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div>
        <div className="panel-sub" style={{ marginBottom: 10 }}>
          Patrón de asistencia · últimos 60 días
        </div>
        <div className="heatmap" role="grid" aria-label="Patrón de asistencia últimos 60 días">
          {heatmapCells.map((c) => (
            <div
              key={c.date}
              className="heatmap-cell"
              style={{
                background: `color-mix(in srgb, var(--accent) ${c.v * 80 + 5}%, var(--bg-subtle))`,
              }}
              title={`${c.date} · ${(c.minutes / 60).toFixed(1)}h${c.status ? ` · ${c.status}` : ""}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Attendance tab — full calendar + list editor (admin)
   ============================================================ */

/**
 * Thin wrapper around `<AttendanceEditor>` so the existing tab API
 * (`<EmployeeAttendanceTab days={…} employeeId={…} />`) keeps working
 * while we plug in the proper editor (calendar + list toggle, day
 * edit, delete, audit) instead of the cropped read-only table that
 * lived here before.
 */
function EmployeeAttendanceTab({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  return (
    <div style={{ padding: "16px 0 4px" }}>
      <AttendanceEditor employeeId={employeeId} employeeName={employeeName} />
    </div>
  );
}

/* ============================================================
   Requests tab
   ============================================================ */

function EmployeeRequestsTab({ requests }: { requests: { id: string; type: string; when: string; days: string; status: string; statusLabel: string }[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Icons.doc}
        title="Sin solicitudes"
        description="Este empleado todavía no ha generado solicitudes (vacaciones, permisos o regularizaciones)."
      />
    );
  }
  return (
    <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      {requests.map((r) => (
        <div key={r.id} className="request-row" style={{ background: "var(--bg-subtle)" }}>
          <div style={{ flex: 1 }}>
            <div className="request-type">{r.type}</div>
            <div className="request-meta">
              {r.when} · {r.days}
            </div>
          </div>
          <span className={`type-tag ${r.status}`}>{r.statusLabel}</span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Documents tab
   ============================================================ */

function EmployeeDocsTab() {
  return (
    <EmptyState
      icon={Icons.briefcase}
      title="Sin documentos firmados"
      description="Aún no has subido documentos para este empleado. Reglamento interno, contrato, anexos — todo va aquí."
      action={
        <button type="button" className="btn outline btn-md">
          <IconSvg d={Icons.upload} size={14} /> Subir documento
        </button>
      }
    />
  );
}

/* ============================================================
   Page
   ============================================================ */

interface EmpDetailData {
  employee?: {
    employeeId: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string | null;
    dni?: string;
    area?: string;
    position?: string;
    role?: string;
    workMode?: string;
    status?: string;
    avatarUrl?: string;
    hireDate?: string;
    site?: string;
    schedule?: { startTime: string; endTime: string; breakMinutes?: number };
  };
  recentAttendance?: AttendDay[];
  requests?: { id: string; requestType: string; status: string; dateFrom?: string; dateTo?: string; effectiveDate?: string }[];
  kpis?: {
    attendancePct?: number;
    monthHours?: number;
    lateCount?: number;
    permitsUsed?: number;
  };
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const rawId = params?.id as string;
  // Next.js may return percent-encoded or decoded id depending on routing context.
  // Decode safely; the hook will re-encode for the API call.
  const id = useMemo(() => {
    if (!rawId) return "";
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }, [rawId]);
  const { data, isLoading } = useEmployeeDetail(id);
  const [tab, setTab] = useState<TabKey>("overview");

  const detail = data as EmpDetailData | undefined;
  const emp = detail?.employee;
  const days: AttendDay[] = detail?.recentAttendance ?? [];

  // Compute KPIs
  const recentDays = days.slice(0, 30);
  const workableDays = recentDays.filter((d) => !d.isHoliday).length || 1;
  const okDays = recentDays.filter((d) => d.workedMinutes >= 480).length;
  const attendancePct = detail?.kpis?.attendancePct ?? Math.round((okDays / workableDays) * 100);
  const monthHours =
    detail?.kpis?.monthHours ??
    Math.round(days.filter((d) => d.date >= todayMonth()).reduce((s, d) => s + (d.workedMinutes ?? 0), 0) / 60);
  const lateCount =
    detail?.kpis?.lateCount ??
    days.filter((d) => {
      // Prefer the server-computed lateMinutes (respects employee schedule +
      // tenant tolerance). Falls back to a 09:10 hard cutoff for legacy rows
      // that don't have lateMinutes yet.
      const late = (d as { lateMinutes?: number }).lateMinutes;
      if (typeof late === "number") return late > 0;
      const clock = fmtClock(d.firstInLocal);
      if (clock === "—") return false;
      const [hh, mm] = clock.split(":").map(Number);
      return hh * 60 + mm > 9 * 60 + 10;
    }).length;
  const permitsUsed = detail?.kpis?.permitsUsed ?? 0;

  // Requests for the tab
  const requestRows = useMemo(() => {
    return (detail?.requests ?? []).map((r) => {
      const typeLabels: Record<string, string> = {
        VACATION: "Vacaciones",
        PERMISSION: "Permiso",
        REGULARIZATION_SINGLE: "Regularización",
        REGULARIZATION_RANGE: "Regularización",
      };
      const statusMap: Record<string, { cls: string; label: string }> = {
        PENDING: { cls: "warn", label: "Pendiente" },
        APPROVED: { cls: "success", label: "Aprobada" },
        REJECTED: { cls: "danger", label: "Rechazada" },
        CANCELLED: { cls: "muted", label: "Cancelada" },
      };
      const when = r.dateFrom && r.dateTo
        ? `${formatDate(r.dateFrom)} – ${formatDate(r.dateTo)}`
        : formatDate(r.effectiveDate);
      // Number of calendar days covered by the request
      let dayCount = 1;
      if (r.dateFrom && r.dateTo) {
        const a = new Date(r.dateFrom + "T12:00:00").getTime();
        const b = new Date(r.dateTo + "T12:00:00").getTime();
        dayCount = Math.max(1, Math.round((b - a) / 86400000) + 1);
      }
      return {
        id: r.id,
        type: typeLabels[r.requestType] ?? r.requestType,
        when,
        days: `${dayCount} ${dayCount === 1 ? "día" : "días"}`,
        status: statusMap[r.status]?.cls ?? "muted",
        statusLabel: statusMap[r.status]?.label ?? r.status,
      };
    });
  }, [detail]);

  if (isLoading) {
    return (
      <div className="page-header">
        <h1 className="page-title">Cargando…</h1>
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="page-header">
        <h1 className="page-title">Empleado no encontrado</h1>
        <Link href="/admin/employees" className="btn outline btn-sm">
          <IconSvg d={Icons.arrowLeft} size={13} /> Volver a empleados
        </Link>
      </div>
    );
  }

  const fullName = emp.fullName;
  const role = emp.position ?? "—";
  const area = emp.area ?? "—";
  const site = emp.site ?? "—";
  const isActive = emp.status === "ACTIVE";
  const subtitle = [role, area, site].filter((s) => s !== "—").join(" · ");

  return (
    <>
      {/* PageHeader with breadcrumb */}
      <PageHeader
        breadcrumb={[
          { label: "Empleados", href: "/admin/employees" },
          { label: fullName },
        ]}
        title={fullName}
        subtitle={subtitle || "—"}
        actions={
          <>
            <a
              href={`mailto:${emp.email}`}
              className="btn outline btn-md"
              style={{ textDecoration: "none" }}
            >
              <IconSvg d={Icons.mail} size={14} /> Enviar correo
            </a>
            <button type="button" className="btn outline btn-md">
              <IconSvg d={Icons.edit} size={14} /> Editar
            </button>
            <button type="button" className="btn primary btn-md">
              <IconSvg d={Icons.chat} size={14} /> Mensaje
            </button>
          </>
        }
      />

      <div className="emp-detail-layout">
        {/* Sidebar profile */}
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8 }}>
            <NovaAvatar name={fullName} image={emp.avatarUrl} size={96} variant="accent" />
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: "var(--text-primary)" }}>
              {fullName}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{role}</div>
            <span className={`type-tag ${isActive ? "success" : "danger"}`}>
              {isActive ? "Activo" : "Inactivo"}
            </span>
          </div>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <Info label="Email" value={emp.email} icon={Icons.mail} />
            {emp.phone && <Info label="Teléfono" value={emp.phone} icon={Icons.phone} />}
            {emp.dni && <Info label="Documento" value={emp.dni} icon={Icons.doc} />}
            {site !== "—" && <Info label="Sede" value={site} icon={Icons.pin} />}
            <Info
              label="Modalidad"
              value={WORK_MODE_LABEL[emp.workMode ?? "ONSITE"] ?? emp.workMode ?? "—"}
              icon={Icons.briefcase}
            />
            <Info label="Ingreso" value={formatDate(emp.hireDate)} icon={Icons.calendar} />
            {emp.schedule && (
              <Info
                label="Turno"
                value={`${emp.schedule.startTime} – ${emp.schedule.endTime}`}
                icon={Icons.clock}
              />
            )}
          </div>
        </div>

        {/* Right side: KPIs + tabs */}
        <div>
          <div className="fill-grid min-240" style={{ marginBottom: 14 }}>
            <div className="stat-mini">
              <div className="stat-mini-label">Asistencia 30d</div>
              <div className="stat-mini-value">
                {attendancePct}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>%</span>
              </div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-label">Horas este mes</div>
              <div className="stat-mini-value">
                {monthHours}
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>h</span>
              </div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-label">Llegadas tarde</div>
              <div className="stat-mini-value">{lateCount}</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini-label">Permisos usados</div>
              <div className="stat-mini-value">{permitsUsed}</div>
            </div>
          </div>

          <div className="panel">
            <div className="tabs" role="tablist" aria-label="Detalle del empleado">
              {TABS.map((t) => {
                const count =
                  t.key === "requests" ? requestRows.length : t.key === "documents" ? 0 : undefined;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.key}
                    id={`emp-tab-${t.key}`}
                    aria-controls={`emp-panel-${t.key}`}
                    className={`tab ${tab === t.key ? "active" : ""}`}
                    onClick={() => setTab(t.key)}
                  >
                    <IconSvg d={t.icon} size={14} />
                    {t.label}
                    {count != null && count > 0 && <span className="tab-count">{count}</span>}
                  </button>
                );
              })}
            </div>

            {tab === "overview" && <EmployeeOverview days={days} />}
            {tab === "attendance" && (
              <EmployeeAttendanceTab employeeId={id} employeeName={emp.fullName} />
            )}
            {tab === "requests" && <EmployeeRequestsTab requests={requestRows} />}
            {tab === "documents" && <EmployeeDocsTab />}
          </div>
        </div>
      </div>

      <style jsx>{`
        .emp-detail-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        @media (max-width: 1000px) {
          .emp-detail-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

function todayMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
