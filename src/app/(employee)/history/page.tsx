"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useAttendanceHistory } from "@/hooks/use-attendance";
import { useTenantConfig } from "@/hooks/use-tenant";
import { useTenantTimezone, todayInTz } from "@/hooks/use-timezone";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PageHeader } from "@/components/nova/page-header";
import { CountUp } from "@/components/nova/count-up";

/* ============================================================
   Helpers
   ============================================================ */

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
/** Indexed by day-of-week in the Monday-first convention (0 = Lunes). */
const WEEKDAY_NAMES = [
  "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
];

const DEFAULT_PLANNED_MINUTES = 480;

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

/** "HH:MM" to minutes since midnight. Returns null for anything unparseable. */
function clockToMinutes(clock: string | null | undefined): number | null {
  if (!clock) return null;
  const [hh, mm] = clock.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

type DayStatus =
  | "ok"
  | "short"
  | "open"
  | "leave"
  | "holiday"
  | "absent"
  | "none"
  | "weekend"
  | "future";

interface StatusMeta {
  /** Full wording, used in the day detail and as the cell aria-label. */
  label: string;
  /** Short wording that fits inside a calendar cell. `null` = show hours instead. */
  tag: string | null;
  variant: "success" | "warn" | "accent" | "danger" | "muted";
  dot: string;
}

const STATUS_META: Record<DayStatus, StatusMeta> = {
  ok:      { label: "Jornada completa", tag: null,           variant: "success", dot: "var(--success)" },
  short:   { label: "Jornada corta",    tag: null,           variant: "warn",    dot: "var(--warn)" },
  open:    { label: "Jornada abierta",  tag: "En curso",     variant: "accent",  dot: "var(--accent)" },
  leave:   { label: "Permiso",          tag: "Permiso",      variant: "accent",  dot: "var(--accent)" },
  holiday: { label: "Feriado",          tag: "Feriado",      variant: "danger",  dot: "var(--danger)" },
  absent:  { label: "Ausente",          tag: "Ausente",      variant: "danger",  dot: "var(--danger)" },
  none:    { label: "Sin registro",     tag: "Sin registro", variant: "muted",   dot: "transparent" },
  weekend: { label: "Descanso",         tag: "Descanso",     variant: "muted",   dot: "transparent" },
  future:  { label: "Aún no ocurre",    tag: null,           variant: "muted",   dot: "transparent" },
};

interface HDay {
  date: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  status: string;
  reasonLabel?: string;
  reasonNote?: string;
  anomalies?: string[];
  isHoliday?: boolean;
  holidayName?: string;
}

/**
 * `dowMon0` uses the Monday-first convention the grid is built with:
 * 0 = Lunes ... 5 = Sábado, 6 = Domingo.
 */
function deriveStatus(
  d: HDay,
  dowMon0: number,
  isFuture: boolean,
  plannedMinutes: number
): DayStatus {
  if (d.isHoliday) return "holiday";
  if (dowMon0 === 5 || dowMon0 === 6) return "weekend";
  if (isFuture) return "future";
  const s = d.status;
  if (s === "ON_LEAVE" || s === "PERMIT") return "leave";
  if (s === "ABSENT" || s === "ABSENCE") return "absent";
  if (s === "OPEN") return "open";
  if (s === "OK" || s === "CLOSED" || s === "REGULARIZED") return "ok";
  if (s === "SHORT" || s === "INCOMPLETE") return "short";
  if (d.workedMinutes > 0) {
    return d.workedMinutes >= plannedMinutes ? "ok" : "short";
  }
  return "none";
}

/* ============================================================
   Calendar View
   ============================================================ */

interface CalendarCell {
  d: number;
  date: string;
  /** 0 = Lunes ... 6 = Domingo */
  dow: number;
  status: DayStatus;
  workedMinutes: number;
  lateMinutes: number;
  firstIn: string | null;
  lastOut: string | null;
  breakMin: number;
  reasonLabel?: string;
  reasonNote?: string;
  anomalies?: string[];
  holidayName?: string;
}

function CalendarView({
  cells,
  todayDate,
  selectedDate,
  onSelect,
}: {
  cells: (CalendarCell | null)[];
  todayDate: string;
  selectedDate: string | null;
  onSelect: (cell: CalendarCell, anchor: HTMLElement) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {cells.map((c, i) => {
          if (!c) return <div key={i} style={{ aspectRatio: "1" }} />;
          const meta = STATUS_META[c.status];
          const isToday = c.date === todayDate;
          const showHours = c.status === "ok" || c.status === "short";
          const monthName = MONTHS[Number(c.date.slice(5, 7)) - 1].toLowerCase();
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => onSelect(c, e.currentTarget)}
              aria-haspopup="dialog"
              aria-expanded={c.date === selectedDate}
              aria-label={`${c.d} de ${monthName} — ${meta.label}`}
              className={`cal-day status-${c.status}${isToday ? " today" : ""}${
                c.date === selectedDate ? " selected" : ""
              }`}
            >
              <div className="cal-day-num">{c.d}</div>
              {showHours ? (
                <div className="cal-day-hours">{fmtHours(c.workedMinutes)}</div>
              ) : (
                meta.tag && (
                  <div
                    className={`cal-day-tag${
                      c.status === "weekend" || c.status === "none" ? " muted" : ""
                    }`}
                    title={c.status === "holiday" ? c.holidayName : undefined}
                  >
                    {meta.tag}
                  </div>
                )
              )}
              <span className="cal-day-dot" style={{ background: meta.dot }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Day detail
   ============================================================ */

const EMPTY_MESSAGE: Record<DayStatus, string> = {
  ok: "",
  short: "",
  open: "Tu jornada está abierta. Aún no registras la salida.",
  leave: "Día cubierto por un permiso aprobado.",
  holiday: "Feriado. No se espera marcación.",
  absent: "Registrado como ausencia.",
  none: "Sin marcaciones registradas para este día.",
  weekend: "Día de descanso. No se espera marcación.",
  future: "Este día aún no ocurre.",
};

/** Width of the anchored card. */
const POP_W = 300;
/** Gap between the day cell and the card, and the minimum viewport margin. */
const POP_GAP = 10;
const POP_MARGIN = 8;

/** Below this width there is no room to anchor beside a cell. */
const DOCK_QUERY = "(max-width: 640px)";

function subscribeDock(onChange: () => void) {
  const mq = window.matchMedia(DOCK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const readDock = () => window.matchMedia(DOCK_QUERY).matches;
const readDockOnServer = () => false;

/**
 * Day detail as a card anchored to the day you clicked (Google-Calendar style)
 * rather than a centered overlay: no backdrop, the source cell keeps its ring,
 * and the page stays readable behind it. Follows the NovaDatePicker pattern —
 * portaled to `.nva-app`, fixed positioning, flipped to stay on screen.
 * Below 640px there is no room to anchor, so it docks to the bottom instead.
 */
function DayPopover({
  cell,
  anchor,
  plannedMinutes,
  onClose,
}: {
  cell: CalendarCell;
  anchor: HTMLElement;
  plannedMinutes: number;
  onClose: () => void;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const docked = useSyncExternalStore(subscribeDock, readDock, readDockOnServer);

  // Measures the card and writes its position straight to the node: this is a
  // DOM sync, not state, so it can run in a layout effect and on every scroll.
  const place = useCallback(() => {
    const el = popRef.current;
    if (!el || docked) return;
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth || POP_W;
    const h = el.offsetHeight;

    // Prefer the right of the cell, flip to the left, and as a last resort
    // centre it horizontally on the cell.
    let left = r.right + POP_GAP;
    if (left + w > window.innerWidth - POP_MARGIN) {
      const flipped = r.left - POP_GAP - w;
      left =
        flipped >= POP_MARGIN
          ? flipped
          : Math.min(
              Math.max(POP_MARGIN, r.left + r.width / 2 - w / 2),
              window.innerWidth - w - POP_MARGIN
            );
    }
    const top = Math.min(
      Math.max(POP_MARGIN, r.top + r.height / 2 - h / 2),
      Math.max(POP_MARGIN, window.innerHeight - h - POP_MARGIN)
    );
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.visibility = "visible";
  }, [anchor, docked]);

  // Layout effect so the card is positioned before the browser paints it.
  useLayoutEffect(() => {
    place();
  }, [place, cell.date]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchor.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onClose();
      anchor.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, onClose, place]);

  const meta = STATUS_META[cell.status];
  const hasRecord = !!cell.firstIn || cell.workedMinutes > 0;
  const monthName = MONTHS[Number(cell.date.slice(5, 7)) - 1].toLowerCase();
  const title = `${WEEKDAY_NAMES[cell.dow]} ${cell.d} de ${monthName}`;
  const pct =
    plannedMinutes > 0
      ? Math.min(100, Math.round((cell.workedMinutes / plannedMinutes) * 100))
      : 0;
  const emptyMessage =
    cell.status === "holiday" && cell.holidayName
      ? `Feriado: ${cell.holidayName}.`
      : EMPTY_MESSAGE[cell.status];

  const style: CSSProperties = docked
    ? { left: POP_MARGIN, right: POP_MARGIN, bottom: POP_MARGIN }
    : // `place` overwrites these before the first paint; hidden until it does.
      { top: 0, left: 0, width: POP_W, visibility: "hidden" };

  const card = (
    <div
      ref={popRef}
      className={`day-pop${docked ? " docked" : ""}`}
      role="dialog"
      aria-label={title}
      style={style}
    >
      <div className="day-pop-head">
        <div className="day-pop-title">{title}</div>
        <button type="button" className="day-pop-close" onClick={onClose} aria-label="Cerrar">
          <IconSvg d={Icons.x} size={15} />
        </button>
      </div>

      <div className="day-pop-body">
        <div className="day-detail-head">
          <div>
            <div className="day-detail-hours">{hasRecord ? fmtHours(cell.workedMinutes) : "—"}</div>
            <div className="day-detail-sub">
              {hasRecord ? `de ${fmtHours(plannedMinutes)} esperadas` : meta.label}
            </div>
          </div>
          <span className={`type-tag ${meta.variant}`}>{meta.label}</span>
        </div>

        {hasRecord ? (
          <>
            <div className="day-detail-bar">
              <span style={{ width: `${pct}%`, background: meta.dot }} />
            </div>
            <div className="day-detail-grid">
              <div className="day-detail-item">
                <div className="day-detail-key">Entrada</div>
                <div className="day-detail-val">{cell.firstIn ?? "--:--"}</div>
              </div>
              <div className="day-detail-item">
                <div className="day-detail-key">Salida</div>
                <div className="day-detail-val">{cell.lastOut ?? "--:--"}</div>
              </div>
              <div className="day-detail-item">
                <div className="day-detail-key">Break</div>
                <div className="day-detail-val">
                  {cell.breakMin > 0 ? `${cell.breakMin}m` : "—"}
                </div>
              </div>
              <div className="day-detail-item">
                <div className="day-detail-key">Llegada tarde</div>
                <div className="day-detail-val">
                  {cell.lateMinutes > 0 ? `${cell.lateMinutes}m` : "—"}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="day-detail-empty">{emptyMessage}</div>
        )}

        {hasRecord && cell.status === "holiday" && cell.holidayName && (
          <div className="day-detail-note">
            <strong>Feriado:</strong> {cell.holidayName}
          </div>
        )}

        {cell.reasonLabel && (
          <div className="day-detail-note">
            <strong>Regularizado:</strong> {cell.reasonLabel}
            {cell.reasonNote ? ` — ${cell.reasonNote}` : ""}
          </div>
        )}

        {cell.anomalies && cell.anomalies.length > 0 && (
          <div className="day-detail-note">
            <strong>Observaciones</strong>
            <ul className="day-detail-list">
              {cell.anomalies.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {cell.status !== "future" && (
        <div className="day-pop-foot">
          <Link
            href={`/requests/new?type=regularize&date=${cell.date}`}
            className="btn outline btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <IconSvg d={Icons.edit} size={13} /> Regularizar
          </Link>
        </div>
      )}
    </div>
  );

  const target =
    typeof document !== "undefined" ? document.querySelector(".nva-app") ?? document.body : null;
  return target ? createPortal(card, target) : null;
}

/* ============================================================
   List View
   ============================================================ */

function ListView({
  days,
  monthName,
  selectedDate,
  onSelect,
}: {
  days: CalendarCell[];
  monthName: string;
  selectedDate: string | null;
  onSelect: (cell: CalendarCell, anchor: HTMLElement) => void;
}) {
  const rows = days.filter(
    (d) => d.status === "ok" || d.status === "short" || d.status === "open"
  );
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
          rows.map((d) => (
            <tr
              key={d.date}
              onClick={(e) => onSelect(d, e.currentTarget)}
              className={d.date === selectedDate ? "row-selected" : undefined}
              style={{ cursor: "pointer" }}
            >
              <td className="tcell-strong">
                {String(d.d).padStart(2, "0")} {monthName.slice(0, 3)}
              </td>
              <td className="tcell-mono">{d.firstIn ?? "--:--"}</td>
              <td className="tcell-mono">{d.lastOut ?? "--:--"}</td>
              <td className="tcell-mono tcell-muted">{d.breakMin > 0 ? `${d.breakMin}m` : "—"}</td>
              <td className="tcell-mono">{fmtHours(d.workedMinutes)}</td>
              <td>
                <span className={`type-tag ${STATUS_META[d.status].variant}`}>
                  {STATUS_META[d.status].label}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
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
  // The anchor element is kept alongside the day so the detail card can be
  // positioned next to whichever cell (or list row) opened it.
  const [selected, setSelected] = useState<{ cell: CalendarCell; anchor: HTMLElement } | null>(
    null
  );

  const select = useCallback((cell: CalendarCell, anchor: HTMLElement) => {
    setSelected((prev) => (prev?.cell.date === cell.date ? null : { cell, anchor }));
  }, []);
  const closeDetail = useCallback(() => setSelected(null), []);

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
  const schedule = tenant?.settings?.workSchedule ?? tenant?.settings?.defaultSchedule;

  /** Daily target in minutes, from the tenant schedule (mirrors getTenantConfig). */
  const plannedMinutes = useMemo(() => {
    if (!schedule?.startTime || !schedule?.endTime) return DEFAULT_PLANNED_MINUTES;
    const start = clockToMinutes(schedule.startTime);
    const end = clockToMinutes(schedule.endTime);
    if (start === null || end === null) return DEFAULT_PLANNED_MINUTES;
    const total = end - start - (schedule.breakMinutes ?? 0);
    return total > 0 ? total : DEFAULT_PLANNED_MINUTES;
  }, [schedule]);

  // Build calendar cells
  const cells = useMemo(() => {
    const result: (CalendarCell | null)[] = [];
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
      // Holidays can come from the tenant settings or straight from the day row
      // (the history API resolves them server-side too).
      const holidayName = holidayByDate.get(date) ?? h?.holidayName;
      const isHoliday = !!holidayName || !!h?.isHoliday;

      const merged: HDay = {
        date,
        firstInLocal: h?.firstInLocal ?? null,
        lastOutLocal: h?.lastOutLocal ?? null,
        breakMinutes: h?.breakMinutes ?? 0,
        workedMinutes: h?.workedMinutes ?? 0,
        lateMinutes: h?.lateMinutes ?? 0,
        status: h?.status ?? "NO_RECORD",
        reasonLabel: h?.reasonLabel,
        reasonNote: h?.reasonNote,
        anomalies: h?.anomalies,
        isHoliday,
        holidayName,
      };

      const status = deriveStatus(merged, dow, isFuture, plannedMinutes);
      result.push({
        d: dnum,
        date,
        dow,
        status,
        workedMinutes: merged.workedMinutes,
        lateMinutes: merged.lateMinutes,
        holidayName,
        firstIn: merged.firstInLocal ? merged.firstInLocal.substring(0, 5) : null,
        lastOut: merged.lastOutLocal ? merged.lastOutLocal.substring(0, 5) : null,
        breakMin: merged.breakMinutes,
        reasonLabel: merged.reasonLabel,
        reasonNote: merged.reasonNote,
        anomalies: merged.anomalies,
      });
    }
    return result;
  }, [days, year, month, today, tenantHolidays, plannedMinutes]);

  // KPIs for the month
  const realDays = cells.filter((c): c is CalendarCell => c !== null);
  // Rest days, holidays, days that have not happened yet and approved leave are
  // not held against attendance.
  const workableDays = realDays.filter(
    (d) =>
      d.status !== "weekend" &&
      d.status !== "future" &&
      d.status !== "holiday" &&
      d.status !== "leave"
  ).length;
  const okDays = realDays.filter(
    (d) => d.status === "ok" || d.status === "short" || d.status === "open"
  ).length;
  const totalWorkedMin = realDays.reduce((sum, d) => sum + d.workedMinutes, 0);
  // Prefer the server-computed lateMinutes (it respects the employee schedule and
  // the tenant tolerance). Fall back to the tenant schedule for legacy rows
  // written before lateMinutes existed.
  const scheduleStartMin = clockToMinutes(schedule?.startTime);
  const toleranceMinutes = Number(tenant?.settings?.workSchedule?.toleranceMinutes ?? 10);
  const lateCount = realDays.filter((d) => {
    if (d.lateMinutes > 0) return true;
    if (scheduleStartMin === null) return false;
    const arrival = clockToMinutes(d.firstIn);
    return arrival !== null && arrival > scheduleStartMin + toleranceMinutes;
  }).length;
  const permitCount = realDays.filter((d) => d.status === "leave").length;
  const attendancePct = workableDays > 0 ? Math.round((okDays / workableDays) * 100) : 0;

  // Changing month or view unmounts the anchor, so drop the open detail first.
  function prevMonth() {
    closeDetail();
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    closeDetail();
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }
  function switchView(next: "cal" | "list") {
    closeDetail();
    setView(next);
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
            {isLoading ? "—" : <CountUp value={attendancePct} />}
            <span style={{ fontSize: 14 }}>%</span>
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Horas trabajadas</div>
          <div className="stat-mini-value">
            {isLoading ? "—" : <CountUp value={Math.round(totalWorkedMin / 60)} />}
            <span style={{ fontSize: 14 }}>h</span>
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Llegadas tarde</div>
          <div className="stat-mini-value">{isLoading ? "—" : <CountUp value={lateCount} />}</div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Permisos</div>
          <div className="stat-mini-value">{isLoading ? "—" : <CountUp value={permitCount} />}</div>
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
            onClick={() => switchView("cal")}
          >
            <IconSvg d={Icons.calendar} size={13} /> Calendario
          </button>
          <button
            type="button"
            className={`tab ${view === "list" ? "active" : ""}`}
            onClick={() => switchView("list")}
          >
            <IconSvg d={Icons.dashboard} size={13} /> Lista
          </button>
        </div>
        <div className="hist-legend">
          <span>
            <span className="legend-dot success" /> Completa
          </span>
          <span>
            <span className="legend-dot warn" /> Corta
          </span>
          <span>
            <span className="legend-dot accent" /> Permiso
          </span>
          <span>
            <span className="legend-dot danger" /> Feriado / Ausente
          </span>
          <span>
            <span className="legend-dot muted" /> Descanso
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
          <CalendarView
            cells={cells}
            todayDate={today}
            selectedDate={selected?.cell.date ?? null}
            onSelect={select}
          />
        ) : (
          <ListView
            days={realDays}
            monthName={monthName}
            selectedDate={selected?.cell.date ?? null}
            onSelect={select}
          />
        )}
      </div>

      {selected && (
        <DayPopover
          cell={selected.cell}
          anchor={selected.anchor}
          plannedMinutes={plannedMinutes}
          onClose={closeDetail}
        />
      )}
    </>
  );
}
