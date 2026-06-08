"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAdminEmployees, useAdminDashboard } from "@/hooks/use-employee";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { InviteEmployeeDialog } from "@/components/admin/invite-employee-dialog";
import { PageHeader } from "@/components/nova/page-header";
import { fmtClock } from "@/lib/utils/time";

/* ============================================================
   Types
   ============================================================ */

interface EmployeeRow {
  employeeId: string;
  email: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  dni: string;
  area: string;
  position: string;
  role: string;
  workMode: string;
  status: string;
  phone: string | null;
}

interface PresenceLite {
  employeeId: string;
  status: string;
  firstInLocal: string | null;
  workedMinutes: number;
}

const PRESENCE_META: Record<string, { label: string; dot: "success" | "warn" | "accent" | "muted" | "danger" }> = {
  WORKING: { label: "Trabajando", dot: "success" },
  ON_BREAK: { label: "En break", dot: "warn" },
  BREAK: { label: "En break", dot: "warn" },
  COMPLETED: { label: "Completa", dot: "accent" },
  NOT_CHECKED_IN: { label: "Sin marcar", dot: "muted" },
  NOT_CHECKED: { label: "Sin marcar", dot: "muted" },
  INACTIVE: { label: "Inactivo", dot: "muted" },
};

const WORK_MODE_LABEL: Record<string, string> = {
  ONSITE: "Presencial",
  REMOTE: "Remoto",
  HYBRID: "Híbrido",
};

/* ============================================================
   Presence cell
   ============================================================ */

function PresenceCell({ status }: { status: string }) {
  const cfg = PRESENCE_META[status] ?? PRESENCE_META.NOT_CHECKED_IN;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className={`legend-dot ${cfg.dot}`} />
      <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{cfg.label}</span>
    </span>
  );
}

/* ============================================================
   Page
   ============================================================ */

const PAGE_SIZE = 12;

