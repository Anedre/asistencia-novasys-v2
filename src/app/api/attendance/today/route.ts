import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getTodayStatus } from "@/lib/services/attendance.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const status = await getTodayStatus(user.employeeId);
  return NextResponse.json({ ok: true, ...status });
});
