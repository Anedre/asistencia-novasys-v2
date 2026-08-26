"use client";

/**
 * OpenShiftBanner — surfaces a "you forgot to clock out" reminder on the
 * employee dashboard. Reads the week summary (already loaded for the
 * dashboard) and finds days with `status === "OPEN"` and no `lastOutLocal`.
 * If one exists, shows an inline banner with a quick form that posts to
 * `/api/employee/regularize` so the employee can self-fix yesterday's
 * forgotten clock-out (tenant config decides whether it auto-applies or
 * creates an approval request).
 *
 * Dismissable per-day via localStorage so it doesn't nag once the user
 * decides to handle it later, but reappears the next day.
 */

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTenantTimezone, todayInTz } from "@/hooks/use-timezone";
import { IconSvg, Icons } from "@/components/nova/icons";

type WeekDayLike = {
  date: string;
  weekday?: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  workedMinutes?: number;
  status?: string;
};

interface Props {
  /** Week summary days (any of the past N days). Component will pick the
   *  most recent day with status=OPEN and no lastOutLocal. */
  days: WeekDayLike[];
}

const DISMISS_KEY = "novasys.openShiftBanner.dismissed";

function getDismissedDates(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function pushDismissed(date: string) {
  if (typeof window === "undefined") return;
  const cur = getDismissedDates();
  cur.add(date);
  // Cap to last 14 to keep storage tidy
  const arr = Array.from(cur).sort().slice(-14);
  localStorage.setItem(DISMISS_KEY, JSON.stringify(arr));
}

function formatDateLong(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  const day = Number(m[3]);
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${day} de ${months[Number(m[2]) - 1]}`;
}

/** Extract HH:MM from local ISO or HH:MM:SS or HH:MM */
function extractHHMM(s: string | null | undefined): string {
  if (!s) return "";
  const isoM = /T(\d{2}:\d{2})/.exec(s);
  if (isoM) return isoM[1];
  const m = /^(\d{2}:\d{2})/.exec(s);
  return m ? m[1] : "";
}

export function OpenShiftBanner({ days }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [endTime, setEndTime] = useState("18:00");
  const [reasonNote, setReasonNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dismissedTick, setDismissedTick] = useState(0); // forces re-render

  // Today's date in the TENANT timezone — the same clock the week summary uses
  // to label its days. Two things used to break here: the value came from the
  // device clock (a phone on a different timezone lands on another day), and it
  // was memoized with an empty dep array, so a tab left open across midnight
  // kept yesterday's date forever. Either one makes the *current, still-open*
  // shift look like a forgotten clock-out. Starts empty so the first paint
  // never shows the banner, then refreshes every minute.
  const tz = useTenantTimezone();
  const [todayYmd, setTodayYmd] = useState("");

  useEffect(() => {
    setTodayYmd(todayInTz(tz));
    const id = setInterval(() => setTodayYmd(todayInTz(tz)), 60_000);
    return () => clearInterval(id);
  }, [tz]);

  const openDay = useMemo(() => {
    if (!todayYmd) return undefined;
    const dismissed = getDismissedDates();
    // Iterate most recent first
    const sorted = [...days].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.find(
      (d) =>
        // Strictly before today: today's shift is still running, and a future
        // date can never be a forgotten clock-out.
        d.date < todayYmd &&
        d.status === "OPEN" &&
        !!d.firstInLocal &&
        !d.lastOutLocal &&
        !dismissed.has(d.date)
    );
  }, [days, todayYmd, dismissedTick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!openDay) return null;

  const startClock = extractHHMM(openDay.firstInLocal) || "09:00";

  async function submit() {
    if (!openDay) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/employee/regularize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: openDay.date,
          startTime: startClock,
          endTime,
          breakMinutes: 60,
          reasonCode: "OLVIDO_MARCACION",
          reasonNote: reasonNote.trim() || "Olvidé marcar la salida",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error al regularizar");
      toast.success(
        body.mode === "PENDING_APPROVAL"
          ? "Solicitud enviada. Tu admin la revisará."
          : "Día regularizado correctamente."
      );
      pushDismissed(openDay.date);
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["requests"] });
      setExpanded(false);
      setDismissedTick((t) => t + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al regularizar");
    } finally {
      setSubmitting(false);
    }
  }

  function dismiss() {
    if (!openDay) return;
    pushDismissed(openDay.date);
    setDismissedTick((t) => t + 1);
  }

  return (
    <div className="open-shift-banner">
      <div className="open-shift-banner-icon">
        <IconSvg d={Icons.alert} size={18} />
      </div>
      <div className="open-shift-banner-main">
        <div className="open-shift-banner-title">
          Olvidaste marcar tu salida el {formatDateLong(openDay.date)}
        </div>
        <div className="open-shift-banner-sub">
          Marcaste entrada a las <strong>{startClock}</strong> pero no registraste salida.
          {expanded ? null : " Indica a qué hora terminaste y queda regularizado."}
        </div>

        {expanded && (
          <div className="open-shift-banner-form">
            <div className="open-shift-banner-row">
              <label className="open-shift-banner-label">
                Salida
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="open-shift-banner-input"
                />
              </label>
              <label className="open-shift-banner-label open-shift-banner-note">
                Nota (opcional)
                <input
                  type="text"
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="Ej: Cerré laptop sin marcar"
                  className="open-shift-banner-input"
                  maxLength={200}
                />
              </label>
            </div>
            <div className="open-shift-banner-actions">
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={() => setExpanded(false)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn primary btn-sm"
                onClick={submit}
                disabled={submitting || !endTime}
              >
                <IconSvg d={Icons.check} size={13} />
                {submitting ? "Enviando…" : "Regularizar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {!expanded && (
        <div className="open-shift-banner-actions-top">
          <button
            type="button"
            className="btn primary btn-sm"
            onClick={() => setExpanded(true)}
          >
            Arreglar
          </button>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={dismiss}
            aria-label="Cerrar aviso"
            title="Recordarme luego"
          >
            <IconSvg d={Icons.x} size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
