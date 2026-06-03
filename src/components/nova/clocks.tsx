"use client";

import { useEffect, useState } from "react";

/**
 * Novaassistance — selectable clock styles. Ported from the design bundle's
 * clocks.jsx. <NovaClock variant=… now=… state=… worked=… breakSec=… mini/>.
 * The employee picks one in their profile; the dashboard hero renders it.
 *
 * Note: the "orbital" hero clock is the full Chrono Cockpit
 * (check-in-cockpit-full); this module provides the compact orbital used in the
 * picker plus the five alternative styles.
 */

export type ClockVariant = "orbital" | "digital" | "flip" | "analog" | "ring" | "mono";

const CLOCK_KEY = "nova_clock";
const CLOCK_EVENT = "nova-clock-change";

/** Reads the employee's chosen clock style and live-updates when it changes. */
export function useClockStyle(): ClockVariant {
  const [v, setV] = useState<ClockVariant>("orbital");
  useEffect(() => {
    const read = () => {
      try {
        const s = localStorage.getItem(CLOCK_KEY) as ClockVariant | null;
        if (s) setV(s);
      } catch {
        /* ignore */
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener(CLOCK_EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(CLOCK_EVENT, read);
    };
  }, []);
  return v;
}

/** Persists the chosen clock style and notifies listeners in this tab. */
export function setClockStyle(v: ClockVariant) {
  try {
    localStorage.setItem(CLOCK_KEY, v);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CLOCK_EVENT));
}

export const CLOCK_STYLES: { id: ClockVariant; label: string; desc: string }[] = [
  { id: "orbital", label: "Orbital Cockpit", desc: "Anillo 24h con jornada" },
  { id: "digital", label: "Digital minimalista", desc: "Números elegantes con segundos" },
  { id: "flip", label: "Flip / split-flap", desc: "Las cifras voltean al cambiar" },
  { id: "analog", label: "Análogo de manecillas", desc: "Clásico redondo 12h" },
  { id: "ring", label: "Anillo de jornada", desc: "Progreso del día en %" },
  { id: "mono", label: "Terminal", desc: "Estética técnica monoespaciada" },
];

const ACCENT: Record<string, string> = {
  before: "#7a8aa8",
  working: "#10B981",
  break: "#F59E0B",
  completed: "#3FBEFF",
  offhours: "#7a8aa8",
  vacation: "#3FBEFF",
  holiday: "#F59E0B",
};
const pad = (n: number) => String(n).padStart(2, "0");
function fmt(now: Date) {
  const H = now.getHours(),
    m = now.getMinutes(),
    s = now.getSeconds();
  let h12 = H % 12;
  if (h12 === 0) h12 = 12;
  return { H: pad(H), m: pad(m), s: pad(s), h12: pad(h12), h12n: h12, ap: H < 12 ? "AM" : "PM" };
}
const SHIFT = 9 * 3600;

interface ClockProps {
  now: Date;
  state: string;
  worked?: number;
  breakSec?: number;
  mini?: boolean;
}

function cssVar(c: string) {
  return { ["--c" as string]: c } as React.CSSProperties;
}

function Digital({ now, state, mini }: ClockProps) {
  const t = fmt(now);
  const c = ACCENT[state] || "#3FBEFF";
  return (
    <div className={`nclk nclk-digital ${mini ? "mini" : ""}`} style={cssVar(c)}>
      <div className="nclk-dig-time">
        <span>{t.H}</span>
        <span className="nclk-colon">:</span>
        <span>{t.m}</span>
        <sup className="nclk-sec">{t.s}</sup>
      </div>
      <div className="nclk-dig-foot">
        <span className="nclk-rule" />
        <span className="nclk-ampm">{t.ap}</span>
      </div>
    </div>
  );
}

function Flip({ now, state, mini }: ClockProps) {
  const t = fmt(now);
  const c = ACCENT[state] || "#3FBEFF";
  const group = (str: string) =>
    str.split("").map((ch, i) => (
      <span key={i} className="nclk-flip-card">
        <span key={ch} className="nclk-flip-d">
          {ch}
        </span>
      </span>
    ));
  return (
    <div className={`nclk nclk-flip ${mini ? "mini" : ""}`} style={cssVar(c)}>
      <div className="nclk-flip-row">
        {group(t.H)}
        <span className="nclk-flip-sep">:</span>
        {group(t.m)}
        <span className="nclk-flip-sep">:</span>
        {group(t.s)}
      </div>
      <div className="nclk-flip-ampm">{t.ap}</div>
    </div>
  );
}

function Analog({ now, state, mini }: ClockProps) {
  const c = ACCENT[state] || "#3FBEFF";
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;
  const hand = (deg: number, len: number, w: number, col: string, cap: "round" | "butt" = "round") => {
    const a = ((deg - 90) * Math.PI) / 180;
    return (
      <line
        x1="100"
        y1="100"
        x2={100 + len * Math.cos(a)}
        y2={100 + len * Math.sin(a)}
        stroke={col}
        strokeWidth={w}
        strokeLinecap={cap}
      />
    );
  };
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const a = ((i * 6 - 90) * Math.PI) / 180,
      big = i % 5 === 0;
    const r1 = big ? 82 : 86,
      r2 = 90;
    ticks.push(
      <line
        key={i}
        x1={100 + r1 * Math.cos(a)}
        y1={100 + r1 * Math.sin(a)}
        x2={100 + r2 * Math.cos(a)}
        y2={100 + r2 * Math.sin(a)}
        stroke="var(--border-strong)"
        strokeWidth={big ? 2 : 1}
        opacity={big ? 0.9 : 0.5}
      />
    );
  }
  return (
    <div className={`nclk nclk-analog ${mini ? "mini" : ""}`}>
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="96" fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="90" fill="none" stroke={c} strokeWidth="1.5" opacity="0.22" />
        {ticks}
        {hand(h * 30, 48, 5, "var(--text-primary)")}
        {hand(m * 6, 70, 3.5, "var(--text-primary)")}
        {hand(s * 6, 76, 1.6, c)}
        <circle cx="100" cy="100" r="5" fill={c} />
        <circle cx="100" cy="100" r="2" fill="var(--bg-elevated)" />
      </svg>
    </div>
  );
}

