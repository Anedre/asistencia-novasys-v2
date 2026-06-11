"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSvg, Icons } from "@/components/nova/icons";

/* ============================================================
   NovaMonthPicker — custom month popover (replaces <input type=month>).
   - Year nav + 3×4 grid of Spanish month abbreviations.
   - Portaled to the .nva-app root, shares the .ndp-* styles (nova-design.css)
     and the positioning approach of NovaDatePicker.
   - Value is a "YYYY-MM" string (same contract as the native input).
   ============================================================ */

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const POP_W = 264;
const POP_H = 300;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local "current month" as "YYYY-MM". Client-only — call from effects/handlers. */
export function currentMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`;
}

function parse(v?: string): { y: number; m: number } | null {
  const mt = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  return mt ? { y: +mt[1], m: +mt[2] - 1 } : null;
}

function fmtDisplay(v?: string): string {
  const p = parse(v);
  return p ? `${MONTHS[p.m]} ${p.y}` : "";
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Inclusive "YYYY-MM" bounds. */
  min?: string;
  max?: string;
  id?: string;
  placeholder?: string;
}

export function NovaMonthPicker({ value, onChange, min, max, id, placeholder = "Seleccionar mes" }: Props) {
  const [open, setOpen] = useState(false);
  const [posn, setPosn] = useState<{ top: number; left: number } | null>(null);
  const sel = parse(value);
  const [year, setYear] = useState<number>(() => (sel ?? parse(currentMonth()))?.y ?? 2025);
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
      const p = parse(value) ?? parse(currentMonth());
      if (p) setYear(p.y);
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

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth();
  const isDisabled = (y: number, m: number) => {
    const v = `${y}-${pad(m + 1)}`;
    return (!!min && v < min) || (!!max && v > max);
  };

  function pick(m: number) {
    if (isDisabled(year, m)) return;
    onChange(`${year}-${pad(m + 1)}`);
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
            aria-label="Seleccionar mes"
            style={{ position: "fixed", top: posn.top, left: posn.left, width: POP_W }}
          >
            <div className="ndp-head">
              <button type="button" className="ndp-nav" onClick={() => setYear((y) => y - 1)} aria-label="Año anterior">
                <IconSvg d="M15 18l-6-6 6-6" size={16} />
              </button>
              <div className="ndp-title">{year}</div>
              <button type="button" className="ndp-nav" onClick={() => setYear((y) => y + 1)} aria-label="Año siguiente">
                <IconSvg d="M9 18l6-6-6-6" size={16} />
              </button>
            </div>

            <div className="ndp-mgrid">
              {MONTHS_SHORT.map((label, m) => {
                const isSel = !!sel && sel.y === year && sel.m === m;
                const isToday = year === curY && m === curM;
                const cls = `ndp-mcell${isSel ? " sel" : ""}${isToday ? " today" : ""}`;
                return (
                  <button key={m} type="button" className={cls} disabled={isDisabled(year, m)} onClick={() => pick(m)}>
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="ndp-foot">
              <button
                type="button"
                className="ndp-today-btn"
                onClick={() => { onChange(currentMonth()); setOpen(false); }}
              >
                Este mes
              </button>
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
