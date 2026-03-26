import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getDashboardMetrics } from "@/lib/services/dashboard.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  const user = await requireAdmin();
  const metrics = await getDashboardMetrics(user.tenantId);
  return NextResponse.json({ ok: true, ...metrics });
});
