"use client";

/**
 * Monthly calendar grid for the admin attendance editor.
 *
 * Renders a 7-column grid (L–D). Each cell shows:
 *   - day number
 *   - status background color
 *   - worked hours (or "—")
 *
 * Clicking a cell calls onPick(workDate) with "YYYY-MM-DD". Future days
 * and days outside the current month are not clickable.
 */

import { cn } from "@/lib/utils";

export interface AttendanceDayRow {
  workDate: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  plannedMinutes: number;
  deltaMinutes: number;
  status: string | null;
  source: string | null;
  regularizationReasonCode: string | null;
  updatedAt: string | null;
}

interface Props {
  rows: AttendanceDayRow[];
  /** "YYYY-MM" — month being shown */
  monthStr: string;
  onPick: (workDate: string) => void;
}

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  OK: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-200",
    label: "OK",
  },
  CLOSED: {
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-200",
    label: "Cerrado",
  },
  REGULARIZED: {
    bg: "bg-sky-100 dark:bg-sky-900/40",
    text: "text-sky-800 dark:text-sky-200",
    label: "Regular.",
  },
  ABSENCE: {
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-800 dark:text-red-200",
    label: "Ausente",
  },
  SHORT: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-200",
    label: "Corto",
  },
  MISSING: {
    bg: "bg-zinc-200/70 dark:bg-zinc-800/60",
    text: "text-zinc-700 dark:text-zinc-300",
    label: "Falta",
  },
  NO_RECORD: {
    bg: "bg-zinc-100 dark:bg-zinc-800/40",
    text: "text-zinc-500 dark:text-zinc-400",
    label: "—",
  },
  HOLIDAY: {
    bg: "bg-indigo-100 dark:bg-indigo-900/40",
    text: "text-indigo-800 dark:text-indigo-200",
    label: "Feriado",
  },
  OPEN: {
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    text: "text-yellow-800 dark:text-yellow-200",
    label: "Abierto",
  },
};

function fmtHours(min: number): string {
  if (!min) return "—";
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function getMonthGrid(monthStr: string): Date[] {
  // Returns 42 dates (6 weeks) starting from the Monday of the week containing
  // the 1st of the month. Locale-aware of Monday-first weeks.
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr) - 1;
  const first = new Date(y, m, 1);
  // JS getDay: 0=Sun, 1=Mon... we want Monday-first: offset so Mon=0
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(y, m, 1 - dow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AttendanceCalendarView({ rows, monthStr, onPick }: Props) {
  const rowByDate = new Map(rows.map((r) => [r.workDate, r]));
  const days = getMonthGrid(monthStr);
  const [yStr, mStr] = monthStr.split("-");
  const currentMonth = Number(mStr) - 1;
  const currentYear = Number(yStr);
  const todayStr = toYmd(new Date());

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-medium text-muted-foreground">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((d) => {
          const ymd = toYmd(d);
          const inMonth =
            d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          const isToday = ymd === todayStr;
          const isFuture = d > new Date();
          const row = rowByDate.get(ymd);
          const style =
            row?.status && STATUS_STYLES[row.status]
              ? STATUS_STYLES[row.status]
              : STATUS_STYLES.NO_RECORD;

          const disabled = !inMonth || isFuture;

          return (
            <button
              key={ymd}
              type="button"
              disabled={disabled}
              onClick={() => onPick(ymd)}
              title={
                row
                  ? `${ymd} · ${row.status} · ${fmtHours(row.workedMinutes)} (Δ ${row.deltaMinutes})`
                  : `${ymd} · sin registro`
              }
              className={cn(
                "aspect-square rounded-md border p-1.5 text-left transition",
                "flex flex-col justify-between",
                inMonth ? style.bg : "bg-background",
                disabled && "opacity-40 cursor-not-allowed",
                !disabled && "hover:ring-2 hover:ring-primary/40 cursor-pointer",
                isToday && inMonth && "ring-2 ring-primary"
              )}
            >
              <span
                className={cn(
                  "text-[11px] sm:text-xs font-semibold",
                  inMonth ? style.text : "text-muted-foreground"
                )}
              >
                {d.getDate()}
              </span>
              {row && inMonth && (
                <div className={cn("text-[9px] sm:text-[10px]", style.text)}>
                  <div className="font-medium truncate">{style.label}</div>
                  <div className="opacity-75 truncate">
                    {fmtHours(row.workedMinutes)}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[10px] text-muted-foreground">
        {(["OK", "REGULARIZED", "ABSENCE", "SHORT", "HOLIDAY"] as const).map(
          (k) => (
            <div key={k} className="flex items-center gap-1">
              <span
                className={cn("inline-block h-2.5 w-2.5 rounded-sm", STATUS_STYLES[k].bg)}
              />
              <span>{STATUS_STYLES[k].label}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