function Ring({ now, state, worked, mini }: ClockProps) {
  const t = fmt(now);
  const c = ACCENT[state] || "#3FBEFF";
  const pct = Math.max(0, Math.min(1, (worked || 0) / SHIFT));
  const r = 84,
    C = 2 * Math.PI * r;
  return (
    <div className={`nclk nclk-ring ${mini ? "mini" : ""}`} style={cssVar(c)}>
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth="12" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={c}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="nclk-ring-center">
        <div className="nclk-ring-time">
          {t.H}:{t.m}
        </div>
        <div className="nclk-ring-pct" style={{ color: c }}>
          {Math.round(pct * 100)}%
        </div>
        <div className="nclk-ring-lbl">de jornada</div>
      </div>
    </div>
  );
}

function Mono({ now, state, mini }: ClockProps) {
  const t = fmt(now);
  const c = ACCENT[state] || "#3FBEFF";
  return (
    <div className={`nclk nclk-mono ${mini ? "mini" : ""}`} style={cssVar(c)}>
      <div className="nclk-mono-bar">
        <i />
        <i />
        <i />
      </div>
      <div className="nclk-mono-body">
        <div className="nclk-mono-prompt">
          <span className="nclk-mono-user">andrea@nova</span>:<span className="nclk-mono-path">~</span>$ date +%T
        </div>
        <div className="nclk-mono-time">
          {t.H}:{t.m}:{t.s}
          <span className="nclk-mono-cur" />
        </div>
        <div className="nclk-mono-meta">state={state} · shift=09:00–18:00</div>
      </div>
    </div>
  );
}

function Orbital({ now, state, worked, mini }: ClockProps) {
  const c = ACCENT[state] || "#3FBEFF";
  const cx = 100,
    cy = 100;
  const s = now.getSeconds(),
    m = now.getMinutes() + s / 60,
    hod = now.getHours() + m / 60;
  const a24 = (h: number) => (h / 24) * 360;
  const polar = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const arc = (r: number, s0: number, s1: number) => {
    const a = polar(r, s0),
      b = polar(r, s1);
    const large = s1 - s0 <= 180 ? 0 : 1;
    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
  };
  const ss = a24(9),
    se = a24(18);
  const prog = ss + Math.max(0, Math.min(1, (worked || 0) / SHIFT)) * (se - ss);
  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const p1 = polar(82, a24(i)),
      p2 = polar(i % 6 === 0 ? 72 : 78, a24(i));
    ticks.push(
      <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--border-strong)" strokeWidth={i % 6 === 0 ? 2 : 1} opacity={i % 6 === 0 ? 0.85 : 0.45} />
    );
  }
  const hp = polar(46, a24(hod));
  const t = fmt(now);
  return (
    <div className={`nclk nclk-orbital ${mini ? "mini" : ""}`} style={cssVar(c)}>
      <svg viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r="90" fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth="1.5" />
        <path d={arc(64, ss, se)} fill="none" stroke="var(--border-strong)" strokeWidth="6" opacity="0.4" strokeLinecap="round" />
        <path d={arc(64, ss, prog)} fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" style={{ transition: "stroke 0.3s" }} />
        {ticks}
        <line x1={cx} y1={cy} x2={hp.x} y2={hp.y} stroke={c} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill={c} />
      </svg>
      <div className="nclk-orbital-center">
        {t.H}:{t.m}
      </div>
    </div>
  );
}

const MAP: Record<ClockVariant, (p: ClockProps) => React.ReactElement> = {
  digital: Digital,
  flip: Flip,
  analog: Analog,
  ring: Ring,
  mono: Mono,
  orbital: Orbital,
};

export function NovaClock({ variant = "orbital", ...props }: ClockProps & { variant?: ClockVariant }) {
  const C = MAP[variant] || Orbital;
  return <C {...props} />;
}
