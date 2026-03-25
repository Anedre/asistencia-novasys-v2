/**
 * Reason codes and labels for regularizations.
 * Ported from asistencia-regularize-range.py
 */

export const REASON_LABELS: Record<string, string> = {
  VACACIONES: "Vacaciones",
  VIAJE_TRABAJO: "Viaje de trabajo",
  DESCANSO_MEDICO: "Descanso médico",
  DESCANSO_PRENATAL: "Descanso pre-natal",
  DESCANSO_POSTNATAL: "Descanso post-natal",
  VISITA_CLIENTE: "Visita a cliente",
  COMISION_SERVICIO: "Comisión de servicio",
  OLVIDO_MARCACION: "Olvidó marcación",
  FALLA_SISTEMA: "Falla de sistema",
  CAPACITACION: "Capacitación",
  PERMISO: "Permiso",
  OTRO: "Otro",
  CARGA_INICIAL: "Carga inicial",
} as const;

/** Reasons that represent an absence (no hours worked) */
export const ABSENCE_REASONS = new Set([
  "VACACIONES",
  "DESCANSO_MEDICO",
  "DESCANSO_PRENATAL",
  "DESCANSO_POSTNATAL",
  "PERMISO",
]);

/** Reasons that represent a workday (hours were worked, just regularized) */
export const WORKDAY_REASONS = new Set([
  "VIAJE_TRABAJO",
  "VISITA_CLIENTE",
  "COMISION_SERVICIO",
  "OLVIDO_MARCACION",
  "FALLA_SISTEMA",
  "CAPACITACION",
  "OTRO",
  "CARGA_INICIAL",
]);

export type ReasonCode = keyof typeof REASON_LABELS;

/** Options formatted for select dropdowns */
export const ABSENCE_REASON_OPTIONS = Array.from(ABSENCE_REASONS).map((code) => ({
  value: code,
  label: REASON_LABELS[code],
}));

export const WORKDAY_REASON_OPTIONS = Array.from(WORKDAY_REASONS).map((code) => ({
  value: code,
  label: REASON_LABELS[code],
}));

export const ALL_REASON_OPTIONS = Object.entries(REASON_LABELS).map(([value, label]) => ({
  value,
  label,
}));
