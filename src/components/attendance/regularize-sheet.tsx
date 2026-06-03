"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { ALL_REASON_OPTIONS } from "@/lib/constants/reason-codes";

/** Subset of AttendanceSummary the sheet needs. */
export interface RegularizeRow {
  employeeId: string;
  workDate: string;
  fullName: string;
  area?: string;
  avatarUrl?: string | null;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  status: string;
}

const REASONS = ALL_REASON_OPTIONS.filter((o) => o.value !== "CARGA_INICIAL");

/** Extract "HH:MM" from a plain time or a full ISO timestamp. */
function toHHMM(local: string | null): string {
  if (!local) return "";
  const t = local.includes("T") ? local.split("T")[1] : local;
  return (t ?? "").slice(0, 5);
}
function fmtMin(min: number): string {
  const m = Math.max(0, min);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  OPEN: { cls: "warn", label: "Abierta" },
  SHORT: { cls: "warn", label: "Corta" },
  MISSING: { cls: "danger", label: "Ausente" },
  ABSENCE: { cls: "danger", label: "Ausente" },
  ABSENT: { cls: "danger", label: "Ausente" },
  OK: { cls: "success", label: "OK" },
  COMPLETE: { cls: "success", label: "Completa" },
  COMPLETED: { cls: "success", label: "Completa" },
};
function statusMeta(s: string) {
  return STATUS_MAP[(s ?? "").toUpperCase()] ?? { cls: "muted", label: s || "—" };
}

/**
 * Admin "Regularizar marcación" sheet (per the handoff) — shows a live
 * before/after preview (Original → Nuevo with recomputed worked hours), the
 * adjustment form, and an audit notice. Applies via POST /api/regularization.
 */
export function RegularizeSheet({
  row,
  onClose,
}: {
  row: RegularizeRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [inT, setInT] = useState(toHHMM(row.firstInLocal) || "09:00");
  const [outT, setOutT] = useState(toHHMM(row.lastOutLocal) || "18:00");
  const [breakMin, setBreakMin] = useState(row.breakMinutes || 0);
  const [reasonCode, setReasonCode] = useState("OLVIDO_MARCACION");
  const [reasonNote, setReasonNote] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const [ih, im] = inT.split(":").map(Number);
  const [oh, om] = outT.split(":").map(Number);
  const newWorked = Math.max(0, oh * 60 + om - (ih * 60 + im) - (breakMin || 0));
  const orig = statusMeta(row.status);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: row.employeeId,
          workDate: row.workDate,
          startTime: inT,
          endTime: outT,
          breakMinutes: breakMin,
          reasonCode,
          reasonNote: reasonNote.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error al regularizar");
      return body as { message?: string };
    },
    onSuccess: (body) => {
      toast.success(body?.message || "Regularización aplicada");
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return (
            typeof k === "string" &&
            (k.includes("attendance") || k.includes("dashboard") || k.includes("audit"))
          );
        },
      });
      onClose();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Error al regularizar"),
  });

  const canSave = !!inT && !!outT && outT > inT && !!reasonCode;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Regularizar marcación"
      >
        <div className="sheet-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <NovaAvatar name={row.fullName} image={row.avatarUrl ?? undefined} size={36} variant="plain" />
            <div>
              <div className="sheet-title">Regularizar marcación</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {row.fullName} · {row.workDate}
                {row.area ? ` · ${row.area}` : ""}
              </div>
            </div>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Cerrar">
            <IconSvg d={Icons.x} size={16} />
          </button>
        </div>

        <div className="sheet-body">
          {/* Before / after preview */}
          <div className="reg-preview">
            <div className="reg-prev-col">
              <div className="reg-prev-label">Original</div>
              <div className="reg-prev-times">
                <span className="tcell-mono">{toHHMM(row.firstInLocal) || "—"}</span>
                <span className="time-sep">→</span>
                <span className="tcell-mono">{toHHMM(row.lastOutLocal) || "—"}</span>
              </div>
              <div className="reg-prev-worked">{fmtMin(row.workedMinutes)}</div>
              <span className={`type-tag ${orig.cls}`}>{orig.label}</span>
            </div>
            <div className="reg-prev-arrow">
              <IconSvg d={Icons.arrow} size={18} />
            </div>
            <div className="reg-prev-col new">
              <div className="reg-prev-label">Nuevo</div>
              <div className="reg-prev-times">
                <span className="tcell-mono">{inT}</span>
                <span className="time-sep">→</span>
                <span className="tcell-mono">{outT}</span>
              </div>
              <div className="reg-prev-worked accent">{fmtMin(newWorked)}</div>
              <span className="type-tag success">OK</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Entrada<span className="req">*</span></label>
              <input className="form-input" type="time" value={inT} onChange={(e) => setInT(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Salida<span className="req">*</span></label>
              <input className="form-input" type="time" value={outT} onChange={(e) => setOutT(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Break (min)</label>
              <input className="form-input" type="number" min={0} max={240} value={breakMin} onChange={(e) => setBreakMin(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo<span className="req">*</span></label>
              <select className="form-select" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                {REASONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Motivo<span className="req">*</span></label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Describe el motivo del ajuste para auditoría…"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
            />
          </div>

          <div
            style={{
              padding: 14,
              background: "color-mix(in srgb, var(--warn) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--warn) 25%, var(--border))",
              borderRadius: "var(--r)",
              display: "flex",
              gap: 10,
            }}
          >
            <IconSvg d={Icons.alert} size={16} style={{ color: "var(--warn)", flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Este ajuste se registrará en el log de auditoría con tu usuario y notificará al empleado.
            </div>
          </div>
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => mutation.mutate()}
            disabled={!canSave || mutation.isPending}
          >
            <IconSvg d={Icons.check} size={14} />
            {mutation.isPending ? "Guardando…" : "Guardar regularización"}
          </button>
        </div>
      </div>
    </div>
  );
}
