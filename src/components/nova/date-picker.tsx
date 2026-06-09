"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSvg, Icons } from "@/components/nova/icons";

/* ============================================================
   NovaDatePicker — custom calendar popover (replaces <input type=date>).
   - Spanish, Monday-first, constant 6-week grid (adjacent-month days shown
     muted) so the height never changes between months — no blank space.
   - Portaled to the .nva-app root (keeps design tokens, escapes card clipping),
     fixed positioning with flip-up near the viewport bottom.
   - Styles live in nova-design.css (.ndp-*), NOT styled-jsx: styled-jsx scoping
     is unreliable across React portals.
   - Value is an ISO "YYYY-MM-DD" string (same contract as the native input).
   ============================================================ */

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"]; // Monday-first

const POP_W = 282;
const POP_H = 348;

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

interface Cell { y: number; m: number; d: number; cur: boolean }

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
  const [posn, setPosn] = useState<{ top: number; left: number } | null>(null);
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
    if (top + POP_H > window.innerHeight - 8 && r.top - POP_H - 6 > 8) top = r.top - POP_H - 6;
    setPosn({ top, left });
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

  // Constant 6-week grid (42 cells): prev-month tail + current + next-month head.
  const lead = firstWeekdayMonday(vy, vm);
  const total = daysInMonth(vy, vm);
  const prevY = vm === 0 ? vy - 1 : vy;
  const prevM = vm === 0 ? 11 : vm - 1;
  const prevTotal = daysInMonth(prevY, prevM);
  const nextY = vm === 11 ? vy + 1 : vy;
  const nextM = vm === 11 ? 0 : vm + 1;
  const cells: Cell[] = [];
  for (let i = lead - 1; i >= 0; i--) cells.push({ y: prevY, m: prevM, d: prevTotal - i, cur: false });
  for (let d = 1; d <= total; d++) cells.push({ y: vy, m: vm, d, cur: true });
  let nd = 1;
  while (cells.length < 42) cells.push({ y: nextY, m: nextM, d: nd++, cur: false });

  const isDisabled = (iso: string) => (!!min && iso < min) || (!!max && iso > max);
  function pick(c: Cell) {
    const iso = toISO(c.y, c.m, c.d);
    if (isDisabled(iso)) return;
    onChange(iso);
    if (!c.cur) setView({ y: c.y, m: c.m });
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
    open && posn && portalTarget
      ? createPortal(
          <div
            ref={popRef}
            className="ndp-pop"
            role="dialog"
            aria-label="Seleccionar fecha"
            style={{ position: "fixed", top: posn.top, left: posn.left, width: POP_W }}
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
              {cells.map((c, i) => {
                const iso = toISO(c.y, c.m, c.d);
                const cls =
                  `ndp-cell${c.cur ? "" : " other"}${value === iso ? " sel" : ""}${iso === todayStr ? " today" : ""}`;
                return (
                  <button key={i} type="button" className={cls} disabled={isDisabled(iso)} onClick={() => pick(c)}>
                    {c.d}
                  </button>
                );
              })}
            </div>

            <div className="ndp-foot">
              <button type="button" className="ndp-today-btn" onClick={goToday}>Hoy</button>
            </div>
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
    </div>
  );
}
