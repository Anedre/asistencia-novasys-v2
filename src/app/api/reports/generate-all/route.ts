import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { generateConsolidatedReport } from "@/lib/services/report.service";
import { generateAllReportSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";

/**
 * POST /api/reports/generate-all
 *
 * Attendance register for the caller's tenant — a week or a month, every
 * employee or a hand-picked subset — in a single printable PDF, the document
 * handed to a SUNAFIL inspector.
 *
 * Admin-only, and the tenant is always taken from the session, never from the
 * request body: this endpoint dumps the whole company's attendance, so letting
 * a caller name the tenant would be a cross-tenant leak.
 */
export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();

  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Solo un administrador puede generar el reporte de toda la empresa" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = generateAllReportSchema.parse(body);

  const result = await generateConsolidatedReport({
    month: parsed.month,
    week: parsed.week,
    employeeIds: parsed.employeeIds,
    tenantId: user.tenantId,
  });

  return NextResponse.json({ ok: true, ...result });
});
