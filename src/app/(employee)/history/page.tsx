"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useAttendanceHistory } from "@/hooks/use-attendance";
import { useTenantConfig } from "@/hooks/use-tenant";
import { useTenantTimezone, todayInTz } from "@/hooks/use-timezone";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PageHeader } from "@/components/nova/page-header";

/* ============================================================
   Helpers
   ============================================================ */

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getMonthRange(year: number, month: number) {
  const mm = String(month + 1).padStart(2, "0");
  const last = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

function fmtHours(min: number): string {
  if (min <= 0) return "0h";
  const h = min / 60;
  return `${h.toFixed(1)}h`;
}

type DayStatus = "ok" | "short" | "leave" | "holiday" | "off" | "future" | "absent";

interface HDay {
  date: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  status: string;
  isHoliday?: boolean;
  holidayName?: string;
}

function deriveStatus(d: HDay, dow: number, isFuture: boolean): DayStatus {
  if (d.isHoliday) return "holiday";
  if (isFuture) return "future";
  if (dow === 0 || dow === 6) return "off"; // Sun (0) / Sat (6) — JS getDay convention
  const s = d.status;
  if (s === "ON_LEAVE" || s === "PERMIT") return "leave";
  if (s === "ABSENT") return "absent";
  if (s === "OK" || s === "CLOSED" || s === "REGULARIZED") return "ok";
  if (s === "SHORT" || s === "INCOMPLETE") return "short";
  if (d.workedMinutes > 0) {
    return d.workedMinutes >= 480 ? "ok" : "short";
  }
  return "off";
}

const STATUS_DOT_COLOR: Record<DayStatus, string> = {
  ok: "var(--success)",
  short: "var(--warn)",
  leave: "var(--accent)",
  holiday: "var(--danger)",
  absent: "var(--danger)",
  off: "transparent",
  future: "transparent",
};

/* ============================================================
   Calendar View
   ============================================================ */

interface CalendarCell {
  d: number;
  date: string;
  status: DayStatus;
  workedMinutes: number;
  holidayName?: string;
}

function CalendarView({ cells, todayDate }: { cells: (CalendarCell | null)[]; todayDate: string }) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 6,
          marginBottom: 6,
        }}
      >
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--text-muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {cells.map((c, i) => {
          if (!c) return <div key={i} style={{ aspectRatio: "1" }} />;
          const isToday = c.date === todayDate;
          return (
            <div key={i} className={`cal-day status-${c.status} ${isToday ? "today" : ""}`}>
              <div className="cal-day-num">{c.d}</div>
              {(c.status === "ok" || c.status === "short") && (
                <div className="cal-day-hours">{fmtHours(c.workedMinutes)}</div>
              )}
              {c.status === "leave" && <div className="cal-day-tag">Permiso</div>}
              {c.status === "holiday" && (
                <div className="cal-day-tag" title={c.holidayName}>Feriado</div>
              )}
              {c.status === "absent" && <div className="cal-day-tag">Ausente</div>}
              {c.status === "off" && <div className="cal-day-tag muted">—</div>}
              <span className="cal-day-dot" style={{ background: STATUS_DOT_COLOR[c.status] }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   List View
   ============================================================ */

function ListView({ days, monthName }: { days: CalendarCell[]; monthName: string }) {
  const rows = days.filter((d) => d.status === "ok" || d.status === "short");
  return (
    <table className="table" style={{ border: "none" }}>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Entrada</th>
          <th>Salida</th>
          <th>Break</th>
          <th>Trabajadas</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
              Sin marcaciones registradas
            </td>
          </tr>
        ) : (
          rows.map((d, i) => (
            <tr key={i}>
              <td className="tcell-strong">
                {String(d.d).padStart(2, "0")} {monthName.slice(0, 3)}
              </td>
              <td className="tcell-mono">{(d as HDayMeta).firstIn ?? "--:--"}</td>
              <td className="tcell-mono">{(d as HDayMeta).lastOut ?? "--:--"}</td>
              <td className="tcell-mono tcell-muted">
                {(d as HDayMeta).breakMin > 0 ? `${(d as HDayMeta).breakMin}m` : "—"}
              </td>
              <td className="tcell-mono">{fmtHours(d.workedMinutes)}</td>
              <td>
                <span className={`type-tag ${d.status === "ok" ? "success" : "warn"}`}>
                  {d.status === "ok" ? "OK" : "Corta"}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

interface HDayMeta extends CalendarCell {
  firstIn: string | null;
  lastOut: string | null;
  breakMin: number;
}

/* ============================================================
   Page
   ============================================================ */

export default function MyAttendancePage() {
  const tz = useTenantTimezone();
  const today = todayInTz(tz);
  const todayDate = new Date(today + "T12:00:00");
  const { data: session } = useSession();

  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());
  const [view, setView] = useState<"cal" | "list">("cal");
  const [exporting, setExporting] = useState(false);

  async function handleExportPdf() {
    const employeeId = (session?.user as { employeeId?: string } | undefined)?.employeeId;
    if (!employeeId) {
      toast.error("No se pudo identificar tu empleado");
      return;
    }
    setExporting(true);
    try {
      const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, month: monthStr }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo generar el reporte");
      }
      const data = await res.json();
      if (data.url) {
        const win = window.open(data.url, "_blank");
        if (!win) {
          // Popup blocked — provide fallback link
          toast.success(`Reporte listo. <a href="${data.url}" target="_blank">Descargar</a>`);
        } else {
          toast.success("Reporte generado");
        }
      } else {
        toast.success("Reporte generado");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar el reporte");
    } finally {
      setExporting(false);
    }
  }

  const { from, to } = getMonthRange(year, month);
  const { data: historyData, isLoading } = useAttendanceHistory(from, to);
  const { data: tenant } = useTenantConfig();

  const days = (historyData?.days ?? []) as HDay[];
  const tenantHolidays = tenant?.settings?.holidays ?? [];

  // Build calendar cells
  const cells = useMemo(() => {
    const result: (HDayMeta | null)[] = [];
    const firstDay = new Date(year, month, 1);
    // dow 0=Sun, but we want Mon=0
    const startDow = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < startDow; i++) result.push(null);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const byDate: Map<string, HDay> = new Map();
    days.forEach((d) => byDate.set(d.date, d));

    const holidayByDate: Map<string, string> = new Map();
    tenantHolidays.forEach((h) => holidayByDate.set(h.date, h.name));

    for (let dnum = 1; dnum <= daysInMonth; dnum++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(dnum).padStart(2, "0");
      const date = `${year}-${mm}-${dd}`;
      const dayDate = new Date(date + "T12:00:00");
      const dow = (dayDate.getDay() + 6) % 7; // 0=Mon
      const isFuture = date > today;
      const h = byDate.get(date);
      const holidayName = holidayByDate.get(date);

      const merged: HDay = {
        date,
        firstInLocal: h?.firstInLocal ?? null,
        lastOutLocal: h?.lastOutLocal ?? null,
        breakMinutes: h?.breakMinutes ?? 0,
        workedMinutes: h?.workedMinutes ?? 0,
        status: h?.status ?? "NO_RECORD",
        isHoliday: !!holidayName,
        holidayName,
      };

      const status = deriveStatus(merged, dow, isFuture);
      result.push({
        d: dnum,
        date,
        status,
        workedMinutes: merged.workedMinutes,
        holidayName,
        firstIn: merged.firstInLocal ? merged.firstInLocal.substring(0, 5) : null,
        lastOut: merged.lastOutLocal ? merged.lastOutLocal.substring(0, 5) : null,
        breakMin: merged.breakMinutes,
      });
    }
    return result;
  }, [days, year, month, today, tenantHolidays]);

  // KPIs for the month
  const realDays = cells.filter((c): c is HDayMeta => c !== null);
  const workableDays = realDays.filter((d) => d.status !== "off" && d.status !== "future" && d.status !== "holiday").length;
  const okDays = realDays.filter((d) => d.status === "ok" || d.status === "short").length;
  const totalWorkedMin = realDays.reduce((sum, d) => sum + d.workedMinutes, 0);
  const lateCount = realDays.filter((d) => {
    if (!d.firstIn) return false;
    const [hh, mm] = d.firstIn.split(":").map(Number);
    return hh * 60 + mm > 9 * 60 + 10; // after 9:10
  }).length;
  const permitCount = realDays.filter((d) => d.status === "leave").length;
  const attendancePct = workableDays > 0 ? Math.round((okDays / workableDays) * 100) : 0;

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const monthName = MONTHS[month];
  const monthLabel = `${monthName} ${year}`;

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Mi asistencia"
        subtitle="Tu historial de marcaciones, totales y patrones."
        actions={
          <>
            <button
              className="btn outline btn-md"
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
            >
              <IconSvg d={Icons.download} size={14} />
              {exporting ? "Generando…" : "Exportar PDF"}
            </button>
            <Link
              href="/requests/new?type=regularize"
              className="btn outline btn-md"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <IconSvg d={Icons.edit} size={14} /> Regularizar día
            </Link>
          </>
        }
      />

      {/* 4 stat-mini KPIs */}
      <div className="kpi-grid">
        <div className="stat-mini">
          <div className="stat-mini-label">Asistencia mes</div>
          <div className="stat-mini-value">
            {isLoading ? "—" : attendancePct}
            <span style={{ fontSize: 14 }}>%</span>
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Horas trabajadas</div>
          <div className="stat-mini-value">
            {isLoading ? "—" : Math.round(totalWorkedMin / 60)}
            <span style={{ fontSize: 14 }}>h</span>
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Llegadas tarde</div>
          <div className="stat-mini-value">{isLoading ? "—" : lateCount}</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Permisos</div>
          <div className="stat-mini-value">{isLoading ? "—" : permitCount}</div>
        </div>
      </div>

      {/* Filter row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
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
          <button type="button" className="btn ghost btn-sm" onClick={prevMonth} aria-label="Mes anterior">
            <IconSvg d={Icons.arrowLeft} size={14} />
          </button>
          <span style={{ padding: "4px 10px", fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>
            {monthLabel}
          </span>
          <button type="button" className="btn ghost btn-sm" onClick={nextMonth} aria-label="Mes siguiente">
            <IconSvg d={Icons.chevron} size={14} />
          </button>
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          <button
            type="button"
            className={`tab ${view === "cal" ? "active" : ""}`}
            onClick={() => setView("cal")}
          >
            <IconSvg d={Icons.calendar} size={13} /> Calendario
          </button>
          <button
            type="button"
            className={`tab ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}
          >
            <IconSvg d={Icons.dashboard} size={13} /> Lista
          </button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, fontSize: 11, color: "var(--text-muted)" }}>
          <span>
            <span className="legend-dot success" /> OK
          </span>
          <span>
            <span className="legend-dot warn" /> Corta
          </span>
          <span>
            <span className="legend-dot accent" /> Permiso
          </span>
          <span>
            <span className="legend-dot danger" /> Feriado
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="panel">
        {isLoading ? (
          <div
            style={{
              padding: "60px 0",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            Cargando historial…
          </div>
        ) : view === "cal" ? (
          <CalendarView cells={cells} todayDate={today} />
        ) : (
          <ListView days={realDays} monthName={monthName} />
        )}
      </div>
    </>
  );
}
