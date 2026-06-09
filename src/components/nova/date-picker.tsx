"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSvg, Icons } from "@/components/nova/icons";

/* ============================================================
   NovaDatePicker — custom calendar popover (replaces <input type=date>).
   - Spanish, Monday-first week. Highlights today, "Hoy" shortcut, min/max.
   - Popover is portaled to the .nva-app root (so no ancestor card can clip
     or paint over it) and positioned with fixed coords (flips up near the
     bottom edge). Closes on outside-click / Esc; repositions on scroll/resize.
   - Value is an ISO "YYYY-MM-DD" string (same contract as the native input).
   ============================================================ */

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"]; // Monday-first

const POP_W = 282;
const POP_H = 340;

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-based

function parseISO(s?: string): { y: number; m: number; d: number } | null {
  if (!s) return null;
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!mt) return null;
  return { y: +mt[1], m: +mt[2] - 1, d: +mt[3] };
}

/** Local "today" as ISO. Client-only — call from effects/handlers, not in SSR render initializers. */
export function todayISO(): string {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth(), n.getDate());
}

function fmtDisplay(s?: string): string {
  const p = parseISO(s);
  if (!p) return "";
  return `${p.d} ${MONTHS_SHORT[p.m]} ${p.y}`;
}

const firstWeekdayMonday = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

interface Props {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
}

