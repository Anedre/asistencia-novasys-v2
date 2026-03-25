import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getWeekSummary } from "@/lib/services/attendance.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const { searchParams } = new URL(req.url);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const summary = await getWeekSummary(user.employeeId, offset);
  return NextResponse.json({ ok: true, ...summary });
});
