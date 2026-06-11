import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { generateReport } from "@/lib/services/report.service";
import { generateReportSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";
import { assertEmployeeInTenant } from "@/lib/utils/authz";

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json();
  const parsed = generateReportSchema.parse(body);

  // Non-admin can only generate their own reports
  if (user.role !== "ADMIN" && parsed.employeeId !== user.employeeId) {
    return NextResponse.json(
      { ok: false, error: "Solo puedes generar reportes de tu propia asistencia" },
      { status: 403 }
    );
  }

  // Tenant isolation: an admin pulling someone else's report may only target an
  // employee inside their own tenant (employeeId is a guessable EMP#<email>).
  if (user.role === "ADMIN" && parsed.employeeId !== user.employeeId) {
    await assertEmployeeInTenant(parsed.employeeId, user);
  }

  const result = await generateReport({
    employeeId: parsed.employeeId,
    week: parsed.week,
    month: parsed.month,
    tenantId: user.tenantId,
  });

  return NextResponse.json({ ok: true, ...result });
});
