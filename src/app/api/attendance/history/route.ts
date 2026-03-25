import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getAttendanceHistory } from "@/lib/services/attendance.service";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  if (!dateFrom || !dateTo) {
    throw new ValidationError("Faltan parámetros dateFrom y dateTo");
  }

  const history = await getAttendanceHistory(user.employeeId, dateFrom, dateTo);
  return NextResponse.json({ ok: true, days: history });
});
