import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getHRDashboard } from "@/lib/services/hr.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request) => {
  await requireSession();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? undefined;
  const dashboard = await getHRDashboard(month);
  return NextResponse.json({ ok: true, ...dashboard });
});
