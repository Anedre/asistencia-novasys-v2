import type { EventType } from "@/lib/types";

export const EVENT_TYPES: Record<EventType, { label: string; emoji: string; color: string }> = {
  START: {
    label: "Entrada",
    emoji: "🟢",
    color: "text-green-600",
  },
  BREAK_START: {
    label: "Inicio Break",
    emoji: "☕",
    color: "text-yellow-600",
  },
  BREAK_END: {
    label: "Fin Break",
    emoji: "🔄",
    color: "text-blue-600",
  },
  END: {
    label: "Salida",
    emoji: "🔴",
    color: "text-red-600",
  },
} as const;

export const ALLOWED_EVENT_TYPES = new Set<EventType>([
  "START",
  "BREAK_START",
  "BREAK_END",
  "END",
]);

export const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  OPEN: { label: "En curso", variant: "default" },
  CLOSED: { label: "Cerrado", variant: "secondary" },
  REGULARIZED: { label: "Regularizado", variant: "outline" },
  ABSENCE: { label: "Ausencia", variant: "destructive" },
  OK: { label: "Completo", variant: "default" },
  SHORT: { label: "Incompleto", variant: "destructive" },
  MISSING: { label: "Sin registro", variant: "destructive" },
  NO_RECORD: { label: "Sin registro", variant: "outline" },
  "No Laborable": { label: "No Laborable", variant: "secondary" },
} as const;

export const REQUEST_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "outline" },
  APPROVED: { label: "Aprobado", variant: "default" },
  REJECTED: { label: "Rechazado", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
} as const;

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  REGULARIZATION_SINGLE: "Regularización (día)",
  REGULARIZATION_RANGE: "Regularización (rango)",
  PERMISSION: "Permiso",
  VACATION: "Vacaciones",
} as const;
