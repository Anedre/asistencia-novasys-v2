"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSvg, Icons } from "@/components/nova/icons";
import { todayISO } from "@/components/nova/date-picker";

/* ============================================================
   NovaDateRangePicker — pick a start + end date on one calendar, with the
   in-between range highlighted. Shares the .ndp-* styles (nova-design.css)
   and the portal/positioning approach of NovaDatePicker.
   Values are ISO "YYYY-MM-DD" strings; onChange(from, to).
   ============================================================ */

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

const POP_W = 282;
const POP_H = 360;

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function parseISO(s?: string): { y: number; m: number; d: number } | null {
  if (!s) return null;
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return mt ? { y: +mt[1], m: +mt[2] - 1, d: +mt[3] } : null;
}
function shortLabel(s?: string): string {
  const p = parseISO(s);
  return p ? `${p.d} ${MONTHS_SHORT[p.m]}` : "";
}
const firstWeekdayMonday = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

interface Cell { y: number; m: number; d: number; cur: boolean }

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  min?: string;
  max?: string;
  id?: string;
}

export function NovaDateRangePicker({ from, to, onChange, min, max, id }: Props) {
  const [open, setOpen] = useState(false);
  const [posn, setPosn] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const p = parseISO(from) ?? parseISO(todayISO());
    return p ? { y: p.y, m: p.m } : { y: 2025, m: 0 };
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
      const p = parseISO(from) ?? parseISO(todayISO());
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
    if (!c.cur) setView({ y: c.y, m: c.m });
    if (!from || to) {
      onChange(iso, ""); // begin a new range
    } else if (iso >= from) {
      onChange(from, iso); // complete the range
      setOpen(false);
    } else {
      onChange(iso, ""); // clicked before start → restart from there
    }
  }

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const triggerLabel = from
    ? `${shortLabel(from)} – ${to ? shortLabel(to) : "…"}`
    : "Seleccionar rango";

  const portalTarget =
    typeof document !== "undefined" ? (document.querySelector(".nva-app") ?? document.body) : null;

  const popover =
    open && posn && portalTarget
      ? createPortal(
          <div
            ref={popRef}
            className="ndp-pop"
            role="dialog"
            aria-label="Seleccionar rango de fechas"
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
                const isStart = !!from && iso === from;
                const isEnd = !!to && iso === to;
                const inRange = !!from && !!to && iso > from && iso < to;
                const cls = [
                  "ndp-cell",
                  c.cur ? "" : "other",
                  isStart ? "range-start" : "",
                  isEnd ? "range-end" : "",
                  inRange ? "in-range" : "",
                  iso === todayStr ? "today" : "",
                ].filter(Boolean).join(" ");
                return (
                  <button key={i} type="button" className={cls} disabled={isDisabled(iso)} onClick={() => pick(c)}>
                    {c.d}
                  </button>
                );
              })}
            </div>

            <div className="ndp-foot ndp-foot-range">
              <span className="ndp-range-hint">
                {!from ? "Elegí la fecha de inicio" : !to ? "Ahora la fecha de fin" : `${shortLabel(from)} – ${shortLabel(to)}`}
              </span>
              {(from || to) && (
                <button type="button" className="ndp-today-btn" onClick={() => onChange("", "")}>Limpiar</button>
              )}
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
        <span className={`ndp-value ${from ? "" : "ph"}`}>{triggerLabel}</span>
        <IconSvg d="M6 9l6 6 6-6" size={14} />
      </button>
      {popover}
    </div>
  );
}
