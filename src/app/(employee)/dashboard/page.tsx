"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { useTodayStatus, useWeekSummary, useRecordEvent } from "@/hooks/use-attendance";
import { useMyProfile } from "@/hooks/use-employee";
import { useHREvents } from "@/hooks/use-hr";
import { useMyRequests } from "@/hooks/use-requests";
import { useTenantConfig } from "@/hooks/use-tenant";
import { useTenantTimezone, timePartsInTz, todayInTz } from "@/hooks/use-timezone";
import { CheckInOrbital } from "@/components/attendance/check-in-cockpit-full";
import { NovaClock, useClockStyle } from "@/components/nova/clocks";
import { OpenShiftBanner } from "@/components/attendance/open-shift-banner";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PremiumIcon } from "@/components/nova/premium-icon";
import type { BirthdayEntry, AnniversaryEntry, HREvent, EventType } from "@/lib/types";
import { fmtClock } from "@/lib/utils/time";

/* ============================================================
   Helpers
   ============================================================ */

function useNow(interval = 1000) {
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

function fmtSecondsHMS(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function fmtMinutes(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtHM(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * The backend clears breakStartLocal once BREAK_END is recorded (it keeps only
 * breakEndLocal + breakMinutes). To still show "Inicio break" in the timeline of
 * a finished day, derive it as breakEnd − breakMinutes.
 */
function deriveBreakStartLocal(
  breakStartLocal: string | null | undefined,
  breakEndLocal: string | null | undefined,
  breakMinutes: number | undefined
): string | null {
  if (breakStartLocal) return breakStartLocal;
  if (!breakEndLocal || !breakMinutes) return null;
  const [h, m, s] = breakEndLocal.split(":").map(Number);
  let total = h * 60 + (m || 0) - breakMinutes;
  if (total < 0) total = 0;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(s || 0).padStart(2, "0")}`;
}

type CheckinState = "before" | "working" | "break" | "completed" | "offhours" | "vacation" | "holiday";

interface TodayLike {
  status?: string;
  hasOpenShift?: boolean;
  hasOpenBreak?: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  firstInLocal?: string | null;
  lastOutLocal?: string | null;
  breakStartLocal?: string | null;
  breakEndLocal?: string | null;
  breakMinutes?: number;
  workedMinutes?: number;
  plannedMinutes?: number;
}

function deriveState(today: TodayLike | undefined, now: Date): CheckinState {
  // Active or finished shifts take precedence over holiday/weekend framing, so
  // an employee who works a holiday or weekend can still pause, resume, or close
  // their shift instead of being stuck on a card with no action.
  if (today?.hasOpenBreak) return "break";
  if (today?.hasOpenShift) return "working";
  if (today?.status === "OK" || today?.status === "CLOSED" || today?.status === "REGULARIZED") return "completed";
  if (today?.isHoliday) return "holiday";
  const dow = now.getDay();
  if (dow === 0 || dow === 6) return "offhours";
  return "before";
}

/* ============================================================
   CheckInHero — original layout (left content + right clock)
   enriched with stats strip + streak + milestone
   ============================================================ */

interface HeroProps {
  firstName: string;
  state: CheckinState;
  now: Date;
  today: TodayLike | undefined;
  isLoading: boolean;
  liveWorkedSec: number;
  liveBreakSec: number;
  shiftStart: string;
  shiftEnd: string;
  breakMin: number;
  todayHistory: { time: string; label: string; loc: string; kind: string }[];
  onAction: (type: EventType, customTime?: string) => Promise<void>;
  pendingAction: EventType | null;
  allowCustomStart: boolean;
  /** True while the tenant config (which carries allowCustomStartTime) is still
   *  loading. We must not let a START tap resolve to an immediate check-in
   *  before we know whether the custom-start picker should open. */
  tenantConfigLoading: boolean;
  weekTotalMin: number;
  weekAvgMin: number;
  weekBestMin: number;
  weekBestDayLabel: string;
  weekSparkline: number[];
  weekGoalMin: number;
  streakDays: number;
  siteName: string;
  siteAddress: string;
  siteRadius: number;
}

function CheckInHero({
  firstName,
  state,
  now,
  today,
  isLoading,
  liveWorkedSec,
  liveBreakSec,
  shiftStart,
  shiftEnd,
  breakMin,
  todayHistory,
  onAction,
  pendingAction,
  allowCustomStart,
  tenantConfigLoading,
  weekTotalMin,
  weekAvgMin,
  weekBestMin,
  weekBestDayLabel,
  weekSparkline,
  weekGoalMin,
  streakDays,
  siteName,
  siteAddress,
  siteRadius,
}: HeroProps) {
  const stateMeta: Record<
    CheckinState,
    {
      dot: string;
      pillTxt: string;
      pillCls: string;
      primaryLabel: string;
      primaryIcon: React.ReactNode;
      primaryAction?: EventType;
      secondaryLabel?: string;
      secondaryIcon?: React.ReactNode;
      secondaryAction?: EventType;
      sub: string;
      subVal: string;
      headline: string;
    }
  > = {
    before: {
      dot: "muted",
      pillTxt: "Sin marcar",
      pillCls: "muted",
      primaryLabel: "Marcar entrada",
      primaryIcon: <IconSvg d={Icons.check} size={16} stroke={2} />,
      primaryAction: "START",
      sub: "Tu turno comienza a las",
      subVal: shiftStart,
      headline: `${getGreeting(now.getHours())}, ${firstName}.`,
    },
    working: {
      dot: "success",
      pillTxt: "Trabajando",
      pillCls: "success",
      primaryLabel: "Marcar salida",
      primaryIcon: <IconSvg d={Icons.x} size={16} stroke={2} />,
      primaryAction: "END",
      secondaryLabel: "Iniciar break",
      secondaryIcon: <IconSvg d={Icons.coffee} size={14} />,
      secondaryAction: "BREAK_START",
      sub: "Tiempo trabajado",
      subVal: fmtSecondsHMS(liveWorkedSec),
      headline: `En jornada, ${firstName}.`,
    },
    break: {
      dot: "warn",
      pillTxt: "En break",
      pillCls: "warn",
      primaryLabel: "Reanudar trabajo",
      primaryIcon: <IconSvg d={Icons.check} size={16} stroke={2} />,
      primaryAction: "BREAK_END",
      sub: "Tiempo de break",
      subVal: fmtSecondsHMS(liveBreakSec),
      headline: "Tiempo de recargar.",
    },
    completed: {
      dot: "accent",
      pillTxt: "Jornada completa",
      pillCls: "accent",
      primaryLabel: "Ver reporte",
      primaryIcon: <IconSvg d={Icons.arrow} size={16} stroke={2} />,
      sub: "Trabajaste",
      subVal: today?.workedMinutes ? fmtMinutes(today.workedMinutes) : "—",
      headline: `Bien hecho, ${firstName}.`,
    },
    offhours: {
      dot: "muted",
      pillTxt: "Fin de semana",
      pillCls: "muted",
      // Weekends are off for most, but some employees work them — allow check-in
      // (and the custom-start picker, which keys on primaryAction === "START")
      // instead of blocking it behind an action-less "Ver horario" button.
      primaryLabel: "Marcar entrada",
      primaryIcon: <IconSvg d={Icons.check} size={16} stroke={2} />,
      primaryAction: "START",
      sub: "Tu turno comienza a las",
      subVal: shiftStart,
      headline: `${getGreeting(now.getHours())}, ${firstName}.`,
    },
    vacation: {
      dot: "accent",
      pillTxt: "De vacaciones",
      pillCls: "accent",
      primaryLabel: "Ver saldo",
      primaryIcon: <IconSvg d={Icons.beach} size={16} stroke={2} />,
      sub: "Días restantes",
      subVal: "—",
      headline: "Tiempo de descansar.",
    },
    holiday: {
      dot: "warn",
      pillTxt: "Feriado",
      pillCls: "warn",
      primaryLabel: "Ver calendario",
      primaryIcon: <IconSvg d={Icons.calendar} size={16} stroke={2} />,
      sub: "Feriado",
      subVal: today?.holidayName ?? "Hoy",
      headline: "Hoy es feriado.",
    },
  };

  const meta = stateMeta[state];
  const clockStyle = useClockStyle();

  // Optional "custom start time" picker (only when the admin enabled it and
  // the next action is the day's first check-in).
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [customStart, setCustomStart] = useState(shiftStart);
  const canCustomStart = allowCustomStart && meta.primaryAction === "START";
  const openStartPicker = () => { setCustomStart(shiftStart); setStartPickerOpen(true); };

  // ── Progress & milestone ──
  // Daily goal = laborable hours = shift span minus the (unpaid) break.
  // worked time already excludes the break, so progress is measured against this.
  const grossShiftMin = Math.max(1, parseHM(shiftEnd) - parseHM(shiftStart));
  const totalShiftMin = Math.max(1, grossShiftMin - breakMin);
  const workedMin = liveWorkedSec / 60;
  const progressPct = Math.min(100, Math.round((workedMin / totalShiftMin) * 100));
  const remainingMin = Math.max(0, Math.round(totalShiftMin - workedMin));

  const rawDateStr = now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  const dateStr = rawDateStr.charAt(0).toUpperCase() + rawDateStr.slice(1);
  const timeStr = now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  const isLive = state === "working" || state === "break";
  const showLocation = state === "before" || state === "working" || state === "break";
  const showTimeline = state === "working" || state === "break" || state === "completed";
  const showProgress = state === "working" || state === "break";
  const showMilestone = state === "working" && remainingMin > 0;

  return (
    <section className="checkin-hero">
      <div className="checkin-left">
        {/* PILLS row with NEW streak chip */}
        <div className="checkin-pills">
          <span className={`pill ${meta.pillCls}`}>
            <span className={`pill-dot ${meta.dot}`} />
            {meta.pillTxt}
          </span>
          <span className="pill plain">
            <span className="pulse small" /> {timeStr}
          </span>
          <span className="pill plain">{dateStr}</span>
          {streakDays > 1 && (
            <span className="pill streak" title="Días consecutivos asistidos">
              <span aria-hidden style={{ fontSize: 11 }}>🔥</span>
              Racha {streakDays} {streakDays === 1 ? "día" : "días"}
            </span>
          )}
        </div>

        <h1 className="checkin-headline">{meta.headline}</h1>

        {/* LOCATION card (original) */}
        {showLocation && (
          <div className="loc-card">
            <div className="loc-pin">
              <IconSvg d={Icons.pin} size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="loc-title">
                Estás en <strong>{siteName}</strong>
              </div>
              <div className="loc-meta">{siteAddress}{siteRadius > 0 ? ` · Dentro del radio de ${siteRadius}m` : ""}</div>
            </div>
            <div className="loc-confirm">
              <IconSvg d={Icons.check} size={14} />
            </div>
          </div>
        )}

        {/* TIMELINE mini (original) */}
        {showTimeline && todayHistory.length > 0 && (
          <div className="timeline-mini">
            <div className="timeline-track">
              {todayHistory.map((ev, i) => (
                <div key={i} className={`timeline-pt ${ev.kind}`} title={`${ev.time} · ${ev.label}`}>
                  <span className="timeline-dot" />
                  <span className="timeline-time">{ev.time}</span>
                  <span className="timeline-label">{ev.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NEW: PROGRESS bar */}
        {showProgress && (
          <div className="hero-progress">
            <div className="hero-progress-head">
              <span className="hero-progress-label">Progreso del turno</span>
              <span className="hero-progress-pct tabular-nums">{progressPct}%</span>
            </div>
            <div className="hero-progress-track">
              <div className={`hero-progress-fill ${state}`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* INLINE STATS strip — enriched */}
        <div className="hero-stats">
          {/* Card 1: Faltan / Meta */}
          {showMilestone ? (
            <div className="hero-stat hero-stat-highlight">
              <div className="hero-stat-head">
                <span className="hero-stat-label">Faltan</span>
                <span className="hero-stat-ico">
                  <IconSvg d={Icons.clock} size={13} />
                </span>
              </div>
              <span className="hero-stat-value tabular-nums">{fmtMinutes(remainingMin)}</span>
              <span className="hero-stat-sub">para tu meta de {fmtMinutes(totalShiftMin)}</span>
            </div>
          ) : (
            <div className="hero-stat">
              <div className="hero-stat-head">
                <span className="hero-stat-label">Meta del día</span>
                <span className="hero-stat-ico">
                  <IconSvg d={Icons.clock} size={13} />
                </span>
              </div>
              <span className="hero-stat-value tabular-nums">{fmtMinutes(totalShiftMin)}</span>
              <span className="hero-stat-sub">horas laborables · {fmtMinutes(breakMin)} de break aparte</span>
            </div>
          )}

          {/* Card 2: Esta semana — with mini sparkline */}
          <div className="hero-stat">
            <div className="hero-stat-head">
              <span className="hero-stat-label">Esta semana</span>
              <span className="hero-stat-ico">
                <IconSvg d={Icons.calendar} size={13} />
              </span>
            </div>
            <span className="hero-stat-value tabular-nums">
              {weekTotalMin > 0 ? fmtMinutes(weekTotalMin) : <span className="hero-stat-empty">—</span>}
            </span>
            {weekSparkline.length > 0 && weekTotalMin > 0 ? (
              <div className="hero-stat-spark" aria-hidden>
                {weekSparkline.map((v, i) => {
                  const max = Math.max(...weekSparkline, 1);
                  return (
                    <span
                      key={i}
                      className="hero-stat-spark-bar"
                      style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
                    />
                  );
                })}
              </div>
            ) : (
              <span className="hero-stat-sub">
                meta {fmtMinutes(weekGoalMin)}
              </span>
            )}
          </div>

          {/* Card 3: Promedio diario — with comparison vs goal */}
          <div className="hero-stat">
            <div className="hero-stat-head">
              <span className="hero-stat-label">Promedio diario</span>
              <span className="hero-stat-ico">
                <IconSvg d={Icons.pulse} size={13} />
              </span>
            </div>
            <span className="hero-stat-value tabular-nums">
              {weekAvgMin > 0 ? fmtMinutes(weekAvgMin) : <span className="hero-stat-empty">—</span>}
            </span>
            {weekAvgMin > 0 ? (
              <span className={`hero-stat-trend ${weekAvgMin >= totalShiftMin ? "up" : "down"}`}>
                <span className="hero-stat-trend-arrow">
                  {weekAvgMin >= totalShiftMin ? "↑" : "↓"}
                </span>
                {weekAvgMin >= totalShiftMin
                  ? `+${fmtMinutes(weekAvgMin - totalShiftMin)} sobre meta`
                  : `${fmtMinutes(totalShiftMin - weekAvgMin)} bajo meta`}
              </span>
            ) : (
              <span className="hero-stat-sub">aún sin datos</span>
            )}
          </div>

          {/* Card 4: Mejor día — with day name highlighted */}
          <div className="hero-stat">
            <div className="hero-stat-head">
              <span className="hero-stat-label">Mejor día</span>
              <span className="hero-stat-ico">
                <IconSvg d={Icons.check} size={13} />
              </span>
            </div>
            {weekBestMin > 0 ? (
              <>
                <span className="hero-stat-value tabular-nums">{fmtMinutes(weekBestMin)}</span>
                <span className="hero-stat-day-pill">{weekBestDayLabel}</span>
              </>
            ) : (
              <>
                <span className="hero-stat-value"><span className="hero-stat-empty">—</span></span>
                <span className="hero-stat-sub">aún sin marcaciones</span>
              </>
            )}
          </div>
        </div>

        {/* CTA row (original) */}
        <div className="checkin-cta">
          <button
            className={`btn-action ${meta.pillCls} ${isLive ? "is-live" : ""}`}
            disabled={
              isLoading ||
              pendingAction !== null ||
              !meta.primaryAction ||
              // Don't allow the day's first check-in to fire until the tenant
              // config has loaded — otherwise a fast tap (common on mobile)
              // checks in immediately and skips the custom-start picker.
              (meta.primaryAction === "START" && tenantConfigLoading)
            }
            onClick={() => {
              if (!meta.primaryAction) return;
              if (canCustomStart) openStartPicker();
              else onAction(meta.primaryAction);
            }}
          >
            {pendingAction === meta.primaryAction ? (
              <span style={{
                width: 14, height: 14, border: "2px solid currentColor",
                borderTopColor: "transparent", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
            ) : (
              meta.primaryIcon
            )}
            {meta.primaryLabel}
          </button>
          {meta.secondaryLabel && (
            <button
              className="btn-action-secondary"
              disabled={isLoading || pendingAction !== null}
              onClick={() => meta.secondaryAction && onAction(meta.secondaryAction)}
            >
              {pendingAction === meta.secondaryAction ? (
                <span style={{
                  width: 12, height: 12, border: "2px solid currentColor",
                  borderTopColor: "transparent", borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }} />
              ) : (
                meta.secondaryIcon
              )}
              {meta.secondaryLabel}
            </button>
          )}
          <div className="checkin-meta">
            <span className="meta-label">{meta.sub}</span>
            <span className="meta-val">{meta.subVal}</span>
          </div>
        </div>

        {/* Custom start-time picker (admin-enabled): pick the hour you started */}
        {startPickerOpen && canCustomStart && (
          <div className="start-picker">
            <span className="start-picker-title">¿A qué hora entraste?</span>
            <div className="start-picker-row">
              <input
                type="time"
                className="start-picker-input"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <button
                className="btn-action accent"
                disabled={pendingAction !== null || !customStart}
                onClick={() => { setStartPickerOpen(false); onAction("START", customStart); }}
              >
                Marcar a las {customStart}
              </button>
            </div>
            <div className="start-picker-sub">
              <button
                type="button"
                className="start-picker-link"
                disabled={pendingAction !== null}
                onClick={() => { setStartPickerOpen(false); onAction("START"); }}
              >
                o marcar con la hora actual
              </button>
              <button
                type="button"
                className="start-picker-link muted"
                onClick={() => setStartPickerOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: clock — Chrono Cockpit by default, or the employee's chosen style */}
      <div className="checkin-right">
        {clockStyle === "orbital" ? (
          <CheckInOrbital
            state={state}
            now={now}
            workedSec={liveWorkedSec}
            breakSec={liveBreakSec}
            shiftStart={shiftStart}
            shiftEnd={shiftEnd}
            breakMin={breakMin}
            today={
              today
                ? {
                    ...today,
                    breakStartLocal: deriveBreakStartLocal(
                      today.breakStartLocal,
                      today.breakEndLocal,
                      today.breakMinutes
                    ),
                  }
                : today
            }
          />
        ) : (
          <NovaClock
            variant={clockStyle}
            now={now}
            state={state}
            worked={liveWorkedSec}
            breakSec={liveBreakSec}
          />
        )}
      </div>
      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}

/* ============================================================
   QuickActions (original style)
   ============================================================ */

function QuickActions() {
  const items: { icon: React.ReactNode; label: string; href: string }[] = [
    { icon: Icons.plus, label: "Solicitar permiso", href: "/requests/new" },
    { icon: Icons.edit, label: "Regularizar", href: "/requests/new?type=regularize" },
    { icon: Icons.pulse, label: "Mi reporte", href: "/reports" },
    { icon: Icons.chat, label: "Chat supervisor", href: "/messages" },
    { icon: Icons.feed, label: "Feed", href: "/feed" },
    { icon: Icons.download, label: "Boleta", href: "/hr?tab=documentos" },
  ];
  return (
    <section className="quick-actions">
      {items.map((it, i) => (
        <Link key={i} href={it.href} className="quick-action">
          <span className="quick-icon">
            <IconSvg d={it.icon} size={16} />
          </span>
          <span>{it.label}</span>
          <IconSvg d={Icons.arrow} size={13} className="quick-arrow" />
        </Link>
      ))}
    </section>
  );
}

/* ============================================================
   ScheduleWidget — week bars (original)
   ============================================================ */

function ScheduleWidget({
  week,
  todayDate,
}: {
  week: { days?: { date: string; workedMinutes?: number; status?: string }[]; totalWorkedMinutes?: number; totalPlannedMinutes?: number } | undefined;
  todayDate: string;
}) {
  const days = week?.days ?? [];
  const max = 540;
  const total = week?.totalWorkedMinutes ?? 0;
  const goal = week?.totalPlannedMinutes ?? 0;
  const workableDays = days.filter((d) => {
    const dow = new Date(d.date + "T12:00:00").getDay();
    return dow !== 0 && dow !== 6 && d.status !== "HOLIDAY";
  }).length || 1;
  const avg = total / workableDays;

  const dayLetters = ["D", "L", "M", "M", "J", "V", "S"];

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Esta semana</div>
          <div className="panel-sub">Horas por día</div>
        </div>
        <Link href="/history" className="btn-ghost-link">
          Detalles <IconSvg d={Icons.arrow} size={13} />
        </Link>
      </div>
      <div className="week-bars">
        {days.length > 0 ? days.map((d, i) => {
          const date = new Date(d.date + "T12:00:00");
          const isToday = d.date === todayDate;
          const ratio = Math.min(1, (d.workedMinutes ?? 0) / max);
          return (
            <div key={i} className={`week-bar ${isToday ? "today" : ""}`}>
              <div className="week-bar-track">
                <div className="week-bar-fill" style={{ height: `${ratio * 100}%` }} />
              </div>
              <div className="week-bar-day">{dayLetters[date.getDay()]}</div>
              <div className="week-bar-date">{date.getDate()}</div>
            </div>
          );
        }) : Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="week-bar">
            <div className="week-bar-track">
              <div className="week-bar-fill" style={{ height: "0%" }} />
            </div>
            <div className="week-bar-day">-</div>
            <div className="week-bar-date">-</div>
          </div>
        ))}
      </div>
      <div className="week-sum">
        <div><span className="muted">Total</span> <strong>{fmtMinutes(total)}</strong></div>
        <div><span className="muted">Promedio</span> <strong>{fmtMinutes(Math.round(avg))}</strong></div>
        <div><span className="muted">Meta</span> <strong>{fmtMinutes(goal)}</strong></div>
      </div>
    </div>
  );
}

/* ============================================================
   VacationWidget (original)
   ============================================================ */

function useCounter(target: number, duration = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let id: number;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * target));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return n;
}

// 3-segment vacation donut (available / in-request / used), per the new design.
function VacationDonut({
  available,
  inRequest,
  used,
  total,
  center,
  unit,
}: {
  available: number;
  inRequest: number;
  used: number;
  total: number;
  center: number;
  unit: string;
}) {
  const r = 56;
  const C = 2 * Math.PI * r;
  const segs = [
    { v: available, c: "#10B981" },
    { v: inRequest, c: "#8B5CF6" },
    { v: used, c: "#F59E0B" },
  ];
  let acc = 0;
  const safeTotal = total > 0 ? total : 1;
  return (
    <div className="vac-donut">
      <svg viewBox="0 0 150 150" aria-hidden>
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth="14" />
        {segs.map((s, i) => {
          const len = (s.v / safeTotal) * C;
          const off = -(acc / safeTotal) * C;
          acc += s.v;
          const gap = len > 6 ? 3 : 0;
          return (
            <circle
              key={i}
              cx="75"
              cy="75"
              r={r}
              fill="none"
              stroke={s.c}
              strokeWidth="14"
              strokeLinecap="butt"
              strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`}
              strokeDashoffset={off}
              transform="rotate(-90 75 75)"
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          );
        })}
      </svg>
      <div className="vac-donut-center">
        <div className="vac-donut-num">{center}</div>
        <div className="vac-donut-unit">{unit}</div>
      </div>
    </div>
  );
}

