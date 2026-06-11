"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSvg, Icons } from "@/components/nova/icons";

/* ============================================================
   NovaWeekPicker — custom week popover (replaces <input type=week>).
   - Same Monday-first 6-week day grid as NovaDatePicker, but clicking any day
     selects that day's ISO-8601 week (Mon–Sun), highlighting the whole week.
   - Value is a "YYYY-Www" ISO week string — the SAME contract the native
     <input type=week> produced, so the PDF Lambda parses it identically.
   - The resolved Mon–Sun date range is shown in the trigger and footer so the
     selected week is always unambiguous.
   - Portaled to .nva-app, shares the .ndp-* styles (incl. range highlight).
   ============================================================ */

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"]; // Monday-first

const POP_W = 282;
const POP_H = 360;

const pad = (n: number) => String(n).padStart(2, "0");

/* ---- ISO-8601 week helpers (week starts Monday; week 1 holds the first Thursday) ---- */

/** ISO year + week number for a local date. */
function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000);
  return { year: d.getUTCFullYear(), week };
}

const isoWeekString = (date: Date) => {
  const { year, week } = isoWeekOf(date);
  return `${year}-W${pad(week)}`;
};

/** Local "current ISO week" as "YYYY-Www". Client-only — call from effects/handlers. */
export function currentISOWeek(): string {
  return isoWeekString(new Date());
}

function parseWeek(v?: string): { year: number; week: number } | null {
  const mt = /^(\d{4})-W(\d{2})$/.exec(v ?? "");
  return mt ? { year: +mt[1], week: +mt[2] } : null;
}

/** Monday (local Date, midnight) of a given ISO year+week. */
function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4); // always in ISO week 1
  const jan4Dow = (jan4.getDay() + 6) % 7; // Mon=0
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - jan4Dow + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function weekRange(value?: string): { monday: Date; sunday: Date } | null {
  const p = parseWeek(value);
  if (!p) return null;
  const monday = isoWeekMonday(p.year, p.week);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function rangeLabel(value?: string): string {
  const r = weekRange(value);
  if (!r) return "";
  const { monday: a, sunday: b } = r;
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`
    : `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
}

const firstWeekdayMonday = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

interface Cell { y: number; m: number; d: number; cur: boolean }

interface Props {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
}

export function NovaWeekPicker({ value, onChange, id, placeholder = "Seleccionar semana" }: Props) {
  const [open, setOpen] = useState(false);
  const [posn, setPosn] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const r = weekRange(value);
    const base = r ? r.monday : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  function computePos() {
    const el = triggerRef.current;
    if (!el || typeof window === "undefined") return;
    const r = el.getBoundingClientRect();
    let left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8));
    let top = r.bottom + 6;
    if (top + POP_H > window.innerHeight - 8 && r.top - POP_H - 6 > 8) top = r.top - POP_H - 6;
    setPosn({ top, left });
  }

  function toggle() {
    const willOpen = !open;
    if (willOpen) {
      const r = weekRange(value);
      const base = r ? r.monday : new Date();
      setView({ y: base.getFullYear(), m: base.getMonth() });
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
  const today = new Date();
  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // Constant 6-week (42-cell) grid: prev tail + current + next head.
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

  const r = weekRange(value);
  const selMonTime = r ? r.monday.getTime() : null;
  const selSunTime = r ? r.sunday.getTime() : null;

  function pick(c: Cell) {
    const next = isoWeekString(new Date(c.y, c.m, c.d));
    if (!c.cur) setView({ y: c.y, m: c.m });
    onChange(next);
    setOpen(false);
  }

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const portalTarget =
    typeof document !== "undefined" ? (document.querySelector(".nva-app") ?? document.body) : null;

  const popover =
    open && posn && portalTarget
      ? createPortal(
          <div
            ref={popRef}
            className="ndp-pop"
            role="dialog"
            aria-label="Seleccionar semana"
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
                const t = new Date(c.y, c.m, c.d).getTime();
                const inWeek = selMonTime != null && selSunTime != null && t >= selMonTime && t <= selSunTime;
                const isStart = selMonTime != null && t === selMonTime;
                const isEnd = selSunTime != null && t === selSunTime;
                const cls = [
                  "ndp-cell",
                  c.cur ? "" : "other",
                  isStart ? "range-start" : "",
                  isEnd ? "range-end" : "",
                  inWeek && !isStart && !isEnd ? "in-range" : "",
                  t === todayTime ? "today" : "",
                ].filter(Boolean).join(" ");
                return (
                  <button key={i} type="button" className={cls} onClick={() => pick(c)}>
                    {c.d}
                  </button>
                );
              })}
            </div>

            <div className="ndp-foot ndp-foot-range">
              <span className="ndp-range-hint">{r ? rangeLabel(value) : "Elegí un día de la semana"}</span>
              <button
                type="button"
                className="ndp-today-btn"
                onClick={() => { onChange(currentISOWeek()); setOpen(false); }}
              >
                Esta semana
              </button>
            </div>
          </div>,
          portalTarget,
        )
      : null;

  const triggerLabel = value ? rangeLabel(value) : placeholder;

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
        <span className={`ndp-value ${value ? "" : "ph"}`}>{triggerLabel}</span>
        <IconSvg d="M6 9l6 6 6-6" size={14} />
      </button>
      {popover}
    </div>
  );
}
