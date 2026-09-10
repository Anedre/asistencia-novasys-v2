"use client";

/**
 * "Jornadas sin cerrar" — find and close shifts left open.
 *
 * A day stays OPEN when somebody clocks in and never clocks out, and nothing
 * in the app closes it afterwards, so the hours never reach a report. This is
 * the admin's way to clear the backlog.
 *
 * Deliberately a review list rather than a single "close everything" button:
 * the backlog reaches back months, across payroll periods that may already be
 * settled, so the admin sees the proposed clock-out for each day and chooses
 * what to touch. Everything closed here is audited under one group and can be
 * undone in one action.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { Spinner } from "@/components/nova/spinner";

type ClosePolicy = "SOFT" | "STRICT";
type CloseSource = "LAST_EVENT" | "SCHEDULE_END" | "NOW";

interface OpenShift {
  employeeId: string;
  employeeName: string;
  area: string;
  workDate: string;
  firstInLocal: string | null;
  breakMinutes: number;
  plannedMinutes: number;
  closeAt: string;
  closeSource: CloseSource;
  workedMinutes: number;
  daysOpen: number;
}

interface CloseOutcome {
  employeeId: string;
  workDate: string;
  status: "closed" | "skipped" | "failed";
  message?: string;
}

interface CloseResult {
  groupId: string;
  closed: number;
  skipped: number;
  failed: number;
  outcomes: CloseOutcome[];
}

const SOURCE_LABEL: Record<CloseSource, string> = {
  LAST_EVENT: "última marcación",
  SCHEDULE_END: "fin de horario",
  NOW: "hora actual",
};

const RANGES = [
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "12 meses", months: 12 },
];

function monthsBack(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

function hhmm(local: string | null): string {
  if (!local) return "—";
  const m = /T(\d{2}:\d{2})/.exec(local);
  return m ? m[1] : "—";
}

const key = (s: { employeeId: string; workDate: string }) => `${s.employeeId}|${s.workDate}`;

export function CloseOpenShiftsSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [months, setMonths] = useState(12);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [policy, setPolicy] = useState<ClosePolicy>("SOFT");
  const [result, setResult] = useState<CloseResult | null>(null);

  const from = useMemo(() => monthsBack(months), [months]);

  const { data, isLoading } = useQuery<{ shifts: OpenShift[]; count: number }>({
    queryKey: ["admin", "open-shifts", from],
    queryFn: async () => {
      const res = await fetch(`/api/admin/attendance/open-shifts?from=${from}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "No se pudieron cargar las jornadas abiertas");
      }
      return res.json();
    },
  });

  const shifts = useMemo(() => data?.shifts ?? [], [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const targets = shifts
        .filter((s) => selected.has(key(s)))
        .map((s) => ({ employeeId: s.employeeId, workDate: s.workDate }));

      const res = await fetch("/api/admin/attendance/open-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shifts: targets, policy }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "No se pudieron cerrar las jornadas");
      return payload as CloseResult;
    },
    onSuccess: (payload) => {
      setResult(payload);
      setSelected(new Set());
      // The closed days change attendance, reports and the audit trail.
      qc.invalidateQueries({ queryKey: ["admin", "open-shifts"] });
      qc.invalidateQueries({ queryKey: ["admin", "attendance"] });
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
  });

  const allSelected = shifts.length > 0 && shifts.every((s) => selected.has(key(s)));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(shifts.map(key)));
  }

  function toggleOne(s: OpenShift) {
    const next = new Set(selected);
    const k = key(s);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  }

  const running = mutation.isPending;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Jornadas sin cerrar"
        style={{ maxWidth: 760 }}
      >
        <div className="sheet-head">
          <div>
            <div className="sheet-title">Jornadas sin cerrar</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Marcaron entrada pero nunca salida. Sus horas no aparecen en ningún reporte.
            </div>
          </div>
          <button type="button" className="btn ghost btn-sm" onClick={onClose} disabled={running}>
            <IconSvg d={Icons.x} size={14} />
          </button>
        </div>

        <div className="sheet-body">
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Buscar en los últimos:</span>
            {RANGES.map((r) => (
              <button
                key={r.months}
                type="button"
                className={`chip ${months === r.months ? "active" : ""}`}
                onClick={() => {
                  setMonths(r.months);
                  setSelected(new Set());
                }}
                disabled={running}
              >
                {r.label}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
              {isLoading ? "Buscando…" : `${shifts.length} encontrada${shifts.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {result && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                borderRadius: "var(--r)",
                background: "color-mix(in srgb, var(--success) 12%, transparent)",
                fontSize: 12,
              }}
            >
              <strong style={{ color: "var(--success)" }}>
                {result.closed} jornada{result.closed === 1 ? "" : "s"} cerrada
                {result.closed === 1 ? "" : "s"}
              </strong>
              {result.skipped > 0 && ` · ${result.skipped} omitida(s)`}
              {result.failed > 0 && (
                <span style={{ color: "var(--danger)" }}> · {result.failed} con error</span>
              )}
              <div style={{ marginTop: 4, color: "var(--text-muted)" }}>
                Todo quedó registrado en{" "}
                <Link href="/admin/audit" style={{ textDecoration: "underline" }}>
                  auditoría
                </Link>
                , donde puedes revertir el lote completo si algo no cuadra.
              </div>
              {result.outcomes
                .filter((o) => o.status !== "closed")
                .slice(0, 5)
                .map((o) => (
                  <div key={key(o)} style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                    {o.workDate} · {o.employeeId.replace(/^EMP#/, "")} — {o.message}
                  </div>
                ))}
            </div>
          )}

          {isLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "32px 0", fontSize: 13, color: "var(--text-muted)" }}>
              <Spinner size={16} /> Buscando jornadas abiertas…
            </div>
          ) : shifts.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No hay jornadas sin cerrar en este período. 🎉
            </div>
          ) : (
            <>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: "var(--r)",
                  background: "var(--bg-subtle)",
                  fontSize: 12,
                  cursor: "pointer",
                  marginBottom: 6,
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={running}
                  style={{ accentColor: "var(--accent)" }}
                />
                Seleccionar las {shifts.length}
              </label>

              <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {shifts.map((s) => {
                  const checked = selected.has(key(s));
                  return (
                    <label
                      key={key(s)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--r)",
                        cursor: running ? "default" : "pointer",
                        background: checked ? "var(--accent-soft)" : "transparent",
                        border: `1px solid ${checked ? "color-mix(in srgb, var(--accent) 35%, transparent)" : "transparent"}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(s)}
                        disabled={running}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <NovaAvatar name={s.employeeName} size={26} variant="plain" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.employeeName}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {s.workDate}
                          {s.daysOpen > 0 && ` · ${s.daysOpen} día${s.daysOpen === 1 ? "" : "s"} abierta`}
                          {s.area ? ` · ${s.area}` : ""}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 11, flexShrink: 0 }}>
                        <div className="tcell-mono">
                          {hhmm(s.firstInLocal)} → <strong>{s.closeAt}</strong>
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {policy === "STRICT" ? "0h · sin registro" : `${fmtMinutes(s.workedMinutes)} · ${SOURCE_LABEL[s.closeSource]}`}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                  Cómo cerrarlas
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`chip ${policy === "SOFT" ? "active" : ""}`}
                    onClick={() => setPolicy("SOFT")}
                    disabled={running}
                    title="Completa la salida que falta y conserva las horas"
                  >
                    Conservar horas
                  </button>
                  <button
                    type="button"
                    className={`chip ${policy === "STRICT" ? "active" : ""}`}
                    onClick={() => setPolicy("STRICT")}
                    disabled={running}
                    title="No adivina la salida: marca el día como sin registro y cero horas"
                  >
                    Marcar sin registro
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, marginBottom: 0 }}>
                  {policy === "SOFT"
                    ? "Se completa la salida con la última marcación real del día, o con el fin de horario si no hubo ninguna posterior. Nunca se inventan horas futuras."
                    : "El día queda como sin registro y con cero horas. Úsalo cuando prefieras que el empleado justifique la jornada en vez de estimarla."}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn ghost btn-md" onClick={onClose} disabled={running}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn primary btn-md"
            onClick={() => mutation.mutate()}
            disabled={running || selected.size === 0}
          >
            {running ? (
              <>
                <Spinner size={14} /> Cerrando…
              </>
            ) : (
              <>
                <IconSvg d={Icons.check} size={14} />
                Cerrar {selected.size > 0 ? selected.size : ""} jornada{selected.size === 1 ? "" : "s"}
              </>
            )}
          </button>
        </div>

        {mutation.isError && (
          <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--danger)" }}>
            {(mutation.error as Error).message}
          </div>
        )}
      </div>
    </div>
  );
}
