"use client";

import { useState } from "react";
import { useCreateRequest } from "@/hooks/use-requests";
import { useMyProfile } from "@/hooks/use-employee";
import { ALL_REASON_OPTIONS } from "@/lib/constants/reason-codes";
import type { RequestType, CreateRequestInput } from "@/lib/types";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaModal } from "@/components/nova/modal";
import { NovaDatePicker } from "@/components/nova/date-picker";

const TYPE_CARDS: {
  type: RequestType;
  label: string;
  icon: React.ReactNode;
  hint: string;
}[] = [
  { type: "VACATION", label: "Vacaciones", icon: Icons.beach, hint: "Días libres planificados" },
  { type: "PERMISSION", label: "Permiso", icon: Icons.coffee, hint: "Horas o días puntuales" },
  { type: "REGULARIZATION_SINGLE", label: "Regularización", icon: Icons.edit, hint: "Corregir marcación" },
];

/** Inclusive Mon–Fri workday count between two ISO dates. */
function workdaysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * "Nueva solicitud" as an on-brand sheet (per the handoff) — type cards +
 * conditional fields. Replaces the standalone /requests/new page. Reuses the
 * same useCreateRequest payload contract the page used.
 */
export function NewRequestSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createMutation = useCreateRequest();
  const { data: profile } = useMyProfile();
  const vacationBalance = profile?.employee?.vacationBalance ?? 0;

  const [type, setType] = useState<RequestType>("VACATION");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [permDate, setPermDate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isVacation = type === "VACATION";
  const isPermission = type === "PERMISSION";
  const isRegularize = type === "REGULARIZATION_SINGLE";
  const vacationDays = isVacation ? workdaysBetween(dateFrom, dateTo) : 0;

  function close() {
    setType("VACATION");
    setDateFrom("");
    setDateTo("");
    setPermDate("");
    setEffectiveDate("");
    setStartTime("09:00");
    setEndTime("18:00");
    setBreakMinutes(60);
    setReasonCode("");
    setReasonNote("");
    setError(null);
    createMutation.reset();
    onClose();
  }

  function validate(): string | null {
    if (isVacation) {
      if (!dateFrom) return "Selecciona la fecha de inicio";
      if (!dateTo) return "Selecciona la fecha de fin";
      if (dateTo < dateFrom) return "La fecha de fin no puede ser anterior a la de inicio";
    } else if (isPermission) {
      if (!permDate) return "Selecciona la fecha";
    } else {
      if (!effectiveDate) return "Selecciona la fecha a corregir";
      if (endTime <= startTime) return "La hora de salida debe ser mayor que la de entrada";
    }
    if (!reasonCode) return "Selecciona un motivo";
    return null;
  }

  function submit() {
    const e = validate();
    if (e) {
      setError(e);
      return;
    }
    setError(null);
    const payload: CreateRequestInput = {
      requestType: type,
      reasonCode,
      reasonNote: reasonNote.trim() || undefined,
    };
    if (isVacation) {
      payload.dateFrom = dateFrom;
      payload.dateTo = dateTo;
    } else if (isPermission) {
      payload.dateFrom = permDate;
      payload.dateTo = permDate;
    } else {
      payload.effectiveDate = effectiveDate;
      payload.startTime = startTime;
      payload.endTime = endTime;
      payload.breakMinutes = breakMinutes;
    }
    createMutation.mutate(payload, { onSuccess: () => close() });
  }

  return (
    <NovaModal
      open={open}
      onClose={close}
      title="Nueva solicitud"
      maxWidth={580}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={close}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={submit}
            disabled={createMutation.isPending}
          >
            <IconSvg d={Icons.send} size={14} />
            {createMutation.isPending ? "Enviando…" : "Enviar solicitud"}
          </button>
        </>
      }
    >
      {/* Type selector cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 18 }}>
        {TYPE_CARDS.map((t) => (
          <button
            key={t.type}
            type="button"
            className={`req-type-card ${type === t.type ? "active" : ""}`}
            onClick={() => setType(t.type)}
          >
            <div className="req-type-icon">
              <IconSvg d={t.icon} size={20} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{t.hint}</div>
          </button>
        ))}
      </div>

      {isVacation && (
        <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Desde<span className="req">*</span></label>
              <NovaDatePicker value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
            </div>
            <div className="form-group">
              <label className="form-label">Hasta<span className="req">*</span></label>
              <NovaDatePicker value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
            </div>
          </div>
          {vacationDays > 0 && (
            <div
              style={{
                padding: 12,
                background: "var(--accent-soft)",
                borderRadius: "var(--r)",
                display: "flex",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <IconSvg d={Icons.calendar} size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)" }}>
                  {vacationDays} {vacationDays === 1 ? "día hábil" : "días hábiles"}
                </strong>{" "}
                de tus <strong style={{ color: "var(--text-primary)" }}>{vacationBalance} disponibles</strong>.
                {vacationBalance - vacationDays >= 0 && ` Quedarán ${vacationBalance - vacationDays}.`}
              </div>
            </div>
          )}
        </>
      )}

      {isPermission && (
        <div className="form-group">
          <label className="form-label">Fecha<span className="req">*</span></label>
          <NovaDatePicker value={permDate} onChange={setPermDate} />
        </div>
      )}

      {isRegularize && (
        <>
          <div className="form-group">
            <label className="form-label">Fecha a corregir<span className="req">*</span></label>
            <NovaDatePicker value={effectiveDate} onChange={setEffectiveDate} />
          </div>
          <div className="fill-grid min-200">
            <div className="form-group">
              <label className="form-label">Entrada<span className="req">*</span></label>
              <input type="time" className="form-input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Salida<span className="req">*</span></label>
              <input type="time" className="form-input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Break (min)</label>
              <input type="number" min={0} max={120} className="form-input" value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} />
            </div>
          </div>
        </>
      )}

      <div className="form-group">
        <label className="form-label">Motivo<span className="req">*</span></label>
        <select className="form-select" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          <option value="" disabled>
            Selecciona un motivo
          </option>
          {ALL_REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">
          Nota adicional <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcional)</span>
        </label>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Describe brevemente la razón…"
          value={reasonNote}
          onChange={(e) => setReasonNote(e.target.value)}
        />
      </div>

      {(error || createMutation.isError) && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: "var(--r)",
            border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
            background: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
            fontSize: 13,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <IconSvg d={Icons.alert} size={15} />
          <span>{error || (createMutation.error as Error)?.message}</span>
        </div>
      )}
    </NovaModal>
  );
}
