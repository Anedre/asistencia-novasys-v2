"use client";

/**
 * CheckInOrbital — matches the original employee.jsx "Chrono Cockpit"
 * exactly. 24h shift band + progress + 12h face + sub-dials + marcaciones
 * + live hour/minute/second hands. Always dark luxurious face.
 */

interface Props {
  state: "before" | "working" | "break" | "completed" | "offhours" | "vacation" | "holiday";
  now: Date;
  workedSec: number;
  breakSec: number;
  shiftStart: string;
  shiftEnd: string;
  today?: {
    firstInLocal?: string | null;
    breakStartLocal?: string | null;
    breakEndLocal?: string | null;
    lastOutLocal?: string | null;
  };
}

const ACCENT_BY_STATE: Record<Props["state"], string> = {
  before: "#7a8aa8",
  working: "#10B981",
  break: "#F59E0B",
  completed: "#3FBEFF",
  offhours: "#7a8aa8",
  vacation: "#3FBEFF",
  holiday: "#F59E0B",
};

function parseHM(s: string | null | undefined): number | null {
  if (!s) return null;
  const [h, m] = s.split(":").map((p) => parseInt(p, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h + m / 60;
}

const cx = 200;
const cy = 200;
const R = 165;

function angle24(h: number): number {
  return (h / 24) * 360;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function CockpitMark({
  hour24,
  r,
  color,
  label,
}: {
  hour24: number;
  r: number;
  color: string;
  label: string;
}) {
  const a = (hour24 / 24) * 360;
  const x = cx + r * Math.sin((a * Math.PI) / 180);
  const y = cy - r * Math.cos((a * Math.PI) / 180);
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill={color} opacity="0.2" />
      <circle cx={x} cy={y} r="3" fill={color} />
      <text
        x={x}
        y={y - 10}
        textAnchor="middle"
        fill={color}
        fontSize="8"
        fontFamily="'Geist Mono', monospace"
        fontWeight={700}
      >
        {label}
      </text>
    </g>
  );
}

function SubDial({
  x,
  y,
  value,
  color,
  label,
}: {
  x: number;
  y: number;
  value: number;
  color: string;
  label: string;
}) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <g>
      <circle cx={x} cy={y} r={r + 3} fill="#040814" stroke="#1a2944" />
      <circle cx={x} cy={y} r={r} fill="none" stroke="#1a2944" strokeWidth="3" />
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${(Math.min(value, 100) / 100) * c} ${c}`}
        transform={`rotate(-90 ${x} ${y})`}
        style={{ transition: "stroke-dasharray 0.6s", filter: `drop-shadow(0 0 3px ${color})` }}
      />
      <text
        x={x}
        y={y - 2}
        textAnchor="middle"
        fill="#7a8aa8"
        fontSize="6"
        letterSpacing="1.5"
        fontFamily="'Geist Mono', monospace"
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 9}
        textAnchor="middle"
        fill="#fff"
        fontSize="10"
        fontFamily="'Geist Mono', monospace"
        fontWeight={600}
      >
        {Math.round(value)}%
      </text>
    </g>
  );
}

export function CheckInOrbital({
  state,
  now,
  workedSec,
  breakSec,
  shiftStart,
  shiftEnd,
  today,
}: Props) {
  const accent = ACCENT_BY_STATE[state];

  const startH = parseHM(shiftStart) ?? 9;
  const endH = parseHM(shiftEnd) ?? 18;

  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hoursOfDay = now.getHours() + minutes / 60 + seconds / 3600;
  const hours12 = (now.getHours() % 12) + minutes / 60;

  const totalShiftSec = (endH - startH) * 3600;
  const workPct = totalShiftSec > 0 ? Math.round((Math.min(workedSec, totalShiftSec) / totalShiftSec) * 100) : 0;

  const shiftStartAngle = angle24(startH);
  const shiftEndAngle = angle24(endH);
  const progressEndAngle =
    shiftStartAngle + (Math.min(workedSec, totalShiftSec) / totalShiftSec) * (shiftEndAngle - shiftStartAngle);

  const inH = parseHM(today?.firstInLocal ?? null);
  const brStartH = parseHM(today?.breakStartLocal ?? null);
  const brEndH = parseHM(today?.breakEndLocal ?? null);

  return (
    <div className="cockpit-clock-wrap">
      <svg
        viewBox="0 0 400 400"
        width="520"
        height="520"
        className={`cockpit-svg state-${state}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <radialGradient id="cc_face" cx="0.5" cy="0.5" r="0.6">
            <stop offset="0%" stopColor="#0F1A33" />
            <stop offset="100%" stopColor="#02060F" />
          </radialGradient>
          <linearGradient id="cc_arc" x1="0" x2="1">
            <stop offset="0%" stopColor="#3FBEFF" />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
          <radialGradient id="cc_glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* outer face */}
        <circle cx={cx} cy={cy} r="190" fill="url(#cc_face)" stroke="#1a2944" strokeWidth="1" />

        {/* 24h shift band */}
        <circle cx={cx} cy={cy} r={R + 15} fill="none" stroke="#0d1a32" strokeWidth="14" />
        <path
          d={arcPath(cx, cy, R + 15, shiftStartAngle, shiftEndAngle)}
          fill="none"
          stroke="#1a3550"
          strokeWidth="14"
        />
        {state !== "before" && workedSec > 0 && (
          <path
            d={arcPath(cx, cy, R + 15, shiftStartAngle, progressEndAngle)}
            fill="none"
            stroke="url(#cc_arc)"
            strokeWidth="14"
            strokeLinecap="butt"
            style={{ filter: `drop-shadow(0 0 10px ${accent})`, transition: "all 0.6s" }}
          />
        )}

        {/* 24h tick marks + labels */}
        {Array.from({ length: 24 }).map((_, h) => {
          const a = angle24(h);
          const inner = R;
          const outer = R + 8;
          const isMain = h % 6 === 0;
          const isShift = h === Math.floor(startH) || h === Math.floor(endH);
          return (
            <g key={h}>
              <line
                x1={cx + inner * Math.sin((a * Math.PI) / 180)}
                y1={cy - inner * Math.cos((a * Math.PI) / 180)}
                x2={cx + outer * Math.sin((a * Math.PI) / 180)}
                y2={cy - outer * Math.cos((a * Math.PI) / 180)}
                stroke={isShift ? "#3FBEFF" : isMain ? "#7a8aa8" : "#3a4a6a"}
                strokeWidth={isShift ? 2 : isMain ? 1.5 : 0.8}
              />
              {isMain && (
                <text
                  x={cx + (R - 15) * Math.sin((a * Math.PI) / 180)}
                  y={cy - (R - 15) * Math.cos((a * Math.PI) / 180) + 4}
                  textAnchor="middle"
                  fill="#7a8aa8"
                  fontSize="11"
                  fontFamily="'Geist Mono', monospace"
                >
                  {String(h).padStart(2, "0")}
                </text>
              )}
            </g>
          );
        })}

        {/* 15-min ticks */}
        {Array.from({ length: 96 }).map((_, i) => {
          if (i % 4 === 0) return null;
          const a = (i / 96) * 360;
          return (
            <line
              key={i}
              x1={cx + (R + 2) * Math.sin((a * Math.PI) / 180)}
              y1={cy - (R + 2) * Math.cos((a * Math.PI) / 180)}
              x2={cx + (R + 5) * Math.sin((a * Math.PI) / 180)}
              y2={cy - (R + 5) * Math.cos((a * Math.PI) / 180)}
              stroke="#2a3a5a"
              strokeWidth="0.5"
            />
          );
        })}

        {/* now indicator on 24h ring */}
        <g
          style={{
            transition: "transform 0.5s",
            transform: `rotate(${angle24(hoursOfDay)}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
          }}
        >
          <line x1={cx} y1={cy - R - 22} x2={cx} y2={cy - R - 8} stroke={accent} strokeWidth="2" />
          <polygon
            points={`${cx - 4},${cy - R - 8} ${cx + 4},${cy - R - 8} ${cx},${cy - R - 2}`}
            fill={accent}
          />
        </g>

        {/* center glow */}
        <circle cx={cx} cy={cy} r="120" fill="url(#cc_glow)" className="orb-glow" />

        {/* live pulse rings */}
        {(state === "working" || state === "break") && (
          <>
            <circle cx={cx} cy={cy} r="60" stroke={accent} strokeWidth="1.5" fill="none" className="orb-pulse" />
            <circle
              cx={cx}
              cy={cy}
              r="60"
              stroke={accent}
              strokeWidth="1.5"
              fill="none"
              className="orb-pulse"
              style={{ animationDelay: "1.4s" }}
            />
          </>
        )}

        {/* inner 12h face */}
        <circle cx={cx} cy={cy} r="110" fill="#040814" stroke="#1a2944" strokeWidth="1" />

        {/* 60 min ticks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = i * 6;
          const isMain = i % 5 === 0;
          const inner = isMain ? 95 : 102;
          const outer = 106;
          return (
            <line
              key={i}
              x1={cx + inner * Math.sin((a * Math.PI) / 180)}
              y1={cy - inner * Math.cos((a * Math.PI) / 180)}
              x2={cx + outer * Math.sin((a * Math.PI) / 180)}
              y2={cy - outer * Math.cos((a * Math.PI) / 180)}
              stroke={isMain ? "#7a8aa8" : "#3a4a6a"}
              strokeWidth={isMain ? 1.5 : 0.6}
            />
          );
        })}

        {/* Marcaciones del día */}
        {inH != null && <CockpitMark hour24={inH} r={94} color="#10B981" label="IN" />}
        {brStartH != null && <CockpitMark hour24={brStartH} r={94} color="#F59E0B" label="BR" />}
        {brEndH != null && <CockpitMark hour24={brEndH} r={94} color="#10B981" label="↩" />}

        {/* Sub-dials */}
        <SubDial x={cx - 50} y={cy + 30} value={workPct} color="#10B981" label="WORK" />
        <SubDial x={cx + 50} y={cy + 30} value={(breakSec / 3600) * 100} color="#F59E0B" label="BRK" />

        {/* 12h hands */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transition: "transform 0.5s cubic-bezier(.4,2,.5,1)",
            transform: `rotate(${hours12 * 30}deg)`,
          }}
        >
          <rect x={cx - 2} y={cy - 65} width="4" height="55" rx="1" fill="#fff" />
        </g>
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transition: "transform 0.5s cubic-bezier(.4,2,.5,1)",
            transform: `rotate(${minutes * 6}deg)`,
          }}
        >
          <rect x={cx - 1.5} y={cy - 95} width="3" height="85" rx="1" fill="#fff" />
        </g>
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${seconds * 6}deg)`,
          }}
        >
          <line x1={cx} y1={cy + 12} x2={cx} y2={cy - 100} stroke={accent} strokeWidth="1" strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r="5" fill={accent} />
        <circle cx={cx} cy={cy} r="1.5" fill="#040814" />

        {/* label */}
        <text
          x={cx}
          y={cy - 130}
          textAnchor="middle"
          fill="#7a8aa8"
          fontSize="8"
          letterSpacing="3"
          fontFamily="'Geist Mono', monospace"
        >
          CHRONO · 24H
        </text>
      </svg>
    </div>
  );
}
