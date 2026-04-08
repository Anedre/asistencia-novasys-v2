"use client";

/**
 * Dense list view for the admin attendance editor.
 *
 * Shows one row per day with all key fields at a glance. Clicking a row
 * opens the editor sheet via onPick(workDate).
 */

import { Badge } from "@/components/ui/badge";
import type { AttendanceDayRow } from "./AttendanceCalendarView";

interface Props {
  rows: AttendanceDayRow[];
  onPick: (workDate: string) => void;
}

function fmtHm(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : iso.slice(0, 5);
}

function fmtMinutes(min: number): string {
  if (!min) return "0h";
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  const sign = min < 0 ? "-" : "";
  return `${sign}${h}h${m > 0 ? ` ${m}m` : ""}`;
}

function statusVariant(
  status: string | null
): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  if (status === "OK" || status === "CLOSED") return "default";
  if (status === "ABSENCE" || status === "MISSING" || status === "SHORT")
    return "destructive";
  if (status === "REGULARIZED") return "secondary";
  return "outline";
}

export function AttendanceListView({ rows, onPick }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin días para mostrar en este mes.
      </p>
    );
  }

  return (
    <div className="divide-y overflow-hidden rounded-md border">
      {rows.map((r) => (
        <button
          key={r.workDate}
          type="button"
          className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-muted/60"
          onClick={() => onPick(r.workDate)}
        >
          <div className="w-24 shrink-0 font-mono text-sm">{r.workDate}</div>
          <div className="w-28 shrink-0 text-xs text-muted-foreground">
            {fmtHm(r.firstInLocal)} – {fmtHm(r.lastOutLocal)}
          </div>
          <div className="w-20 shrink-0 text-xs text-muted-foreground">
            {fmtMinutes(r.workedMinutes)}
          </div>
          <div className="w-24 shrink-0 text-xs">
            <span
              className={
                r.deltaMinutes < 0
                  ? "text-destructive"
                  : r.deltaMinutes > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              }
            >
              Δ {fmtMinutes(r.deltaMinutes)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <Badge variant={statusVariant(r.status)}>
              {r.status ?? "NO_RECORD"}
            </Badge>
            {r.source && (
              <span className="ml-2 text-xs text-muted-foreground">
                {r.source}
              </span>
            )}
            {r.regularizationReasonCode && (
              <span className="ml-2 text-xs text-muted-foreground">
                · {r.regularizationReasonCode}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
