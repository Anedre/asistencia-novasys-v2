"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAttendance } from "@/hooks/use-employee";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { PageHeader } from "@/components/nova/page-header";
import { RegularizeSheet } from "@/components/attendance/regularize-sheet";

/* ============================================================
   Types
   ============================================================ */

interface AttendanceSummary {
  employeeId: string;
  workDate: string;
  fullName: string;
  area: string;
  position: string;
  avatarUrl: string | null;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakStartLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  plannedMinutes: number;
  deltaMinutes: number;
  status: string;
  source: string;
  anomalies: string[];
  hasOpenBreak: boolean;
  hasOpenShift: boolean;
}

interface AttendanceResponse {
  ok: boolean;
  date: string;
  totals: {
    total: number;
    present: number;
    absent: number;
    onBreak: number;
    complete: number;
    short: number;
    anomalies: number;
  };
  areas: string[];
  summaries: AttendanceSummary[];
}

/* ============================================================
   Helpers
   ============================================================ */

function fmtMin(min: number): string {
  if (!min) return "0h 00m";
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtTime(s: string | null): string {
  if (!s) return "—";
  if (s.includes("T")) {
    return s.split("T")[1]?.replace(/[-+]\d{2}:\d{2}$/, "").slice(0, 5) ?? s;
  }
  return s.slice(0, 5);
}

function getTodayLima(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

function shiftDate(s: string, days: number): string {
  const d = new Date(s + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function formatDateDisplay(s: string): string {
  const d = new Date(s + "T12:00:00");
  const text = d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // Capitalize only the first letter — Spanish months and weekdays stay
  // lowercase mid-sentence ("jueves, 28 de mayo de 2026" → "Jueves, ...").
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/* Status to pill mapping */
const STATUS_META: Record<string, { label: string; cls: string }> = {
  OK: { label: "OK", cls: "success" },
  CLOSED: { label: "OK", cls: "success" },
  REGULARIZED: { label: "Regularizado", cls: "accent" },
  OPEN: { label: "Abierta", cls: "warn" },
  SHORT: { label: "Corta", cls: "warn" },
  INCOMPLETE: { label: "Incompleta", cls: "warn" },
  ABSENT: { label: "Ausente", cls: "danger" },
  MISSING: { label: "Sin registro", cls: "muted" },
  NO_RECORD: { label: "Sin registro", cls: "muted" },
  HOLIDAY: { label: "Feriado", cls: "muted" },
};

function useLiveMinutes(firstInLocal: string | null, breakMinutes: number, active: boolean): number {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);
  if (!active || !firstInLocal) return 0;
  const timePart = firstInLocal.includes("T")
    ? firstInLocal.split("T")[1]?.replace(/[-+]\d{2}:\d{2}$/, "") ?? "00:00:00"
    : firstInLocal;
  const [h, m, s] = timePart.split(":").map(Number);
  const startMin = h * 60 + m + (s || 0) / 60;
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return Math.max(0, Math.floor(nowMin - startMin) - breakMinutes);
}

/* ============================================================
   Attendance row
   ============================================================ */

function AttendanceRow({
  s,
  isToday,
  onEdit,
}: {
  s: AttendanceSummary;
  isToday: boolean;
  onEdit: () => void;
}) {
  const isLive = s.hasOpenShift && isToday;
  const liveMin = useLiveMinutes(s.firstInLocal, s.breakMinutes, isLive);
  const displayWorked = isLive ? liveMin : s.workedMinutes;
  const statusMeta = STATUS_META[s.status] ?? STATUS_META.NO_RECORD;

  return (
    <tr>
      <td className="card-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <NovaAvatar name={s.fullName} image={s.avatarUrl} size={32} variant="plain" />
          <div style={{ minWidth: 0 }}>
            <div className="tcell-strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.fullName}
            </div>
            <div className="tcell-muted">{s.area || s.position}</div>
          </div>
        </div>
      </td>
      <td className="tcell-mono" data-label="Entrada">{s.firstInLocal ? fmtTime(s.firstInLocal) : <span className="tcell-muted">—</span>}</td>
      <td className="tcell-mono" data-label="Salida">{s.lastOutLocal ? fmtTime(s.lastOutLocal) : <span className="tcell-muted">—</span>}</td>
      <td className="tcell-mono tcell-muted" data-label="Break">
        {s.hasOpenBreak ? (
          <span style={{ color: "var(--warn)", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <span className="pulse small" style={{ background: "var(--warn)" }} />
            En break
          </span>
        ) : s.breakMinutes > 0 ? (
          `${s.breakMinutes}m`
        ) : (
          "—"
        )}
      </td>
      <td className="tcell-mono tcell-strong" data-label="Trabajadas">
        {displayWorked > 0 ? fmtMin(displayWorked) : <span className="tcell-muted">—</span>}
      </td>
      <td className="tcell-muted" data-label="Área">{s.area || "—"}</td>
      <td data-label="Estado">
        <span className={`type-tag ${statusMeta.cls}`}>
          {isLive && <span className="pulse small" style={{ marginRight: 4, background: "var(--success)" }} />}
          {statusMeta.label}
        </span>
      </td>
      <td className="card-actions">
        <button type="button" className="btn ghost btn-sm" onClick={onEdit} aria-label="Regularizar">
          <IconSvg d={Icons.edit} size={13} />
        </button>
      </td>
    </tr>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function AdminAttendancePage() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLima());
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editRow, setEditRow] = useState<AttendanceSummary | null>(null);

  const { data, isLoading } = useAdminAttendance(selectedDate);
  const resp = data as AttendanceResponse | undefined;
  const summaries = resp?.summaries ?? [];
  const rawAreas = resp?.areas ?? [];
  const totals = resp?.totals;

  // Collapse accent/spacing/casing variants (e.g. "Consultoria" vs "Consultoría")
  // so one area never appears as two filter chips.
  const areaKey = (raw?: string | null) =>
    (raw ?? "").trim().replace(/\s+/g, " ").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const hasDiacritics = (s: string) => s !== s.normalize("NFD").replace(/\p{M}/gu, "");
  const areaCanon = useMemo(() => {
    const byKey = new Map<string, string>();
    rawAreas.forEach((raw) => {
      const s = (raw ?? "").trim().replace(/\s+/g, " ");
      if (!s) return;
      const key = areaKey(s);
      const cur = byKey.get(key);
      if (!cur || (hasDiacritics(s) && !hasDiacritics(cur))) byKey.set(key, s);
    });
    return byKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawAreas]);
  const areas = useMemo(
    () => Array.from(new Set(areaCanon.values())).sort((a, b) => a.localeCompare(b, "es")),
    [areaCanon]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return summaries.filter((s) => {
      if (areaFilter !== "ALL" && areaKey(s.area) !== areaKey(areaFilter)) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (!q) return true;
      return s.fullName.toLowerCase().includes(q) || s.area.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries, search, areaFilter, statusFilter]);

  const today = getTodayLima();
  const isToday = selectedDate === today;

  return (
    <>
      {/* PageHeader */}
      <PageHeader
        title="Asistencia"
        subtitle="Revisa, edita y regulariza las marcaciones del equipo."
        actions={
          <>
            <button type="button" className="btn outline btn-md">
              <IconSvg d={Icons.download} size={14} /> Exportar
            </button>
            <Link href="/admin/regularize" className="btn primary btn-md">
              <IconSvg d={Icons.plus} size={14} /> Marcación manual
            </Link>
          </>
        }
      />

      {/* Date picker + view tabs */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 6,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
          }}
        >
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            aria-label="Día anterior"
          >
            <IconSvg d={Icons.arrowLeft} size={14} />
          </button>
          <span
            style={{
              padding: "4px 10px",
              fontSize: 13,
              fontWeight: 600,
              minWidth: 220,
              textAlign: "center",
            }}
          >
            {formatDateDisplay(selectedDate)}
          </span>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            aria-label="Día siguiente"
            disabled={selectedDate >= today}
          >
            <IconSvg d={Icons.chevron} size={14} />
          </button>
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          <button
            type="button"
            className={`tab ${isToday ? "active" : ""}`}
            onClick={() => setSelectedDate(today)}
          >
            Hoy
          </button>
          <button
            type="button"
            className={`tab ${selectedDate === shiftDate(today, -1) ? "active" : ""}`}
            onClick={() => setSelectedDate(shiftDate(today, -1))}
          >
            Ayer
          </button>
          <button
            type="button"
            className={`tab`}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 7);
              setSelectedDate(d.toLocaleDateString("en-CA"));
            }}
          >
            Hace 7 días
          </button>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="form-input"
          style={{ width: 160, padding: "8px 10px", marginLeft: "auto" }}
        />
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="searchbar" style={{ maxWidth: 240 }}>
            <span style={{ color: "var(--text-muted)" }}>
              <IconSvg d={Icons.search} size={14} />
            </span>
            <input
              placeholder="Buscar empleado…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 4, marginLeft: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`chip ${areaFilter === "ALL" ? "active" : ""}`}
              onClick={() => setAreaFilter("ALL")}
            >
              Todas las áreas
            </button>
            {areas.slice(0, 5).map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${areaFilter === a ? "active" : ""}`}
                onClick={() => setAreaFilter(a)}
              >
                {a}
              </button>
            ))}
          </div>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--text-muted)",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {totals && (
              <>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "OK" ? "ALL" : "OK")}
                  style={{ color: "var(--success)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <span className="legend-dot success" /> {totals.complete} OK
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "SHORT" ? "ALL" : "SHORT")}
                  style={{ color: "var(--warn)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <span className="legend-dot warn" /> {totals.short} cortas
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "ABSENT" ? "ALL" : "ABSENT")}
                  style={{ color: "var(--danger)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <span className="legend-dot danger" /> {totals.absent} ausentes
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "OPEN" ? "ALL" : "OPEN")}
                  style={{ color: "var(--text-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <span className="legend-dot muted" /> {totals.onBreak + (totals.anomalies ?? 0)} abiertas
                </button>
              </>
            )}
          </span>
        </div>

        <table className="table cards">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Break</th>
              <th>Trabajadas</th>
              <th>Área</th>
              <th>Estado</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8}>
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
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 13 }}
                >
                  Sin registros de asistencia para este día
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <AttendanceRow
                  key={s.employeeId}
                  s={s}
                  isToday={isToday}
                  onEdit={() => setEditRow(s)}
                />
              ))
            )}
          </tbody>
        </table>

        {/* Footer */}
        {!isLoading && filtered.length > 0 && (
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
              Mostrando {filtered.length} de {summaries.length} empleados
              {areaFilter !== "ALL" && ` · ${areaFilter}`}
              {statusFilter !== "ALL" && ` · ${STATUS_META[statusFilter]?.label ?? statusFilter}`}
            </span>
            <span className="tcell-mono">{selectedDate}</span>
          </div>
        )}
      </div>

      {/* Regularize sheet — before/after preview + audit notice */}
      {editRow && (
        <RegularizeSheet row={editRow} onClose={() => setEditRow(null)} />
      )}
    </>
  );
}
