"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useAdminDashboard } from "@/hooks/use-employee";
import { usePendingRequests } from "@/hooks/use-requests";
import { useTenant } from "@/lib/contexts/tenant-context";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PremiumIcon, type PremiumIconTone } from "@/components/nova/premium-icon";
import { CountUp } from "@/components/nova/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtClock } from "@/lib/utils/time";

const TONE_HEX: Record<PremiumIconTone, string> = {
  Accent: "#3FBEFF",
  Indigo: "#6366F1",
  Teal: "#14B8A6",
  Green: "#10B981",
  Amber: "#F59E0B",
  Violet: "#8B5CF6",
  Rose: "#FB7185",
  Slate: "#94A3B8",
  Gold: "#F59E0B",
};

type ChartRange = "hoy" | "semana" | "mes";

/** YYYY-MM-DD in America/Lima. */
function ymdLima(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

/** Returns Monday→Sunday range covering the date `d` (Lima local). */
function weekRangeLima(d: Date): { from: string; to: string } {
  // toLocaleString gives Lima wall-clock; parse pieces explicitly to avoid
  // the JS-Date timezone trap when shifting by days.
  const limaDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const dow = limaDate.getDay(); // 0 = Sun .. 6 = Sat
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(limaDate);
  monday.setDate(limaDate.getDate() + offsetToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: ymdLima(monday), to: ymdLima(sunday) };
}

/** First→last day of the month containing `d` (Lima local). */
function monthRangeLima(d: Date): { from: string; to: string } {
  const limaDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const first = new Date(limaDate.getFullYear(), limaDate.getMonth(), 1);
  const last = new Date(limaDate.getFullYear(), limaDate.getMonth() + 1, 0);
  return { from: ymdLima(first), to: ymdLima(last) };
}

/* ============================================================
   Types
   ============================================================ */

interface DashboardData {
  ok: boolean;
  totalActiveEmployees: number;
  presentToday: number;
  pendingRequests: number;
  anomaliesToday: number;
  lateToday?: number;
  onBreakNow: number;
  absentToday: number;
  avgHoursPerDay?: number;
  weeklyAttendancePct?: number;
  isHoliday?: boolean;
  holidayName?: string;
  recentActivity?: Array<{
    id: string;
    type: "attendance" | "post" | "request" | "event";
    employeeName: string;
    action: string;
    detail?: string;
    time: string;
  }>;
  statusBreakdown?: {
    ok: number;
    open: number;
    short: number;
    missing: number;
    absence: number;
    regularized: number;
  };
  presence?: Array<{
    employeeId: string;
    fullName: string;
    area: string;
    position: string;
    avatarUrl?: string;
    status: string;
    firstInLocal: string | null;
    lastOutLocal: string | null;
    workedMinutes: number;
    anomalies: string[];
  }>;
}

/* ============================================================
   StatCard — matches design's .stat-card with delta + suffix
   ============================================================ */

interface StatCardProps {
  /** Premium duotone icon name */
  pi: string;
  /** Corporate tone for this KPI */
  tone: PremiumIconTone;
  label: string;
  value: string | number;
  suffix?: string;
  delta?: number;
  hint?: string;
  /** The highlighted card (soft tinted background) */
  feature?: boolean;
  loading?: boolean;
}

function StatCard({ pi, tone, label, value, suffix, delta, hint, feature, loading }: StatCardProps) {
  const positive = delta != null && delta >= 0;
  const hex = TONE_HEX[tone] ?? TONE_HEX.Accent;
  return (
    <div
      className={`stat-card toned ${feature ? "feature" : ""}`}
      style={{ "--tone": hex, "--tone-soft": `color-mix(in srgb, ${hex} 12%, transparent)` } as React.CSSProperties}
    >
      <div className="stat-bar" />
      <div className="stat-head">
        <span className="stat-icon">
          <PremiumIcon name={pi} size={30} tone={tone} />
        </span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-row">
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="stat-value">
            {value}
            {suffix && <span className="stat-suffix">{suffix}</span>}
          </div>
        )}
        {!loading && delta != null && (
          <div className={`stat-delta ${positive ? "up" : "down"}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d={positive ? "M5 2 L9 8 L1 8 Z" : "M5 8 L9 2 L1 2 Z"} fill="currentColor" />
            </svg>
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

/* ============================================================
   DctxCard — hero context card: live clock + weather + chips.
   Self-ticking (1s) so only this card re-renders each second.
   ============================================================ */

function DctxCard({
  present,
  dateStr,
  isHoliday,
  holidayName,
}: {
  present: number;
  dateStr: string;
  isHoliday?: boolean;
  holidayName?: string;
}) {
  const [now, setNow] = useState(() => new Date());
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const hhmm = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false });
  const ss = String(now.getSeconds()).padStart(2, "0");
  const isDay = now.getHours() >= 6 && now.getHours() < 18;
  const rays = [
    "M22 4.5V9", "M34.4 9.6L31.2 12.8", "M39.5 22H35", "M34.4 34.4L31.2 31.2",
    "M22 39.5V35", "M9.6 34.4L12.8 31.2", "M4.5 22H9", "M9.6 9.6L12.8 12.8",
  ];
  return (
    <div className="dctx-card">
      <div className="dctx-top">
        <div>
          <div className="dctx-time">
            {hhmm}
            <span className="dctx-sec">:{ss}</span>
          </div>
          <div className="dctx-date">
            {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} · Lima
          </div>
        </div>
        {/* Day/night indicator — reflects the real local hour (not weather data). */}
        <div className="dctx-weather" aria-label={isDay ? "Día" : "Noche"}>
          {isDay ? (
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
              <defs>
                <radialGradient id="dctxSunCore" cx="0.4" cy="0.34" r="0.72">
                  <stop offset="0%" stopColor="#FDE68A" />
                  <stop offset="55%" stopColor="#FBBF24" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </radialGradient>
              </defs>
              <circle cx="22" cy="22" r="13.5" fill="#F59E0B" opacity="0.13" />
              <g stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" opacity="0.9">
                {!reduceMotion && (
                  <animateTransform attributeName="transform" type="rotate" from="0 22 22" to="360 22 22" dur="90s" repeatCount="indefinite" />
                )}
                {rays.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
              <circle cx="22" cy="22" r="8.5" fill="url(#dctxSunCore)" />
              <circle cx="18.8" cy="18.8" r="2.6" fill="#fff" opacity="0.5" />
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
              <defs>
                <radialGradient id="dctxMoon" cx="0.4" cy="0.34" r="0.85">
                  <stop offset="0%" stopColor="#C7D2FE" />
                  <stop offset="60%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#6366F1" />
                </radialGradient>
              </defs>
              <circle cx="12" cy="12" r="11" fill="#6366F1" opacity="0.13" />
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" fill="url(#dctxMoon)" />
            </svg>
          )}
        </div>
      </div>
      <div className="dctx-divider" />
      <div className="dctx-chips">
        <div className="dctx-chip">
          <span className="pulse small" />
          <CountUp value={present} /> {present === 1 ? "presente" : "presentes"}
        </div>
        {isHoliday && (
          <div className="dctx-chip">
            <PremiumIcon name="beach" size={15} tone="Gold" />
            {holidayName || "Feriado hoy"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   HourlyChart — area chart with axis
   ============================================================ */

function HourlyChart({ data, loading, range = "hoy" }: { data: number[]; loading?: boolean; range?: ChartRange }) {
  const [hover, setHover] = useState<number | null>(null);
  const sum = data.reduce((a, b) => a + b, 0);
  const rawMax = Math.max(1, ...data);
  // Nice round max — step by 1 for small, by 5 for big enough
  const niceMax = rawMax <= 4 ? 4 : Math.ceil(rawMax / 5) * 5;
  const W = 100;
  const H = 100;
  const TOP_PCT = 8;
  const PAD = 2; // % horizontal inset
  const lerp = (i: number) => PAD + (i / (data.length - 1 || 1)) * (100 - 2 * PAD);
  const xAt = (i: number) => (lerp(i) / 100) * W;
  const toY = (v: number) => TOP_PCT + ((niceMax - v) / niceMax) * (100 - TOP_PCT);
  const toSvgY = (v: number) => (toY(v) / 100) * H;

  const pts = data.map((v, i) => `${xAt(i)},${toSvgY(v)}`).join(" ");
  const firstY = toSvgY(data[0]);
  const lastY = toSvgY(data[data.length - 1]);
  const area = `0,${H} 0,${firstY} ${pts} ${W},${lastY} ${W},${H}`;

  const yTicks = [0, 0.5, 1].map((f) => Math.round(niceMax * f));
  const Y_AXIS_W = 32;

  // Friendly empty state — animated bars + message (replaces the
  // flat-line "dead" look when no one has clocked in in the selected range).
  if (sum === 0 || loading) {
    const emptyHeading = loading
      ? "Cargando marcaciones…"
      : range === "hoy"
        ? "Aún no hay marcaciones registradas hoy."
        : range === "semana"
          ? "Aún no hay marcaciones esta semana."
          : "Aún no hay marcaciones este mes.";
    const emptySub = loading
      ? "Trayendo el rango seleccionado."
      : range === "hoy"
        ? "En cuanto alguien marque entrada, aparecerá aquí."
        : "Cuando el equipo marque, verás el desglose por hora.";
    return (
      <div className="hourly-chart">
        <div className="chart-empty">
          <div className="chart-empty-wave" aria-hidden>
            <span /><span /><span /><span /><span /><span /><span />
          </div>
          <div className="chart-empty-text">
            {emptyHeading}<br />
            {emptySub}
          </div>
        </div>
        <div className="hourly-axis" style={{ marginLeft: Y_AXIS_W }}>
          {["6h", "7h", "8h", "9h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h"].map((l, i) =>
            i % 2 === 0 ? <span key={l}>{l}</span> : <span key={l} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="hourly-chart">
      <div style={{ position: "relative", height: 140 }}>
        {/* Y-axis labels (left gutter) */}
        <div
          style={{ position: "absolute", left: 0, top: 0, width: Y_AXIS_W, height: "100%", pointerEvents: "none" }}
          aria-hidden
        >
          {yTicks
            .slice()
            .reverse()
            .map((t, idx) => (
              <span
                key={t + "_" + idx}
                style={{
                  position: "absolute",
                  right: 6,
                  top: `${TOP_PCT + idx * ((100 - TOP_PCT) / (yTicks.length - 1))}%`,
                  transform: "translateY(-50%)",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {t}
              </span>
            ))}
        </div>

        {/* Plot area — width:auto overrides chart-container's width:100% */}
        <div
          className="chart-container"
          style={{ position: "absolute", left: Y_AXIS_W, right: 4, top: 0, bottom: 0, width: "auto" }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", display: "block" }}
            className="chart-rise"
            aria-hidden
          >
            <defs>
              <linearGradient id="hourlyAreaGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {yTicks.map((_t, idx) => {
              const yPct = TOP_PCT + ((yTicks.length - 1 - idx) * (100 - TOP_PCT)) / (yTicks.length - 1);
              const yPx = (yPct / 100) * H;
              return (
                <line
                  key={idx}
                  x1="0"
                  x2={W}
                  y1={yPx}
                  y2={yPx}
                  stroke="var(--border)"
                  strokeWidth="0.3"
                  strokeDasharray="0.5 1"
                />
              );
            })}
            <polygon points={area} fill="url(#hourlyAreaGrad)" className="chart-area-breath" />
            <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <polyline points={pts} className="chart-shimmer" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          {data.map((v, i) => {
            if (v === 0) return null;
            return (
              <button
                key={i}
                type="button"
                className="chart-dot"
                style={{ left: `${lerp(i)}%`, top: `${toY(v)}%` }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${6 + i}h: ${v} marcaciones`}
              />
            );
          })}
          {hover !== null && (
            <div
              className="chart-tooltip"
              style={{ left: `${lerp(hover)}%`, top: `${toY(data[hover])}%` }}
            >
              <strong>{data[hover]}</strong>
              {data[hover] === 1 ? "marcación" : "marcaciones"} · {6 + hover}h
            </div>
          )}
        </div>
      </div>
      <div className="hourly-axis" style={{ marginLeft: Y_AXIS_W, marginRight: 4 }}>
        {["6h", "7h", "8h", "9h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h"].map((l, i) =>
          i % 2 === 0 ? <span key={l}>{l}</span> : <span key={l} />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PresenceCard
   ============================================================ */

const PRESENCE_CONFIG: Record<string, { label: string; cls: string }> = {
  WORKING: { label: "Trabajando", cls: "success" },
  ON_BREAK: { label: "En break", cls: "warn" },
  BREAK: { label: "En break", cls: "warn" },
  COMPLETED: { label: "Jornada completa", cls: "accent" },
  NOT_CHECKED_IN: { label: "Sin marcar", cls: "muted" },
  NOT_CHECKED: { label: "Sin marcar", cls: "muted" },
};

interface PresenceItem {
  employeeId: string;
  fullName: string;
  area: string;
  position?: string;
  avatarUrl?: string | null;
  status: string;
  firstInLocal: string | null;
  workedMinutes: number;
}

function PresenceCard({ p }: { p: PresenceItem }) {
  const cfg = PRESENCE_CONFIG[p.status] ?? PRESENCE_CONFIG.NOT_CHECKED_IN;
  const h = Math.floor(p.workedMinutes / 60);
  const m = p.workedMinutes % 60;
  const initials = p.fullName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="presence-card">
      <div className="presence-avatar-wrap">
        <div className={`avatar ${cfg.cls === "muted" ? "muted" : "plain"}`}>{initials}</div>
        <span className={`presence-dot ${cfg.cls}`} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="presence-name">{p.fullName}</div>
        <div className="presence-area">{p.area || p.position}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className={`presence-status ${cfg.cls}`}>{cfg.label}</div>
        <div className="presence-time">
          {fmtClock(p.firstInLocal)}
          {p.workedMinutes > 0 ? ` · ${h}h${m ? String(m).padStart(2, "0") + "m" : ""}` : ""}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ActivityRow
   ============================================================ */

const ACTIVITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  attendance: { color: "success", icon: Icons.arrow },
  in: { color: "success", icon: Icons.arrow },
  out: { color: "accent", icon: Icons.check },
  break: { color: "warn", icon: Icons.clock },
  approve: { color: "success", icon: Icons.check },
  request: { color: "accent", icon: Icons.doc },
  alert: { color: "danger", icon: Icons.alert },
  post: { color: "accent", icon: Icons.chat },
  event: { color: "accent", icon: Icons.calendar },
};

interface ActivityItem {
  id: string;
  type: string;
  employeeName?: string;
  who?: string;
  action: string;
  detail?: string;
  time?: string;
  t?: string;
}

function ActivityRow({ a }: { a: ActivityItem }) {
  const cfg = ACTIVITY_CONFIG[a.type] ?? ACTIVITY_CONFIG.attendance;
  return (
    <div className="activity-row">
      <div className={`activity-icon ${cfg.color}`}>
        <IconSvg d={cfg.icon} size={13} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="activity-text">
          <strong>{a.employeeName ?? a.who}</strong> {a.action}
        </div>
        {a.detail && <div className="activity-detail">{a.detail}</div>}
      </div>
      <div className="activity-time">{a.time ?? a.t}</div>
    </div>
  );
}

/* ============================================================
   Breakdown bar + list
   ============================================================ */

interface BreakdownItem {
  key: string;
  label: string;
  value: number;
  color: "success" | "accent" | "warn" | "danger" | "muted";
}

function Breakdown({ data, total }: { data: BreakdownItem[]; total: number }) {
  return (
    <div>
      <div className="breakdown-bar">
        {data.map((d) => (
          <div
            key={d.key}
            className={`bar-seg ${d.color}`}
            style={{ width: total > 0 ? `${(d.value / total) * 100}%` : "0%" }}
            title={`${d.label}: ${d.value}`}
          />
        ))}
      </div>
      <div className="breakdown-list">
        {data.map((d) => (
          <div key={d.key} className="breakdown-item">
            <span className={`legend-dot ${d.color}`} />
            <span className="breakdown-label">{d.label}</span>
            <span className="breakdown-val">{d.value}</span>
            <span className="breakdown-pct">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Sites + Pending rows
   ============================================================ */

interface SiteItem {
  name: string;
  city: string;
  employees: number;
  present: number;
  pct: number;
}

function SiteRow({ s }: { s: SiteItem }) {
  return (
    <div className="site-row">
      <div className="site-icon">
        <IconSvg d={Icons.pin} size={15} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="site-name">{s.name}</div>
        <div className="site-meta">
          {s.present}/{s.employees} presentes
        </div>
      </div>
      <div style={{ width: 90 }}>
        <div className="site-bar">
          <div className="site-bar-fill" style={{ width: `${s.pct}%` }} />
        </div>
      </div>
      <div className="site-pct">{s.pct}%</div>
    </div>
  );
}

interface PendingItem {
  id: string;
  who: string;
  type: string;
  when: string;
  reason: string;
  priority: "normal" | "high";
}

function PendingRow({ r }: { r: PendingItem }) {
  const typeColors: Record<string, string> = {
    Vacaciones: "accent",
    Permiso: "warn",
    Regularización: "muted",
  };
  const initials = r.who
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="pending-row">
      <div className="avatar plain" style={{ width: 36, height: 36 }}>{initials}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="pending-who">{r.who}</span>
          <span className={`type-tag ${typeColors[r.type] ?? "muted"}`}>{r.type}</span>
          {r.priority === "high" && <span className="type-tag danger">Urgente</span>}
        </div>
        <div className="pending-meta">
          {r.when} · {r.reason}
        </div>
      </div>
      <button className="btn-ghost" type="button">
        <IconSvg d={Icons.arrow} size={14} />
      </button>
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function useNow(interval = 30000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

function getGreeting(h: number) {
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

/* ============================================================
   Page
   ============================================================ */

export default function AdminDashboard() {
  const { data: session } = useSession();
  const { data, isLoading, isError, refetch } = useAdminDashboard();
  const { data: pendingData } = usePendingRequests();
  const { tenantName } = useTenant();
  const dashboard = data as DashboardData | undefined;
  const now = useNow(30000);

  const firstName = session?.user?.name?.split(" ")[0] ?? "Admin";

  const total = dashboard?.totalActiveEmployees ?? 0;
  const present = dashboard?.presentToday ?? 0;
  const pending = dashboard?.pendingRequests ?? 0;
  const anomalies = dashboard?.anomaliesToday ?? 0;
  const avgHours = dashboard?.avgHoursPerDay ?? 0;
  const weeklyPct =
    dashboard?.weeklyAttendancePct ??
    (total > 0 ? Math.round((present / total) * 100) : 0);

  const breakdown: BreakdownItem[] = useMemo(() => {
    const b = dashboard?.statusBreakdown;
    if (!b) return [];
    return [
      { key: "working", label: "Trabajando", value: b.open, color: "success" },
      { key: "completed", label: "Jornada completa", value: b.ok, color: "accent" },
      { key: "short", label: "Jornada corta", value: b.short, color: "warn" },
      { key: "absent", label: "Ausentes", value: b.absence, color: "danger" },
      { key: "missing", label: "Sin registro", value: b.missing, color: "muted" },
    ];
  }, [dashboard]);

  const presence = dashboard?.presence ?? [];
  const recentActivity = dashboard?.recentActivity ?? [];

  const [chartRange, setChartRange] = useState<ChartRange>("hoy");

  // Bucket the first check-in of each present employee by hour (6h–19h).
  // `firstInLocal` may arrive as either a plain "HH:MM" or a full ISO with
  // timezone like "2026-05-28T09:00:00-05:00", so pull the time component
  // explicitly before parsing the hour.
  const hourlyDataToday = useMemo(() => {
    if (presence.length === 0) return Array(14).fill(0);
    const buckets = Array(14).fill(0);
    presence.forEach((p) => {
      if (!p.firstInLocal) return;
      const timePart = p.firstInLocal.includes("T")
        ? p.firstInLocal.split("T")[1]
        : p.firstInLocal;
      const h = parseInt(timePart.slice(0, 2), 10);
      if (Number.isNaN(h)) return;
      const idx = h - 6;
      if (idx >= 0 && idx < 14) buckets[idx]++;
    });
    return buckets;
  }, [presence]);

  // For week / month, fetch the reports-stats endpoint and collapse its
  // (day-of-week × hour) heatmap into the same 6h–19h hour buckets the
  // chart already renders.
  const chartRangeBounds = useMemo(() => {
    if (chartRange === "hoy") return null;
    return chartRange === "semana" ? weekRangeLima(now) : monthRangeLima(now);
    // `now` ticks every second; we only care about the day boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRange, ymdLima(now)]);

  const { data: rangeStats, isFetching: rangeStatsFetching } = useQuery({
    queryKey: ["dashboard-hourly", chartRange, chartRangeBounds?.from, chartRangeBounds?.to],
    enabled: chartRange !== "hoy" && !!chartRangeBounds,
    queryFn: async () => {
      const { from, to } = chartRangeBounds!;
      const res = await fetch(`/api/admin/reports/stats?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Error al cargar estadísticas");
      return res.json() as Promise<{ entryHeatmap: number[][] }>;
    },
    staleTime: 60_000,
  });

  const hourlyData = useMemo(() => {
    if (chartRange === "hoy") return hourlyDataToday;
    const heat = rangeStats?.entryHeatmap;
    if (!heat) return Array(14).fill(0);
    // Sum across the 7 days of the week into a single hour-of-day series,
    // then slice 6h–19h to match the chart's x-axis.
    const perHour = Array(24).fill(0);
    for (let dow = 0; dow < 7; dow++) {
      const row = heat[dow] ?? [];
      for (let h = 0; h < 24; h++) perHour[h] += row[h] ?? 0;
    }
    return perHour.slice(6, 20);
  }, [chartRange, hourlyDataToday, rangeStats]);

  const chartIsLoading = chartRange !== "hoy" && rangeStatsFetching && !rangeStats;

  const chartSubLabel =
    chartRange === "hoy"
      ? "Hoy, por hora"
      : chartRange === "semana"
        ? "Esta semana, por hora"
        : "Este mes, por hora";

  // Derive sites from presence (group by area as a proxy)
  const sites: SiteItem[] = useMemo(() => {
    if (presence.length === 0) return [];
    const byArea: Record<string, { total: number; present: number }> = {};
    presence.forEach((p) => {
      const a = p.area || "Sin área";
      if (!byArea[a]) byArea[a] = { total: 0, present: 0 };
      byArea[a].total += 1;
      if (p.status === "WORKING" || p.status === "BREAK" || p.status === "ON_BREAK") {
        byArea[a].present += 1;
      }
    });
    return Object.entries(byArea)
      .map(([name, v]) => ({
        name,
        city: name,
        employees: v.total,
        present: v.present,
        pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.employees - a.employees)
      .slice(0, 4);
  }, [presence]);

  const pendingItems: PendingItem[] = useMemo(() => {
    const reqs = pendingData?.requests ?? [];
    const typeLabel: Record<string, string> = {
      VACATION: "Vacaciones",
      PERMISSION: "Permiso",
      REGULARIZATION_SINGLE: "Regularización",
      REGULARIZATION_RANGE: "Regularización",
    };
    return reqs.slice(0, 5).map((r) => {
      const when = r.dateFrom && r.dateTo
        ? `${r.dateFrom} – ${r.dateTo}`
        : r.effectiveDate ?? "—";
      return {
        id: r.RequestID,
        who: r.employeeName ?? r.employeeId ?? "—",
        type: typeLabel[r.requestType] ?? r.requestType,
        when,
        reason: r.reasonNote ?? r.reasonCode ?? "",
        priority: "normal" as const,
      };
    });
  }, [pendingData]);

  const dateStr = now.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  const tenantText = tenantName ?? "Workspace";

  if (isError) {
    return (
      <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
        <div
          role="alert"
          style={{
            maxWidth: 460,
            width: "100%",
            padding: 24,
            borderRadius: "var(--r)",
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in srgb, var(--danger) 14%, transparent)",
              color: "var(--danger)",
            }}
          >
            <IconSvg d={Icons.alert} size={22} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              No pudimos cargar el dashboard
            </p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Hubo un problema al obtener los datos. Vuelve a intentarlo en unos segundos.
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => refetch()}
            style={{ marginTop: 4 }}
          >
            <IconSvg d={Icons.history} size={14} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero / Welcome */}
      <section className="hero">
        <div className="hero-text">
          <div className="hero-eyebrow">
            Panel de administración · {dateStr}
          </div>
          <h1 className="hero-title">
            {getGreeting(now.getHours())}, {firstName}.
          </h1>
          <p className="hero-sub">
            Vista general de operaciones. <strong><CountUp value={present} /></strong> empleados en jornada en{" "}
            <strong>{sites.length || 1}</strong> sede{(sites.length || 1) !== 1 ? "s" : ""}.
          </p>
          <div className="hero-actions">
            <Link href="/admin/reports" className="btn-primary" style={{ textDecoration: "none" }}>
              <IconSvg d={Icons.download} size={14} />
              Exportar
            </Link>
            <Link href="/admin/attendance" className="btn-secondary" style={{ textDecoration: "none" }}>
              <IconSvg d={Icons.filter} size={14} />
              Filtrar
            </Link>
            <div className="live-indicator">
              <span className="pulse" />
              En vivo · {timeStr}
            </div>
          </div>
        </div>
        <div className="hero-art">
          <DctxCard
            present={present}
            dateStr={dateStr}
            isHoliday={dashboard?.isHoliday}
            holidayName={dashboard?.holidayName}
          />
        </div>
      </section>

      {/* Metric grid */}
      <section className="metrics-grid">
        <StatCard
          pi="users"
          tone="Indigo"
          label="Empleados activos"
          value={total}
          hint="en todas las sedes"
          loading={isLoading}
        />
        <StatCard
          pi="clock"
          tone="Green"
          feature
          label="Presentes hoy"
          value={present}
          hint={`${weeklyPct}% asistencia`}
          loading={isLoading}
        />
        <StatCard
          pi="check"
          tone="Amber"
          label="Solicitudes pendientes"
          value={pending}
          hint="requiere revisión"
          loading={isLoading}
        />
        <StatCard
          pi="alert"
          tone="Rose"
          label="Anomalías"
          value={anomalies}
          hint="jornadas abiertas"
          loading={isLoading}
        />
        <StatCard
          pi="timer"
          tone="Violet"
          label="Promedio horas/día"
          value={avgHours > 0 ? avgHours.toFixed(1) : "—"}
          suffix={avgHours > 0 ? "h" : undefined}
          hint="últimos 7 días"
          loading={isLoading}
        />
        <StatCard
          pi="calendar"
          tone="Teal"
          label="Asistencia semanal"
          value={weeklyPct}
          suffix="%"
          hint="a nivel empresa"
          loading={isLoading}
        />
      </section>

      {/* Row: chart + breakdown */}
      <section className="row two-thirds">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Distribución horaria de marcaciones</div>
              <div className="panel-sub">{chartSubLabel}</div>
            </div>
            <div className="panel-actions" role="tablist" aria-label="Rango de tiempo">
              <button
                type="button"
                className={`chip ${chartRange === "hoy" ? "active" : ""}`}
                role="tab"
                aria-selected={chartRange === "hoy"}
                onClick={() => setChartRange("hoy")}
              >
                Hoy
              </button>
              <button
                type="button"
                className={`chip ${chartRange === "semana" ? "active" : ""}`}
                role="tab"
                aria-selected={chartRange === "semana"}
                onClick={() => setChartRange("semana")}
              >
                Semana
              </button>
              <button
                type="button"
                className={`chip ${chartRange === "mes" ? "active" : ""}`}
                role="tab"
                aria-selected={chartRange === "mes"}
                onClick={() => setChartRange("mes")}
              >
                Mes
              </button>
            </div>
          </div>
          <HourlyChart data={hourlyData} loading={chartIsLoading} range={chartRange} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Desglose de estado</div>
              <div className="panel-sub">{total} empleados</div>
            </div>
          </div>
          {breakdown.length > 0 ? (
            <Breakdown data={breakdown} total={total} />
          ) : (
            <div style={{ padding: "16px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
              Sin datos disponibles
            </div>
          )}
        </div>
      </section>

      {/* Row: presence + activity */}
      <section className="row two-thirds">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Presencia en vivo</div>
              <div className="panel-sub">
                <span className="pulse small" /> Actualiza cada 30s
              </div>
            </div>
            <Link href="/admin/attendance" className="btn-ghost-link">
              Ver todo <IconSvg d={Icons.arrow} size={13} />
            </Link>
          </div>
          <div className="presence-grid">
            {presence.length > 0 ? (
              presence.slice(0, 8).map((p) => (
                <PresenceCard
                  key={p.employeeId}
                  p={{
                    employeeId: p.employeeId,
                    fullName: p.fullName,
                    area: p.area,
                    position: p.position,
                    avatarUrl: p.avatarUrl,
                    status: p.status,
                    firstInLocal: p.firstInLocal,
                    workedMinutes: p.workedMinutes,
                  }}
                />
              ))
            ) : (
              <div
                style={{
                  padding: "20px 0",
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  gridColumn: "1 / -1",
                }}
              >
                Sin actividad de presencia
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Actividad reciente</div>
              <div className="panel-sub">Última hora</div>
            </div>
          </div>
          <div className="activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 12).map((a) => <ActivityRow key={a.id} a={a} />)
            ) : (
              <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                Sin actividad reciente
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Row: sites + queue */}
      <section className="row half">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Sedes / Áreas</div>
              <div className="panel-sub">
                {sites.length} {sites.length === 1 ? "ubicación activa" : "ubicaciones activas"}
              </div>
            </div>
            <Link href="/admin/employees" className="btn-ghost-link">
              Ver todo <IconSvg d={Icons.arrow} size={13} />
            </Link>
          </div>
          <div className="sites-list">
            {sites.length > 0 ? (
              sites.map((s) => <SiteRow key={s.name} s={s} />)
            ) : (
              <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                Sin sedes registradas
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Cola de aprobación</div>
              <div className="panel-sub">{pending} esperando decisión</div>
            </div>
            <Link href="/admin/approvals" className="btn-ghost-link">
              Ver todo <IconSvg d={Icons.arrow} size={13} />
            </Link>
          </div>
          <div className="pending-list">
            {pendingItems.length > 0 ? (
              pendingItems.map((r) => <PendingRow key={r.id} r={r} />)
            ) : pending > 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                <Link href="/admin/approvals" style={{ color: "var(--accent)", textDecoration: "none" }}>
                  {pending} solicitudes pendientes →
                </Link>
              </div>
            ) : (
              <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
                Sin solicitudes pendientes
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>Novaassistance · {tenantText}</span>
        <span>Diseñado para equipos en órbita</span>
      </footer>
    </>
  );
}
