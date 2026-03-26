import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { regularizeRange } from "@/lib/services/regularization.service";
import { regularizeRangeSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const body = await req.json();
  const parsed = regularizeRangeSchema.parse(body);

  const result = await regularizeRange({
    employeeId: parsed.employeeId,
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    breakMinutes: parsed.breakMinutes,
    reasonCode: parsed.reasonCode,
    reasonNote: parsed.reasonNote,
    weekdaysOnly: parsed.weekdaysOnly,
    pastDatesOnly: parsed.pastDatesOnly,
    overwrite: parsed.overwrite,
    tenantId: user.tenantId,
  });

  return NextResponse.json({ ok: true, ...result });
});
