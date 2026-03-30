/**
 * AI Tool definitions for Bedrock Converse API.
 * Each tool maps to a real action in the system.
 */

import type { Tool } from "@aws-sdk/client-bedrock-runtime";

export const AI_TOOLS: Tool[] = [
  {
    toolSpec: {
      name: "create_regularization_request",
      description:
        "Crea una solicitud de regularización de asistencia para el empleado. Usa esto cuando el empleado pida regularizar una fecha específica o un rango de fechas. La solicitud quedará PENDIENTE hasta que un administrador la apruebe.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            requestType: {
              type: "string",
              enum: ["REGULARIZATION_SINGLE", "REGULARIZATION_RANGE"],
              description:
                "REGULARIZATION_SINGLE para un solo día, REGULARIZATION_RANGE para varios días.",
            },
            effectiveDate: {
              type: "string",
              description:
                "Fecha a regularizar en formato YYYY-MM-DD. Solo para REGULARIZATION_SINGLE.",
            },
            dateFrom: {
              type: "string",
              description:
                "Fecha inicio en formato YYYY-MM-DD. Solo para REGULARIZATION_RANGE.",
            },
            dateTo: {
              type: "string",
              description:
                "Fecha fin en formato YYYY-MM-DD. Solo para REGULARIZATION_RANGE.",
            },
            startTime: {
              type: "string",
              description:
                "Hora de entrada en formato HH:mm (ej: 09:00). Requerido para regularización de día laboral.",
            },
            endTime: {
              type: "string",
              description:
                "Hora de salida en formato HH:mm (ej: 18:00). Requerido para regularización de día laboral.",
            },
            breakMinutes: {
              type: "number",
              description: "Minutos de break (ej: 60). Por defecto 60.",
            },
            reasonCode: {
              type: "string",
              enum: [
                "OLVIDO_MARCACION",
                "FALLA_SISTEMA",
                "VIAJE_TRABAJO",
                "VISITA_CLIENTE",
                "COMISION_SERVICIO",
                "CAPACITACION",
                "OTRO",
              ],
              description: "Código del motivo de la regularización.",
            },
            reasonNote: {
              type: "string",
              description: "Nota o comentario adicional sobre el motivo.",
            },
          },
          required: ["requestType", "reasonCode"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "create_permission_request",
      description:
        "Crea una solicitud de permiso o vacaciones para el empleado. Usa esto cuando el empleado pida permiso para ausentarse o solicite vacaciones.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            requestType: {
              type: "string",
              enum: ["PERMISSION", "VACATION"],
              description: "PERMISSION para permisos, VACATION para vacaciones.",
            },
            dateFrom: {
              type: "string",
              description: "Fecha inicio en formato YYYY-MM-DD.",
            },
            dateTo: {
              type: "string",
              description: "Fecha fin en formato YYYY-MM-DD.",
            },
            reasonCode: {
              type: "string",
              enum: [
                "VACACIONES",
                "DESCANSO_MEDICO",
                "DESCANSO_PRENATAL",
                "DESCANSO_POSTNATAL",
                "PERMISO",
                "OTRO",
              ],
              description: "Código del motivo.",
            },
            reasonNote: {
              type: "string",
              description: "Detalle o comentario adicional.",
            },
          },
          required: ["requestType", "dateFrom", "dateTo", "reasonCode"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "check_attendance_today",
      description:
        "Consulta el estado de asistencia del día de hoy del empleado. Devuelve si marcó entrada, salida, horas trabajadas, etc.",
      inputSchema: {
        json: {
          type: "object",
          properties: {},
        },
      },
    },
  },
  {
    toolSpec: {
      name: "check_attendance_week",
      description:
        "Consulta el resumen de asistencia de la semana actual del empleado. Devuelve horas trabajadas, balance semanal, y detalle por día.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            weekOffset: {
              type: "number",
              description:
                "Offset de semanas. 0 = semana actual, -1 = semana anterior, etc.",
            },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "check_my_requests",
      description:
        "Consulta las solicitudes del empleado (regularizaciones, permisos, vacaciones). Devuelve el estado de cada una (PENDING, APPROVED, REJECTED, CANCELLED).",
      inputSchema: {
        json: {
          type: "object",
          properties: {},
        },
      },
    },
  },
  {
    toolSpec: {
      name: "record_attendance",
      description:
        "Registra un evento de asistencia (marcar entrada, inicio/fin de break, marcar salida). Usa esto cuando el empleado quiera marcar su asistencia desde el chat.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            eventType: {
              type: "string",
              enum: ["START", "BREAK_START", "BREAK_END", "END"],
              description:
                "START=entrada, BREAK_START=inicio break, BREAK_END=fin break, END=salida.",
            },
          },
          required: ["eventType"],
        },
      },
    },
  },
];

export type ToolName =
  | "create_regularization_request"
  | "create_permission_request"
  | "check_attendance_today"
  | "check_attendance_week"
  | "check_my_requests"
  | "record_attendance";