export function NovaDatePicker({ value, onChange, min, max, placeholder = "Seleccionar fecha", id }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const sel = parseISO(value);
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const p = sel ?? parseISO(todayISO());
    return p ? { y: p.y, m: p.m } : { y: 2025, m: 0 };
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function computePos() {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    let left = Math.min(r.left, window.innerWidth - POP_W - 8);
    left = Math.max(8, left);
    let top = r.bottom + 6;
    // Flip above the trigger if there isn't room below.
    if (top + POP_H > window.innerHeight - 8 && r.top - POP_H - 6 > 8) top = r.top - POP_H - 6;
    setPos({ top, left });
  }

  function toggle() {
    const willOpen = !open;
    if (willOpen) {
      const p = parseISO(value) ?? parseISO(todayISO());
      if (p) setView({ y: p.y, m: p.m });
      computePos();
    }
    setOpen(willOpen);
  }

  // Outside-click / Esc to close; reposition on scroll / resize while open.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onReflow = () => computePos();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  const { y: vy, m: vm } = view;
  const todayStr = todayISO();
  const lead = firstWeekdayMonday(vy, vm);
  const total = daysInMonth(vy, vm);
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isDisabled = (d: number) => {
    const iso = toISO(vy, vm, d);
    return (!!min && iso < min) || (!!max && iso > max);
  };
  function pick(d: number) {
    if (isDisabled(d)) return;
    onChange(toISO(vy, vm, d));
    setOpen(false);
  }
  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));
  function goToday() {
    onChange(todayISO());
    setOpen(false);
  }

  const portalTarget =
    typeof document !== "undefined" ? (document.querySelector(".nva-app") ?? document.body) : null;

  const popover =
    open && pos && portalTarget
      ? createPortal(
          <div
            ref={popRef}
            className="ndp-pop"
            role="dialog"
            aria-label="Seleccionar fecha"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: POP_W }}
          >
            <div className="ndp-head">
              <button type="button" className="ndp-nav" onClick={prevMonth} aria-label="Mes anterior">
                <IconSvg d="M15 18l-6-6 6-6" size={16} />
              </button>
              <div className="ndp-title">{MONTHS[vm]} {vy}</div>
              <button type="button" className="ndp-nav" onClick={nextMonth} aria-label="Mes siguiente">
                <IconSvg d="M9 18l6-6-6-6" size={16} />
              </button>
            </div>

            <div className="ndp-grid ndp-dow">
              {WEEKDAYS.map((w) => <div key={w} className="ndp-dow-cell">{w}</div>)}
            </div>

            <div className="ndp-grid">
              {cells.map((d, i) => {
                if (d === null) return <div key={i} className="ndp-cell empty" />;
                const iso = toISO(vy, vm, d);
                const cls = `ndp-cell${value === iso ? " sel" : ""}${iso === todayStr ? " today" : ""}`;
                return (
                  <button key={i} type="button" className={cls} disabled={isDisabled(d)} onClick={() => pick(d)}>
                    {d}
                  </button>
                );
              })}
            </div>

            <div className="ndp-foot">
              <button type="button" className="ndp-today-btn" onClick={goToday}>Hoy</button>
            </div>

            <style jsx>{`
              .ndp-pop {
                z-index: 1000; padding: 12px;
                background: var(--bg-elevated); border: 1px solid var(--border);
                border-radius: 14px; box-shadow: var(--shadow-lg);
                animation: ndp-in .14s ease;
              }
              @keyframes ndp-in { from { opacity: 0; transform: translateY(-4px); } }
              .ndp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
              .ndp-title { font-weight: 600; font-size: 13.5px; color: var(--text-primary); text-transform: capitalize; }
              .ndp-nav {
                width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
                border-radius: 8px; border: 1px solid var(--border); background: var(--bg-elevated);
                color: var(--text-secondary); cursor: pointer; transition: all .15s;
              }
              .ndp-nav:hover { border-color: var(--accent); color: var(--accent); }
              .ndp-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
              .ndp-dow { margin-bottom: 4px; }
              .ndp-dow-cell {
                text-align: center; font-size: 10.5px; font-weight: 600;
                color: var(--text-muted); text-transform: uppercase; padding: 2px 0;
              }
              .ndp-cell {
                height: 34px; min-width: 0;
                display: flex; align-items: center; justify-content: center;
                border: none; background: transparent; border-radius: 9px;
                font-size: 13px; color: var(--text-primary); cursor: pointer; font-family: inherit;
                transition: background .12s, color .12s;
              }
              .ndp-cell.empty { cursor: default; }
              .ndp-cell:not(.empty):not(:disabled):hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
              .ndp-cell.today { font-weight: 700; color: var(--accent-strong, var(--accent)); }
              .ndp-cell.sel, .ndp-cell.sel.today { background: var(--accent); color: #fff; font-weight: 600; }
              .ndp-cell:disabled { color: var(--text-muted); opacity: .4; cursor: not-allowed; }
              .ndp-foot { margin-top: 10px; display: flex; justify-content: flex-end; }
              .ndp-today-btn {
                padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border-strong);
                background: var(--bg-subtle); color: var(--text-primary);
                font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s;
              }
              .ndp-today-btn:hover { border-color: var(--accent); color: var(--accent); }
              @media (prefers-reduced-motion: reduce) { .ndp-pop { animation: none; } }
            `}</style>
          </div>,
          portalTarget,
        )
      : null;

  return (
    <div className="ndp">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`ndp-trigger ${open ? "open" : ""}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <IconSvg d={Icons.calendar} size={15} />
        <span className={`ndp-value ${sel ? "" : "ph"}`}>{sel ? fmtDisplay(value) : placeholder}</span>
        <IconSvg d="M6 9l6 6 6-6" size={14} />
      </button>
      {popover}

      <style jsx>{`
        .ndp { position: relative; }
        .ndp-trigger {
          display: flex; align-items: center; gap: 8px; width: 100%;
          padding: 9px 12px; border-radius: 10px;
          border: 1.5px solid var(--border-strong);
          background: var(--bg-elevated); color: var(--text-primary);
          font-size: 14px; font-family: inherit; cursor: pointer;
          transition: border-color .15s, box-shadow .15s;
        }
        .ndp-trigger:hover { border-color: var(--accent); }
        .ndp-trigger.open {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
        }
        .ndp-trigger :global(svg) { flex-shrink: 0; color: var(--text-muted); }
        .ndp-value { flex: 1; text-align: left; }
        .ndp-value.ph { color: var(--text-muted); }
      `}</style>
    </div>
  );
}
