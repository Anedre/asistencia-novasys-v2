"use client";

/**
 * CheckInCockpit — the "Chrono Cockpit" 24h clock from the Orbital design.
 * Visual companion to ClockWidget actions, focused on giving the employee
 * a glanceable view of their day:
 *   - 24h outer ring (showing now's position)
 *   - Highlighted workday band (start–end) that fills as time progresses
 *   - Markers for IN / BREAK / OUT plotted at their real 24h angles
 *   - Center readout: hour + worked time + % + remaining
 *
 * Reads the same data hooks as ClockWidget so it stays in sync.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTodayStatus } from "@/hooks/use-attendance";
import { useTenantTimezone, timePartsInTz } from "@/hooks/use-timezone";

interface CheckInCockpitProps {
  className?: string;
  /** Defaults to 9:00 if not provided by today.plannedShift */
  shiftStart?: string;
  /** Defaults to 18:00 */
  shiftEnd?: string;
}

function timeToAngle(h: number, m = 0): number {
  // 24h dial: 0h at top (-90°), clockwise
  const totalMinutes = h * 60 + m;
  return (totalMinutes / 1440) * 360 - 90;
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, fromAngle: number, toAngle: number): string {
  const start = polarPoint(cx, cy, r, fromAngle);
  const end = polarPoint(cx, cy, r, toAngle);
  const largeArc = toAngle - fromAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function parseHM(s: string | null | undefined): { h: number; m: number } | null {
  if (!s) return null;
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return { h: parts[0], m: parts[1] };
}

export function CheckInCockpit({
  className,
  shiftStart = "09:00",
  shiftEnd = "18:00",
}: CheckInCockpitProps) {
  const tz = useTenantTimezone();
  const { data: today } = useTodayStatus();
  const [tick, setTick] = useState(0);

  // Live ticking
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const tp = timePartsInTz(tz);
  const nowH = tp.hours;
  const nowM = tp.minutes;
  const nowS = tp.seconds;
  const nowAngle = timeToAngle(nowH, nowM + nowS / 60);

  const startHm = parseHM(shiftStart) ?? { h: 9, m: 0 };
  const endHm = parseHM(shiftEnd) ?? { h: 18, m: 0 };
  const startAngle = timeToAngle(startHm.h, startHm.m);
  const endAngle = timeToAngle(endHm.h, endHm.m);

  const inHm = parseHM(today?.firstInLocal ?? null);
  const outHm = parseHM(today?.lastOutLocal ?? null);

  // Live worked
  const liveWorked = (() => {
    if (today?.hasOpenShift && today?.firstInLocal) {
      const inMs = inHm ? inHm.h * 60 + inHm.m : 0;
      const nowMs = nowH * 60 + nowM + nowS / 60;
      return Math.max(0, Math.floor(nowMs - inMs) - (today.breakMinutes || 0));
    }
    return today?.workedMinutes ?? 0;
  })();

  const plannedDay = today?.plannedMinutes ?? 480;
  const workPct = Math.min(100, Math.round((liveWorked / plannedDay) * 100));
  const breakMin = today?.breakMinutes ?? 0;
  const remainingMin = Math.max(0, plannedDay - liveWorked);

  // Cockpit dimensions
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 145;
  const workBandR = 130;
  const innerR = 102;

  // Workday filled fraction (within shift band)
  const shiftDuration = (endHm.h * 60 + endHm.m) - (startHm.h * 60 + startHm.m);
  const fromShiftStart = (nowH * 60 + nowM) - (startHm.h * 60 + startHm.m);
  const shiftProgress = Math.max(0, Math.min(1, fromShiftStart / shiftDuration));
  const filledEndAngle = startAngle + (endAngle - startAngle) * shiftProgress;

  // Hand angles (12h overlay clock at center)
  const hourAngle = ((nowH % 12) + nowM / 60) * 30 - 90;
  const minAngle = (nowM + nowS / 60) * 6 - 90;
  const secAngle = nowS * 6 - 90;

  // Tick marks
  const ticks = Array.from({ length: 24 }, (_, i) => i);

  // Markers
  const markers: { hm: { h: number; m: number }; label: string; color: string }[] = [];
  if (inHm) markers.push({ hm: inHm, label: "IN", color: "var(--success)" });
  if (today?.breakMinutes && today.firstInLocal) {
    // We don't have explicit break start/end timestamps here, just total minutes.
    // Skip per-marker break dots; the inner sub-dial shows break minutes instead.
  }
  if (outHm) markers.push({ hm: outHm, label: "OUT", color: "var(--nova-cyan)" });

  // Format helpers
  const hh = String(Math.floor(liveWorked / 60)).padStart(2, "0");
  const mm = String(liveWorked % 60).padStart(2, "0");
  const remH = String(Math.floor(remainingMin / 60)).padStart(2, "0");
  const remM = String(remainingMin % 60).padStart(2, "0");
  const liveTimeStr = `${String(nowH).padStart(2, "0")}:${String(nowM).padStart(2, "0")}:${String(nowS).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] p-6 md:p-7 text-white",
        "bg-[radial-gradient(ellipse_at_top,#142440_0%,#0A1628_60%,#04081C_100%)]",
        "border border-[rgba(63,190,255,0.18)]",
        className
      )}
    >
      {/* faint orbital backdrop */}
      <svg
        aria-hidden
        viewBox="0 0 400 400"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18]"
      >
        <circle cx="200" cy="200" r="180" stroke="#3FBEFF" strokeWidth="0.4" strokeDasharray="2 3" />
        <circle cx="200" cy="200" r="120" stroke="#3FBEFF" strokeWidth="0.3" />
      </svg>

      <div className="relative flex flex-col items-center gap-5 md:flex-row md:items-center md:gap-7">
        {/* Cockpit clock */}
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="shrink-0"
          style={{ filter: "drop-shadow(0 8px 24px rgba(63, 190, 255, 0.15))" }}
        >
          {/* outer 24h ring */}
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />

          {/* 24h tick marks */}
          {ticks.map((h) => {
            const a = timeToAngle(h);
            const p1 = polarPoint(cx, cy, outerR, a);
            const p2 = polarPoint(cx, cy, outerR - (h % 6 === 0 ? 12 : 7), a);
            const isMajor = h % 6 === 0;
            return (
              <line
                key={h}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={isMajor ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)"}
                strokeWidth={isMajor ? "1.5" : "1"}
              />
            );
          })}

          {/* 6h labels */}
          {[0, 6, 12, 18].map((h) => {
            const p = polarPoint(cx, cy, outerR - 22, timeToAngle(h));
            return (
              <text
                key={h}
                x={p.x}
                y={p.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fontFamily="var(--font-mono)"
                fill="rgba(255,255,255,0.55)"
                fontWeight="600"
              >
                {String(h).padStart(2, "0")}
              </text>
            );
          })}

          {/* workday band (faint) */}
          <path
            d={arcPath(cx, cy, workBandR, startAngle, endAngle)}
            stroke="rgba(63, 190, 255, 0.18)"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          {/* workday filled */}
          {shiftProgress > 0 && (
            <path
              d={arcPath(cx, cy, workBandR, startAngle, filledEndAngle)}
              stroke="var(--nova-cyan)"
              strokeWidth="6"
              strokeLinecap="round"
              fill="none"
              style={{ filter: "drop-shadow(0 0 8px rgba(63,190,255,0.5))" }}
            />
          )}

          {/* now indicator */}
          {(() => {
            const tip = polarPoint(cx, cy, workBandR + 12, nowAngle);
            const base1 = polarPoint(cx, cy, workBandR + 3, nowAngle - 1.8);
            const base2 = polarPoint(cx, cy, workBandR + 3, nowAngle + 1.8);
            return (
              <polygon
                points={`${tip.x},${tip.y} ${base1.x},${base1.y} ${base2.x},${base2.y}`}
                fill="#fff"
                style={{ filter: "drop-shadow(0 0 4px #fff)" }}
              />
            );
          })()}

          {/* IN / OUT markers */}
          {markers.map((m, i) => {
            const a = timeToAngle(m.hm.h, m.hm.m);
            const p = polarPoint(cx, cy, workBandR, a);
            return (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="5"
                  fill={m.color}
                  stroke="#0A1628"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {/* inner face circle */}
          <circle
            cx={cx}
            cy={cy}
            r={innerR}
            fill="rgba(10, 22, 40, 0.7)"
            stroke="rgba(63, 190, 255, 0.18)"
            strokeWidth="1"
          />

          {/* hour ticks on inner face */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = i * 30 - 90;
            const p1 = polarPoint(cx, cy, innerR - 4, a);
            const p2 = polarPoint(cx, cy, innerR - 10, a);
            return (
              <line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
              />
            );
          })}

          {/* clock hands (12h overlay) */}
          {/* hour */}
          {(() => {
            const tip = polarPoint(cx, cy, 56, hourAngle);
            return (
              <line
                x1={cx}
                y1={cy}
                x2={tip.x}
                y2={tip.y}
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.95"
              />
            );
          })()}
          {/* minute */}
          {(() => {
            const tip = polarPoint(cx, cy, 80, minAngle);
            return (
              <line
                x1={cx}
                y1={cy}
                x2={tip.x}
                y2={tip.y}
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.85"
              />
            );
          })()}
          {/* second */}
          {(() => {
            const tip = polarPoint(cx, cy, 90, secAngle);
            return (
              <line
                x1={cx}
                y1={cy}
                x2={tip.x}
                y2={tip.y}
                stroke="var(--nova-cyan)"
                strokeWidth="1.2"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 3px var(--nova-cyan))" }}
              />
            );
          })()}

          {/* center cap */}
          <circle cx={cx} cy={cy} r="4" fill="var(--nova-cyan)" />
          <circle cx={cx} cy={cy} r="2" fill="#0A1628" />
        </svg>

        {/* Readout panel */}
        <div className="flex-1 w-full">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">
            Chrono cockpit · {tz}
          </div>

          <div className="mt-1 flex items-baseline gap-2 font-mono">
            <span className="text-[44px] md:text-[56px] font-bold tracking-tight tabular-nums leading-none text-white">
              {liveTimeStr}
            </span>
            <span className="text-[var(--nova-cyan)] text-[12px] uppercase tracking-wider font-semibold">
              now
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 max-w-md">
            <ReadoutMetric
              label="Trabajado"
              value={`${hh}:${mm}`}
              hint={`de ${String(Math.floor(plannedDay / 60)).padStart(2, "0")}:${String(plannedDay % 60).padStart(2, "0")}`}
              accent
            />
            <ReadoutMetric
              label="Progreso"
              value={`${workPct}%`}
              hint={today?.hasOpenShift ? "en jornada" : "estática"}
            />
            <ReadoutMetric
              label="Break"
              value={`${String(Math.floor(breakMin / 60)).padStart(2, "0")}:${String(breakMin % 60).padStart(2, "0")}`}
              hint="consumido"
            />
            <ReadoutMetric
              label="Restante"
              value={`${remH}:${remM}`}
              hint="hasta cierre"
            />
          </div>

          {/* Marker legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-mono uppercase tracking-wider text-white/55">
            {inHm && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                IN {String(inHm.h).padStart(2, "0")}:{String(inHm.m).padStart(2, "0")}
              </span>
            )}
            {outHm && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--nova-cyan)]" />
                OUT {String(outHm.h).padStart(2, "0")}:{String(outHm.m).padStart(2, "0")}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-white/70" />
              SHIFT {shiftStart}–{shiftEnd}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReadoutMetric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-white/8 bg-white/4 px-3 py-2.5",
        accent && "border-[rgba(63,190,255,0.25)] bg-[rgba(63,190,255,0.08)]"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-white/45 font-mono">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[20px] tabular-nums font-semibold leading-none",
          accent ? "text-[var(--nova-cyan)]" : "text-white"
        )}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[10px] text-white/40 font-mono">{hint}</div>
      )}
    </div>
  );
}