function VacationWidget({
  available,
  inRequest,
  total,
}: {
  available: number;
  inRequest: number;
  total: number;
}) {
  const used = Math.max(0, total - available - inRequest);
  const n = useCounter(available, 900);
  const year = new Date().getFullYear();
  const legend = [
    { c: "#10B981", l: "Disponibles", v: available },
    { c: "#8B5CF6", l: "En solicitud", v: inRequest },
    { c: "#F59E0B", l: "Usadas", v: used },
  ];
  return (
    <div className="panel vac-panel">
      <div className="vac-head">
        <div>
          <div className="panel-sub">Saldo de vacaciones</div>
          <div className="vac-sub2">Periodo {year} · {total} días/año</div>
        </div>
        <PremiumIcon name="beach" size={30} tone="Gold" />
      </div>
      <div className="vac-body">
        <VacationDonut available={available} inRequest={inRequest} used={used} total={total} center={n} unit="días" />
      </div>
      <div className="vac-legend">
        {legend.map((it, i) => (
          <div key={i} className="vac-leg">
            <span className="vac-dot" style={{ background: it.c }} />
            <span className="vac-leg-l">{it.l}</span>
            <span className="vac-leg-v">{it.v}</span>
          </div>
        ))}
      </div>
      <div className="vac-accrual">
        <IconSvg d={Icons.history} size={13} />
        <span>+1.25 días/mes · renueva dic {year}</span>
      </div>
      <Link href="/requests/new?type=vacation" className="btn-secondary vac-cta" style={{ textDecoration: "none" }}>
        <IconSvg d={Icons.plus} size={13} /> Solicitar vacaciones
      </Link>
    </div>
  );
}