export default function AdminEmployeesPage() {
  const { data: employeesData, isLoading } = useAdminEmployees(true);
  const { data: dashboardData } = useAdminDashboard();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const allEmployees: EmployeeRow[] = useMemo(
    () => (employeesData?.employees ?? []) as EmployeeRow[],
    [employeesData]
  );

  // Presence map from dashboard
  type DashboardLike = { presence?: PresenceLite[] };
  const presenceMap = useMemo(() => {
    const map = new Map<string, PresenceLite>();
    const presence = (dashboardData as DashboardLike | undefined)?.presence ?? [];
    presence.forEach((p) => map.set(p.employeeId, p));
    return map;
  }, [dashboardData]);

  // Areas — collapse accent/spacing/casing variants (e.g. "Consultoria" vs
  // "Consultoría") so one area never shows up as two separate filter chips.
  const areaKey = (raw?: string | null) =>
    (raw ?? "").trim().replace(/\s+/g, " ").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const hasDiacritics = (s: string) => s !== s.normalize("NFD").replace(/\p{M}/gu, "");
  const areaCanon = useMemo(() => {
    const byKey = new Map<string, string>();
    allEmployees.forEach((e) => {
      const s = (e.area ?? "").trim().replace(/\s+/g, " ");
      if (!s) return;
      const key = areaKey(s);
      const cur = byKey.get(key);
      // Prefer the variant that carries diacritics (the correct Spanish spelling).
      if (!cur || (hasDiacritics(s) && !hasDiacritics(cur))) byKey.set(key, s);
    });
    return byKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEmployees]);
  const areas = useMemo(
    () => Array.from(new Set(areaCanon.values())).sort((a, b) => a.localeCompare(b, "es")),
    [areaCanon]
  );
  const areaLabel = (raw?: string | null) => areaCanon.get(areaKey(raw)) || (raw ?? "").trim() || "—";

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allEmployees.filter((e) => {
      if (areaFilter !== "all" && areaKey(e.area) !== areaKey(areaFilter)) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.dni?.toLowerCase().includes(q) ||
        e.position?.toLowerCase().includes(q)
      );
    });
  }, [allEmployees, search, areaFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  // KPIs
  type DashKpis = {
    totalActiveEmployees?: number;
    presentToday?: number;
    weeklyAttendancePct?: number;
    anomaliesToday?: number;
  };
  const dash = dashboardData as DashKpis | undefined;
  const totalActive = dash?.totalActiveEmployees ?? allEmployees.length;
  const presentToday = dash?.presentToday ?? 0;
  const presentPct = totalActive > 0 ? Math.round((presentToday / totalActive) * 100) : 0;
  const attendancePct = dash?.weeklyAttendancePct ?? presentPct;
  const anomalies = dash?.anomaliesToday ?? 0;

  function setFilter(a: string) {
    setAreaFilter(a);
    setPage(1);
  }

  return (
    <>
      {/* PageHeader */}
      <PageHeader
        title="Empleados"
        subtitle="Gestiona tu equipo, invita a nuevos miembros y revisa su asistencia."
        actions={
          <>
            <button type="button" className="btn outline btn-md">
              <IconSvg d={Icons.download} size={14} /> Exportar
            </button>
            <InviteEmployeeDialog />
          </>
        }
      />

      {/* 4 stat-mini KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <div className="stat-mini">
          <div className="stat-mini-label">Total activos</div>
          <div className="stat-mini-value">{totalActive}</div>
          <div className="stat-mini-delta" style={{ color: "var(--text-muted)" }}>
            {filtered.length} en lista
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Presentes hoy</div>
          <div className="stat-mini-value">{presentToday}</div>
          <div className="stat-mini-delta" style={{ color: "var(--text-muted)" }}>
            {presentPct}% del total
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Asistencia promedio</div>
          <div className="stat-mini-value">
            {attendancePct}
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>%</span>
          </div>
          <div
            className="stat-mini-delta"
            style={{ color: attendancePct >= 90 ? "var(--success)" : "var(--warn)" }}
          >
            {attendancePct >= 90 ? "Saludable" : "Atención"}
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Anomalías abiertas</div>
          <div className="stat-mini-value">{anomalies}</div>
          <div
            className="stat-mini-delta"
            style={{ color: anomalies > 0 ? "var(--warn)" : "var(--text-muted)" }}
          >
            {anomalies > 0 ? "Requiere revisión" : "Al día"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="searchbar" style={{ maxWidth: 280 }}>
            <span style={{ color: "var(--text-muted)" }}>
              <IconSvg d={Icons.search} size={14} />
            </span>
            <input
              placeholder="Buscar por nombre, email, DNI…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 4, marginLeft: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`chip ${areaFilter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              Todos
            </button>
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${areaFilter === a ? "active" : ""}`}
                onClick={() => setFilter(a)}
              >
                {a}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button type="button" className="btn ghost btn-sm">
              <IconSvg d={Icons.filter} size={13} /> Filtros
            </button>
          </div>
        </div>

        <table className="table cards">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Área / Modalidad</th>
              <th>Hoy</th>
              <th>Horas hoy</th>
              <th>Rol</th>
              <th>Estado</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7}>
                    <div
                      style={{
                        height: 32,
                        background: "var(--bg-subtle)",
                        borderRadius: 4,
                        margin: "4px 0",
                        opacity: 0.6,
                      }}
                    />
                  </td>
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 13 }}
                >
                  {search || areaFilter !== "all"
                    ? "Sin empleados que coincidan con los filtros"
                    : "Sin empleados registrados"}
                </td>
              </tr>
            ) : (
              pageRows.map((e) => {
                const presence = presenceMap.get(e.employeeId);
                const workedMin = presence?.workedMinutes ?? 0;
                const h = Math.floor(workedMin / 60);
                const m = workedMin % 60;
                const isAdmin = e.role === "ADMIN" || e.role === "SUPER_ADMIN";
                const isActive = e.status === "ACTIVE";

                return (
                  <tr key={e.employeeId} onClick={() => (window.location.href = `/admin/employees/${encodeURIComponent(e.employeeId)}`)}>
                    <td className="card-head">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <NovaAvatar name={e.fullName} size={36} variant="plain" />
                        <div>
                          <div className="tcell-strong">{e.fullName}</div>
                          <div className="tcell-muted">{e.position || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Área / Modalidad">
                      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{areaLabel(e.area)}</div>
                      <div className="tcell-muted">
                        {WORK_MODE_LABEL[e.workMode] ?? e.workMode}
                      </div>
                    </td>
                    <td data-label="Hoy">
                      <PresenceCell status={presence?.status ?? "NOT_CHECKED_IN"} />
                      {presence?.firstInLocal && (
                        <div className="tcell-muted" style={{ marginTop: 2 }}>
                          {fmtClock(presence.firstInLocal)}
                        </div>
                      )}
                    </td>
                    <td data-label="Horas hoy">
                      <span className="tcell-mono">
                        {workedMin > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : "—"}
                      </span>
                    </td>
                    <td data-label="Rol">
                      <span className={`type-tag ${isAdmin ? "accent" : "muted"}`}>
                        {e.role}
                      </span>
                    </td>
                    <td data-label="Estado">
                      <span className={`type-tag ${isActive ? "success" : "danger"}`}>
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="card-actions" onClick={(ev) => ev.stopPropagation()}>
                      <Link
                        href={`/admin/employees/${encodeURIComponent(e.employeeId)}`}
                        className="btn ghost btn-sm"
                        aria-label="Ver detalle"
                      >
                        <IconSvg d={Icons.more} size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          <span>
            Mostrando {pageRows.length} de {filtered.length} empleados
            {areaFilter !== "all" && ` · ${areaFilter}`}
          </span>
          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn ghost btn-sm"
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <IconSvg d={Icons.arrowLeft} size={12} /> Anterior
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    type="button"
                    className={`btn ${p === safePage ? "outline" : "ghost"} btn-sm`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                type="button"
                className="btn ghost btn-sm"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente <IconSvg d={Icons.arrow} size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
