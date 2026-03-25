import { z } from "zod";

// ── Attendance ──
export const recordEventSchema = z.object({
  eventType: z.enum(["START", "BREAK_START", "BREAK_END", "END"]),
  note: z.string().max(500).optional(),
  clientTime: z.string().optional(),
  deviceId: z.string().optional(),
});

// ── Regularization ──
export const regularizeSingleSchema = z.object({
  employeeId: z.string().min(1, "Falta employeeId"),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional(),
  breakMinutes: z.number().min(0).max(480).optional(),
  reasonCode: z.string().min(1, "Falta reasonCode"),
  reasonNote: z.string().max(500).optional(),
});

export const regularizeRangeSchema = z.object({
  employeeId: z.string().min(1, "Falta employeeId"),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM").optional(),
  breakMinutes: z.number().min(0).max(480).optional(),
  reasonCode: z.string().min(1, "Falta reasonCode"),
  reasonNote: z.string().max(500).optional(),
  weekdaysOnly: z.boolean().default(true),
  pastDatesOnly: z.boolean().default(true),
  overwrite: z.boolean().default(false),
});

// ── Requests ──
export const createRequestSchema = z.object({
  requestType: z.enum([
    "REGULARIZATION_SINGLE",
    "REGULARIZATION_RANGE",
    "PERMISSION",
    "VACATION",
  ]),
  effectiveDate: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  breakMinutes: z.number().min(0).max(480).optional(),
  reasonCode: z.string().min(1),
  reasonNote: z.string().max(500).optional(),
});

export const reviewRequestSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewerNote: z.string().max(500).optional(),
});

// ── Reports ──
export const generateReportSchema = z.object({
  employeeId: z.string().min(1),
  week: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
}).refine(
  (data) => (data.week && !data.month) || (!data.week && data.month),
  { message: "Envía solo week o solo month, no ambos" }
);

// ── HR Events ──
export const createHREventSchema = z.object({
  type: z.enum(["BIRTHDAY", "WORK_ANNIVERSARY", "ANNOUNCEMENT", "HOLIDAY"]),
  title: z.string().min(1).max(200),
  message: z.string().max(1000),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  audience: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

// ── Employee Profile ──
export const updateProfileSchema = z.object({
  Phone: z.string().max(20).optional(),
  AvatarUrl: z.string().url().optional(),
});

// ── System Settings ──
export const updateSettingSchema = z.object({
  SettingKey: z.string().min(1),
  value: z.unknown(),
});
