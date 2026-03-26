import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { regularizeSingle } from "@/lib/services/regularization.service";
import { regularizeSingleSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const body = await req.json();
  const parsed = regularizeSingleSchema.parse(body);

  const result = await regularizeSingle({
    employeeId: parsed.employeeId,
    workDate: parsed.workDate,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    breakMinutes: parsed.breakMinutes,
    reasonCode: parsed.reasonCode,
    reasonNote: parsed.reasonNote,
    tenantId: user.tenantId,
  });

  return NextResponse.json({ ok: true, ...result });
});
