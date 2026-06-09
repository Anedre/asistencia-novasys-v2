"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCreateRequest } from "@/hooks/use-requests";
import { ALL_REASON_OPTIONS } from "@/lib/constants/reason-codes";
import { REQUEST_TYPE_LABELS } from "@/lib/constants/event-types";
import type { RequestType, CreateRequestInput } from "@/lib/types";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PageHeader } from "@/components/nova/page-header";
import { NovaDatePicker } from "@/components/nova/date-picker";

const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: "REGULARIZATION_SINGLE", label: REQUEST_TYPE_LABELS.REGULARIZATION_SINGLE },
  { value: "REGULARIZATION_RANGE", label: REQUEST_TYPE_LABELS.REGULARIZATION_RANGE },
  { value: "PERMISSION", label: REQUEST_TYPE_LABELS.PERMISSION },
  { value: "VACATION", label: REQUEST_TYPE_LABELS.VACATION },
];

const isRegularization = (type: RequestType) =>
  type === "REGULARIZATION_SINGLE" || type === "REGULARIZATION_RANGE";

const isRangeType = (type: RequestType) =>
  type === "REGULARIZATION_RANGE" || type === "PERMISSION" || type === "VACATION";

/**
 * Map URL ?type=... query param to internal RequestType.
 * Accepted values: vacation, permission, regularize, regularize-range
 */
function paramToRequestType(param: string | null): RequestType {
  switch (param) {
    case "vacation":
      return "VACATION";
    case "permission":
      return "PERMISSION";
    case "regularize-range":
      return "REGULARIZATION_RANGE";
    case "regularize":
      return "REGULARIZATION_SINGLE";
    default:
      return "REGULARIZATION_SINGLE";
  }
}

export default function NewRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createMutation = useCreateRequest();

  // Honor ?type= query param so contextual CTAs land on the right form
  const initialType = paramToRequestType(searchParams.get("type"));
  const initialDate = searchParams.get("date") || "";

  const [requestType, setRequestType] = useState<RequestType>(initialType);
  const [effectiveDate, setEffectiveDate] = useState(initialDate);
  const [dateFrom, setDateFrom] = useState(initialDate);
  const [dateTo, setDateTo] = useState(initialDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── Client-side validation ──
  function validate(): string | null {
    // Range types require dateFrom + dateTo with valid order
    if (isRangeType(requestType)) {
      if (!dateFrom) return "Selecciona la fecha de inicio";
      if (!dateTo) return "Selecciona la fecha de fin";
      if (dateTo < dateFrom) return "La fecha de fin no puede ser anterior a la de inicio";
    } else {
      if (!effectiveDate) return "Selecciona la fecha a regularizar";
    }

    // Regularization types require valid time order
    if (isRegularization(requestType)) {
      if (!startTime || !endTime) return "Indica las horas de entrada y salida";
      if (endTime <= startTime) return "La hora de salida debe ser mayor que la de entrada";
      // Break can't exceed total worked time
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const totalMin = (eh * 60 + em) - (sh * 60 + sm);
      if (breakMinutes > totalMin) return "El break no puede ser mayor que el tiempo trabajado";
      if (breakMinutes < 0) return "El break no puede ser negativo";
    }

    if (!reasonCode) return "Selecciona un motivo";

    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const error = validate();
    if (error) {
      setValidationError(error);
      return;
    }

    const payload: CreateRequestInput = {
      requestType,
      reasonCode,
      reasonNote: reasonNote.trim() || undefined,
    };

    if (isRangeType(requestType)) {
      payload.dateFrom = dateFrom;
      payload.dateTo = dateTo;
    } else {
      payload.effectiveDate = effectiveDate;
    }

    if (isRegularization(requestType)) {
      payload.startTime = startTime;
      payload.endTime = endTime;
      payload.breakMinutes = breakMinutes;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        router.push("/requests");
      },
    });
  };

  return (
    <>
      {/* PageHeader */}
      <PageHeader
        breadcrumb={[
          { label: "Mis solicitudes", href: "/requests" },
          { label: "Nueva" },
        ]}
        title="Nueva solicitud"
        subtitle="Crea una nueva solicitud de regularización o permiso."
        actions={
          <Link href="/requests" className="btn outline btn-sm">
            <IconSvg d={Icons.arrowLeft} size={14} />
            Volver
          </Link>
        }
      />

      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="panel-title">Datos de la solicitud</div>
        <div className="panel-sub" style={{ marginBottom: 16 }}>
          Completa los campos para enviar tu solicitud
        </div>

        <form onSubmit={handleSubmit}>
          {/* Request Type */}
          <div className="form-group">
            <label className="form-label" htmlFor="requestType">
              Tipo de solicitud<span className="req">*</span>
            </label>
            <select
              id="requestType"
              className="form-select"
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequestType)}
            >
              {REQUEST_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date fields */}
          {isRangeType(requestType) ? (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="dateFrom">
                  Fecha inicio<span className="req">*</span>
                </label>
                <NovaDatePicker value={dateFrom} onChange={setDateFrom} max={dateTo || undefined} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="dateTo">
                  Fecha fin<span className="req">*</span>
                </label>
                <NovaDatePicker value={dateTo} onChange={setDateTo} min={dateFrom || undefined} />
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label" htmlFor="effectiveDate">
                Fecha<span className="req">*</span>
              </label>
              <NovaDatePicker value={effectiveDate} onChange={setEffectiveDate} />
            </div>
          )}

          {/* Time fields — only for regularizations */}
          {isRegularization(requestType) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="startTime">
                  Hora entrada<span className="req">*</span>
                </label>
                <input
                  id="startTime"
                  className="form-input"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="endTime">
                  Hora salida<span className="req">*</span>
                </label>
                <input
                  id="endTime"
                  className="form-input"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="breakMinutes">
                  Break (min)
                </label>
                <input
                  id="breakMinutes"
                  className="form-input"
                  type="number"
                  min={0}
                  max={120}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Reason Code */}
          <div className="form-group">
            <label className="form-label" htmlFor="reasonCode">
              Motivo<span className="req">*</span>
            </label>
            <select
              id="reasonCode"
              className="form-select"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecciona un motivo
              </option>
              {ALL_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Note */}
          <div className="form-group">
            <label className="form-label" htmlFor="reasonNote">
              Nota adicional (opcional)
            </label>
            <textarea
              id="reasonNote"
              className="form-textarea"
              placeholder="Detalle adicional sobre tu solicitud..."
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              rows={3}
            />
          </div>

          {/* Validation error (client-side) */}
          {validationError && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r)",
                border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
                background: "color-mix(in srgb, var(--warning) 10%, transparent)",
                color: "var(--warning)",
                fontSize: 13,
                marginBottom: 14,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <IconSvg d={Icons.alert} size={15} />
              <span>{validationError}</span>
            </div>
          )}

          {/* Error message (server-side) */}
          {createMutation.isError && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r)",
                border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                color: "var(--danger)",
                fontSize: 13,
                marginBottom: 14,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <IconSvg d={Icons.alert} size={15} />
              <span>{(createMutation.error as Error).message}</span>
            </div>
          )}

          {/* Submit */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 8,
            }}
          >
            <Link href="/requests" className="btn outline">
              Cancelar
            </Link>
            <button
              type="submit"
              className="btn primary"
              disabled={createMutation.isPending}
            >
              <IconSvg d={Icons.send} size={14} />
              {createMutation.isPending ? "Enviando..." : "Enviar solicitud"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
