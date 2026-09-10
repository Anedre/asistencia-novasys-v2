import { z } from "zod";

/**
 * Restrict avatar / tenant logo / post image URLs to the configured S3 bucket.
 * Prevents attackers from pointing the image to a third-party host (tracking,
 * phishing avatars, content spoofing). Treats `null`/empty as "clear".
 */
const trustedImageHost = (() => {
  const bucket = process.env.REPORT_BUCKET || "novasys-v2-reports";
  return `${bucket}.s3.amazonaws.com`;
})();

const trustedImageUrl = z
  .string()
  .url()
  .refine(
    (u) => {
      try {
        const parsed = new URL(u);
        return (
          parsed.protocol === "https:" && parsed.hostname === trustedImageHost
        );
      } catch {
        return false;
      }
    },
    {
      message: `La imagen debe estar alojada en ${trustedImageHost}`,
    },
  );

// ── Attendance ──
export const recordEventSchema = z.object({
  eventType: z.enum(["START", "BREAK_START", "BREAK_END", "END"]),
  note: z.string().max(500).optional(),
  clientTime: z.string().optional(),
  customTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
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

const weekStr = z.string().regex(/^\d{4}-W\d{2}$/);
const monthStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const yearStr = z.string().regex(/^\d{4}$/);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * A report covers exactly one kind of period. They are kept as separate fields
 * rather than one union so the PDF Lambda receives them verbatim, and so an
 * older client that only knows `week`/`month` keeps working untouched.
 */
const periodShape = {
  week: weekStr.optional(),
  month: monthStr.optional(),
  /** Explicit, possibly non-contiguous months: enero, febrero y mayo. */
  months: z.array(monthStr).min(1).max(60).optional(),
  years: z.array(yearStr).min(1).max(10).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
};

type PeriodInput = {
  week?: string;
  month?: string;
  months?: string[];
  years?: string[];
  from?: string;
  to?: string;
};

/** Exactly one period family, and a range needs both of its ends. */
function periodIsValid(data: PeriodInput): boolean {
  const families = [
    Boolean(data.week),
    Boolean(data.month) || Boolean(data.months?.length),
    Boolean(data.years?.length),
    Boolean(data.from) || Boolean(data.to),
  ].filter(Boolean).length;

  if (families !== 1) return false;
  if (Boolean(data.from) !== Boolean(data.to)) return false;
  if (data.from && data.to && data.from > data.to) return false;
  return true;
}

const PERIOD_MESSAGE =
  "Envía un solo período: week, month/months, years o from+to";

export const generateReportSchema = z
  .object({ employeeId: z.string().min(1), ...periodShape })
  .refine(periodIsValid, { message: PERIOD_MESSAGE });

/**
 * Company-wide register over any period. No tenantId on purpose — it comes
 * from the session, never the body. `employeeIds` narrows it to a hand-picked
 * subset and `areas` to whole departments; omitting both means everyone.
 */
export const generateAllReportSchema = z
  .object({
    ...periodShape,
    employeeIds: z.array(z.string().min(1)).max(500).optional(),
    /** Area labels; matched accent-insensitively by the Lambda. */
    areas: z.array(z.string().min(1)).max(50).optional(),
    /** Column keys from the shared report-fields catalogue. */
    cols: z.array(z.string().min(1)).max(20).optional(),
    groupByArea: z.boolean().optional(),
    /**
     * Day-by-day blocks. Omitted means "let the Lambda decide" — it keeps them
     * for short periods and drops them for long ones, where they would run to
     * thousands of rows.
     */
    detail: z.boolean().optional(),
  })
  .refine(periodIsValid, { message: PERIOD_MESSAGE });

// ── HR Events ──
export const createHREventSchema = z.object({
  type: z.enum(["BIRTHDAY", "WORK_ANNIVERSARY", "ANNOUNCEMENT", "HOLIDAY"]),
  title: z.string().min(1).max(200),
  message: z.string().max(1000),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  audience: z.string().optional(),
  imageUrl: trustedImageUrl.optional(),
});

// ── Employee Profile ──
export const updateProfileSchema = z.object({
  FullName: z.string().min(2).max(100).optional(),
  FirstName: z.string().max(50).optional(),
  LastName: z.string().max(50).optional(),
  Phone: z.string().max(20).optional(),
  AvatarUrl: trustedImageUrl.optional(),
  DNI: z.string().max(20).optional(),
  Area: z.string().max(100).optional(),
  Position: z.string().max(100).optional(),
  WorkMode: z.enum(["REMOTE", "ONSITE", "HYBRID"]).optional(),
  BirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ScheduleType: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
  Schedule: z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    breakMinutes: z.number().min(0).max(480),
    type: z.string().optional(),
  }).optional(),
  Location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().max(500),
    formattedAddress: z.string().max(500),
  }).optional(),
});

// ── Admin Employee Management ──
export const updateEmployeeRoleSchema = z.object({
  role: z.enum(["ADMIN", "EMPLOYEE"]),
});

// ── System Settings ──
export const updateSettingSchema = z.object({
  SettingKey: z.string().min(1),
  value: z.unknown(),
});