/* ============================================================
   HistoryWidget (original)
   ============================================================ */

interface HistoryRow { date: string; in: string; out: string; hours: string; status: "ok" | "short" | "open" | "missing"; }

function HistoryWidget({ rows }: { rows: HistoryRow[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Marcaciones recientes</div>
          <div className="panel-sub">Últimos 5 días</div>
        </div>
        <Link href="/requests/new?type=regularize" className="btn-ghost-link">
          <IconSvg d={Icons.edit} size={12} /> Regularizar
        </Link>
      </div>
      <div className="attend-list">
        {rows.length === 0 ? (
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 12px", textAlign: "center", color: "var(--text-muted)", gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <IconSvg d={Icons.history ?? Icons.clock} size={18} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Aún no tienes marcaciones</div>
            <div style={{ fontSize: 12 }}>Empieza tu jornada para verlas aquí.</div>
          </div>
        ) : (
          <>
            {rows.map((a, i) => (
              <div key={i} className="attend-row">
                <div style={{ width: 90 }}>
                  <div className="attend-date">{a.date}</div>
                </div>
                <div className="attend-times">
                  <span className="time-cell"><span className="muted">in</span> {a.in}</span>
                  <span className="time-sep">→</span>
                  <span className="time-cell"><span className="muted">out</span> {a.out}</span>
                </div>
                <div className="attend-hours">{a.hours}</div>
                <span className={`type-tag ${a.status === "short" ? "warn" : a.status === "open" ? "accent" : a.status === "missing" ? "muted" : "success"}`}>
                  {a.status === "short" ? "Corta" : a.status === "open" ? "En curso" : a.status === "missing" ? "—" : "OK"}
                </span>
              </div>
            ))}
            <Link href="/history" style={{ marginTop: "auto", paddingTop: 14, fontSize: 12, color: "var(--accent)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
              Ver historial completo <IconSvg d={Icons.arrow} size={12} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   RequestsWidget (original)
   ============================================================ */

interface RequestRow { type: string; when: string; days: string; status: "pending" | "approved" | "rejected"; }

function RequestsWidget({ rows }: { rows: RequestRow[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Mis solicitudes</div>
          <div className="panel-sub">{rows.length} en curso</div>
        </div>
        <Link href="/requests" className="btn-ghost-link">
          Ver todo <IconSvg d={Icons.arrow} size={13} />
        </Link>
      </div>
      <div className="requests-list">
        {rows.length === 0 ? (
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 12px", textAlign: "center", color: "var(--text-muted)", gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <IconSvg d={Icons.doc} size={18} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Sin solicitudes activas</div>
            <Link href="/requests/new" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>Crear una solicitud →</Link>
          </div>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="request-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="request-type">{r.type}</div>
                <div className="request-meta">{r.when} · {r.days}</div>
              </div>
              <span className={`type-tag ${r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warn"}`}>
                {r.status === "approved" ? "Aprobada" : r.status === "rejected" ? "Rechazada" : "Pendiente"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Tasks / Events / Notifications (original)
   ============================================================ */

interface TaskRow { title: string; meta: string; urgent?: boolean; }

const DEFAULT_TASKS: TaskRow[] = [
  { title: "Firmar nuevo reglamento interno", meta: "Vence en 2 días", urgent: true },
  { title: "Completar evaluación 360°", meta: "Hasta el 10 de Mayo" },
  { title: "Actualizar datos bancarios", meta: "Recordatorio de RRHH" },
];

function TasksWidget({ tasks }: { tasks: TaskRow[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Tareas pendientes</div>
          <div className="panel-sub">{tasks.length} abiertas</div>
        </div>
      </div>
      <div className="tasks-list">
        {tasks.map((t, i) => (
          <label key={i} className="task-row">
            <input type="checkbox" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="task-title">{t.title}</div>
              <div className="task-meta">{t.meta}</div>
            </div>
            {t.urgent && <span className="type-tag danger">!</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

interface EventRow { icon: React.ReactNode; title: string; meta: string; accent: "accent" | "warn" | "success"; }

function EventsWidget({ rows }: { rows: EventRow[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Próximamente</div>
          <div className="panel-sub">Eventos y feriados</div>
        </div>
      </div>
      <div className="events-list">
        {rows.length === 0 ? (
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 12px", textAlign: "center", color: "var(--text-muted)", gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <IconSvg d={Icons.calendar} size={18} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Sin eventos próximos</div>
            <div style={{ fontSize: 12 }}>Cumpleaños y feriados aparecerán aquí.</div>
          </div>
        ) : (
          rows.map((e, i) => (
            <div key={i} className="event-row">
              <div className={`event-icon ${e.accent}`}>
                <IconSvg d={e.icon} size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="event-title">{e.title}</div>
                <div className="event-meta">{e.meta}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface NotifRow { who: string; txt: string; t: string; icon: React.ReactNode; color: "success" | "accent" | "warn" | "danger"; }

function NotificationsWidget({ rows }: { rows: NotifRow[] }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Notificaciones</div>
          <div className="panel-sub">De tu equipo</div>
        </div>
      </div>
      <div className="activity-list">
        {rows.length === 0 ? (
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 12px", textAlign: "center", color: "var(--text-muted)", gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <IconSvg d={Icons.bell} size={18} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Todo al día</div>
            <div style={{ fontSize: 12 }}>No tienes notificaciones nuevas.</div>
          </div>
        ) : (
          rows.map((n, i) => (
            <div key={i} className="activity-row">
              <div className={`activity-icon ${n.color}`}>
                <IconSvg d={n.icon} size={13} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="activity-text"><strong>{n.who}</strong> {n.txt}</div>
              </div>
              <div className="activity-time">{n.t}</div>
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

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const tz = useTenantTimezone();
  const user = session?.user;

  const { data: profile } = useMyProfile();
  const { data: today, isLoading: todayLoading } = useTodayStatus();
  const { data: week } = useWeekSummary(0);
  const { data: tenant, isLoading: tenantLoading } = useTenantConfig();
  const recordEvent = useRecordEvent();
  const [pendingAction, setPendingAction] = useState<EventType | null>(null);

  const todayDate = todayInTz(tz);
  const monthStr = todayDate.substring(0, 7);
  const { data: hrData } = useHREvents(monthStr);
  const { data: requestsData } = useMyRequests();

  const now = useNow(1000);

  useEffect(() => {
    if (profile?.employee?.dni?.startsWith("PENDING")) {
      router.push("/onboarding");
    }
  }, [profile, router]);

  const state: CheckinState = useMemo(() => deriveState(today, now), [today, now]);
  const firstName = user?.name?.split(" ")[0] ?? profile?.employee?.firstName ?? "Usuario";

  const liveWorkedSec = useMemo(() => {
    if (today?.hasOpenShift && today?.firstInLocal) {
      const [h, m, s] = today.firstInLocal.split(":").map(Number);
      const startMin = h * 60 + m + (s || 0) / 60;
      const tp = timePartsInTz(tz);
      const nowMin = tp.hours * 60 + tp.minutes + tp.seconds / 60;
      // An open break isn't in breakMinutes yet (that's only written on
      // BREAK_END), so subtract the in-progress break too — otherwise the worked
      // timer keeps climbing while the employee is on break.
      let openBreakMin = 0;
      if (today.hasOpenBreak && today.breakStartLocal) {
        const [bh, bm, bs] = today.breakStartLocal.split(":").map(Number);
        openBreakMin = Math.max(0, nowMin - (bh * 60 + bm + (bs || 0) / 60));
      }
      const workedMin = Math.max(0, nowMin - startMin - (today.breakMinutes || 0) - openBreakMin);
      return Math.floor(workedMin * 60);
    }
    return Math.floor((today?.workedMinutes ?? 0) * 60);
  }, [today, now, tz]);

  const liveBreakSec = useMemo(() => {
    if (today?.hasOpenBreak && today?.breakStartLocal) {
      const [h, m, s] = today.breakStartLocal.split(":").map(Number);
      const startMin = h * 60 + m + (s || 0) / 60;
      const tp = timePartsInTz(tz);
      const nowMin = tp.hours * 60 + tp.minutes + tp.seconds / 60;
      return Math.floor((nowMin - startMin) * 60);
    }
    return (today?.breakMinutes ?? 0) * 60;
  }, [today, now, tz]);

  const shiftStart = profile?.employee?.schedule?.startTime ?? "09:00";
  const shiftEnd = profile?.employee?.schedule?.endTime ?? "18:00";
  const breakMin = profile?.employee?.schedule?.breakMinutes ?? 60;
  const allowCustomStart = tenant?.settings?.workSchedule?.allowCustomStartTime ?? false;

  // ── New stats for the hero ──
  const weekDaysData = week?.days ?? [];
  const weekTotalMin = week?.totalWorkedMinutes ?? 0;
  const workableDays = weekDaysData.filter((d) => {
    const dow = new Date(d.date + "T12:00:00").getDay();
    return dow !== 0 && dow !== 6 && d.status !== "HOLIDAY";
  }).length || 1;
  const weekAvgMin = Math.round(weekTotalMin / workableDays);
  const weekBestMin = weekDaysData.reduce((max, d) => Math.max(max, d.workedMinutes ?? 0), 0);
  const weekBestDayLabel = useMemo(() => {
    const best = [...weekDaysData].sort((a, b) => (b.workedMinutes ?? 0) - (a.workedMinutes ?? 0))[0];
    if (!best || (best.workedMinutes ?? 0) === 0) return "—";
    const dayLetters = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
    const date = new Date(best.date + "T12:00:00");
    return `${dayLetters[date.getDay()]} ${date.getDate()}`;
  }, [weekDaysData]);
  const weekSparkline = useMemo(() => {
    const arr = weekDaysData.map((d) => d.workedMinutes ?? 0);
    while (arr.length < 7) arr.push(0);
    return arr;
  }, [weekDaysData]);
  const weekGoalMin = week?.totalPlannedMinutes ?? 2400;

  // ── Site / location (from profile, falls back to tenant first site, then generic) ──
  const employeeLocation = profile?.employee?.location;
  const tenantSites = (tenant?.settings as { sites?: { name?: string; address?: string; radius?: number }[] } | undefined)?.sites;
  const fallbackSite = tenantSites?.[0];
  const siteName =
    employeeLocation?.formattedAddress?.split(",")[0]?.trim() ||
    fallbackSite?.name ||
    tenant?.tenantName ||
    "Sede principal";
  const siteAddress =
    employeeLocation?.address ||
    fallbackSite?.address ||
    "Dirección no configurada";
  const siteRadius =
    (employeeLocation as { radius?: number } | undefined)?.radius ??
    fallbackSite?.radius ??
    50;

  // Streak: count consecutive days from most recent with workedMinutes > 0
  const streakDays = useMemo(() => {
    const days = [...(week?.days ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    let count = 0;
    for (const d of days) {
      const dow = new Date(d.date + "T12:00:00").getDay();
      if (dow === 0 || dow === 6) continue;
      if ((d.workedMinutes ?? 0) > 0 || d.date === todayDate) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [week, todayDate]);

  const todayHistory = useMemo(() => {
    const hist: { time: string; label: string; loc: string; kind: string }[] = [];
    const breakStart = deriveBreakStartLocal(today?.breakStartLocal, today?.breakEndLocal, today?.breakMinutes);
    if (today?.firstInLocal) hist.push({ time: fmtClock(today.firstInLocal), label: "Entrada", loc: siteName, kind: "in" });
    if (breakStart) hist.push({ time: fmtClock(breakStart), label: "Inicio break", loc: "Almuerzo", kind: "break-start" });
    if (today?.breakEndLocal) hist.push({ time: fmtClock(today.breakEndLocal), label: "Fin break", loc: "Reanudó jornada", kind: "break-end" });
    if (today?.lastOutLocal) hist.push({ time: fmtClock(today.lastOutLocal), label: "Salida", loc: siteName, kind: "out" });
    return hist;
  }, [today, siteName]);

  async function handleAction(eventType: EventType, customTime?: string) {
    setPendingAction(eventType);
    try {
      const result = await recordEvent.mutateAsync({ eventType, customTime });
      toast.success(result.message ?? "¡Registro exitoso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar");
    } finally {
      setPendingAction(null);
    }
  }

  const historyRows: HistoryRow[] = useMemo(() => {
    const days = week?.days ?? [];
    return days
      .filter((d) => d.firstInLocal || d.lastOutLocal)
      .slice(-5)
      .reverse()
      .map((d) => {
        const date = new Date(d.date + "T12:00:00");
        const dayName = date.toLocaleDateString("es-PE", { weekday: "short" });
        const dayNum = date.getDate();
        const monthName = date.toLocaleDateString("es-PE", { month: "short" });
        const isToday = d.date === todayDate;
        const dateLabel = isToday ? "Hoy" : `${dayName.charAt(0).toUpperCase()}${dayName.slice(1, 3)} ${String(dayNum).padStart(2, "0")} ${monthName}`;
        const hh = Math.floor((d.workedMinutes ?? 0) / 60);
        const mm = (d.workedMinutes ?? 0) % 60;
        const hasOut = !!d.lastOutLocal;
        const worked = d.workedMinutes ?? 0;
        let status: HistoryRow["status"];
        if (!hasOut) status = "open";
        else if (worked < 480) status = "short";
        else status = "ok";
        return {
          date: dateLabel,
          in: d.firstInLocal?.substring(0, 5) ?? "--:--",
          out: d.lastOutLocal?.substring(0, 5) ?? "--:--",
          hours: hasOut ? `${hh}h ${String(mm).padStart(2, "0")}m` : "—",
          status,
        };
      });
  }, [week, todayDate]);

  // Days currently tied up in pending vacation requests (for the donut's purple segment).
  const vacationInRequest = useMemo(() => {
    const reqs = requestsData?.requests ?? [];
    return reqs
      .filter((r) => r.requestType === "VACATION" && r.status === "PENDING")
      .reduce((sum, r) => {
        if (r.dateFrom && r.dateTo) {
          const d = Math.round((new Date(r.dateTo).getTime() - new Date(r.dateFrom).getTime()) / 86400000) + 1;
          return sum + Math.max(1, d);
        }
        return sum + 1;
      }, 0);
  }, [requestsData]);

  const requestRows: RequestRow[] = useMemo(() => {
    const requests = requestsData?.requests ?? [];
    return requests.slice(0, 4).map((r) => ({
      type: r.requestType === "VACATION" ? "Vacaciones" : r.requestType === "PERMISSION" ? "Permiso" : "Regularización",
      when: r.dateFrom && r.dateTo ? (r.dateFrom === r.dateTo ? r.dateFrom : `${r.dateFrom} – ${r.dateTo}`) : r.effectiveDate ?? "—",
      days: r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : "—",
      status: r.status === "APPROVED" ? "approved" : r.status === "REJECTED" ? "rejected" : "pending",
    }));
  }, [requestsData]);

  const eventRows: EventRow[] = useMemo(() => {
    const events: EventRow[] = [];
    const birthdays: BirthdayEntry[] = hrData?.birthdays ?? [];
    const anniversaries: AnniversaryEntry[] = hrData?.anniversaries ?? [];
    const announcements: HREvent[] = hrData?.announcements ?? [];

    const dayStr = todayDate.substring(5);
    birthdays.filter((b) => b.eventDate.substring(5) === dayStr).slice(0, 2).forEach((b) =>
      events.push({ icon: Icons.cake, title: `🎂 ${b.employeeName}`, meta: "Cumple hoy", accent: "accent" })
    );
    anniversaries.filter((a) => a.eventDate.substring(5) === dayStr).slice(0, 1).forEach((a) =>
      events.push({ icon: Icons.party, title: a.employeeName, meta: `${a.years} años en la empresa`, accent: "accent" })
    );
    const holidays = tenant?.settings?.holidays ?? [];
    const todayMs = new Date(todayDate + "T12:00:00").getTime();
    holidays
      .map((h) => ({ ...h, days: Math.floor((new Date(h.date + "T12:00:00").getTime() - todayMs) / 86400000) }))
      .filter((h) => h.days >= 0 && h.days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 2)
      .forEach((h) =>
        events.push({
          icon: Icons.beach,
          title: `Feriado: ${h.name}`,
          meta: h.days === 0 ? "Hoy" : h.days === 1 ? "Mañana" : `En ${h.days} días`,
          accent: "warn",
        })
      );
    announcements.slice(0, 1).forEach((a) =>
      events.push({ icon: Icons.party, title: a.Title ?? "Anuncio", meta: a.Message?.substring(0, 40) ?? "", accent: "accent" })
    );
    return events.slice(0, 4);
  }, [hrData, tenant, todayDate]);

  const notifRows: NotifRow[] = useMemo(() => {
    const approved = (requestsData?.requests ?? []).find((r) => r.status === "APPROVED");
    const rows: NotifRow[] = [];
    if (approved) {
      rows.push({ who: "RRHH", txt: "aprobó tu solicitud", t: "", icon: Icons.check, color: "success" });
    }
    return rows;
  }, [requestsData]);

  return (
    <>
      {/* Forgot-to-clock-out reminder — looks at this week's days and shows
          a banner for the most recent day with status=OPEN. Self-fix via
          the existing /api/employee/regularize endpoint. */}
      <OpenShiftBanner days={week?.days ?? []} />

      <CheckInHero
        firstName={firstName}
        state={state}
        now={now}
        today={today}
        isLoading={todayLoading}
        liveWorkedSec={liveWorkedSec}
        liveBreakSec={liveBreakSec}
        shiftStart={shiftStart}
        shiftEnd={shiftEnd}
        breakMin={breakMin}
        todayHistory={todayHistory}
        onAction={handleAction}
        pendingAction={pendingAction}
        allowCustomStart={allowCustomStart}
        tenantConfigLoading={tenantLoading}
        weekTotalMin={weekTotalMin}
        weekAvgMin={weekAvgMin}
        weekBestMin={weekBestMin}
        weekBestDayLabel={weekBestDayLabel}
        weekSparkline={weekSparkline}
        weekGoalMin={weekGoalMin}
        streakDays={streakDays}
        siteName={siteName}
        siteAddress={siteAddress}
        siteRadius={siteRadius}
      />

      <QuickActions />

      <section className="row two-thirds">
        <ScheduleWidget week={week} todayDate={todayDate} />
        <VacationWidget
          available={profile?.employee?.vacationBalance ?? 0}
          inRequest={vacationInRequest}
          total={20}
        />
      </section>

      <section className="row two-thirds">
        <HistoryWidget rows={historyRows} />
        <RequestsWidget rows={requestRows} />
      </section>

      <section className="row thirds">
        <TasksWidget tasks={DEFAULT_TASKS} />
        <EventsWidget rows={eventRows} />
        <NotificationsWidget rows={notifRows} />
      </section>

      <footer className="footer">
        <span>Novaassistance · {tenant?.tenantName ?? "Workspace"}</span>
        <span>Tu día, en órbita</span>
      </footer>
    </>
  );
}
