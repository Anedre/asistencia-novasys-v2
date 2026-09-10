import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getReportsStats } from "@/lib/services/reports-stats.service";
import { parseReportsQuery } from "@/lib/utils/reports-query";
import { withErrorHandler } from "@/lib/utils/errors";

/**
 * GET /api/admin/reports/stats
 *
 * Period: `months=` / `years=` / `from=&to=`.
 * Filters: `areas=`, `employees=`.
 *
 * Tenant always comes from the session, never the query string.
 */
export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const { query } = parseReportsQuery(new URL(req.url));

  const stats = await getReportsStats(user.tenantId, query);
  return NextResponse.json({ ok: true, ...stats });
});
