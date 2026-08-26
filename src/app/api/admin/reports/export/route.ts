import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getReportsStats } from "@/lib/services/reports-stats.service";
import { getTenantById } from "@/lib/db/tenants";
import {
  buildReportsWorkbook,
  buildReportsCsv,
  exportFilename,
  type ExportVariant,
} from "@/lib/services/reports-export.service";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VARIANTS: ExportVariant[] = ["all", "attendance", "hours", "absences", "payroll"];

/**
 * GET /api/admin/reports/export?from=&to=&format=xlsx|csv&variant=
 *
 * Tenant comes from the session, never from the query string — an admin can
 * only ever export their own tenant's data.
 */
export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const url = new URL(req.url);

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const format = (url.searchParams.get("format") || "xlsx").toLowerCase();
  const variant = (url.searchParams.get("variant") || "all") as ExportVariant;
  const area = url.searchParams.get("area") || undefined;

  if (!from || !DATE_RE.test(from)) {
    throw new ValidationError("Parámetro 'from' inválido (formato YYYY-MM-DD)");
  }
  if (!to || !DATE_RE.test(to)) {
    throw new ValidationError("Parámetro 'to' inválido (formato YYYY-MM-DD)");
  }
  if (from > to) {
    throw new ValidationError("'from' no puede ser posterior a 'to'");
  }
  if (!VARIANTS.includes(variant)) {
    throw new ValidationError("Parámetro 'variant' inválido");
  }
  if (format !== "xlsx" && format !== "csv") {
    throw new ValidationError("Parámetro 'format' inválido (xlsx o csv)");
  }
  if (format === "csv" && variant === "all") {
    throw new ValidationError("El formato CSV requiere una vista concreta (variant)");
  }

  const stats = await getReportsStats(user.tenantId, from, to, area);

  if (format === "csv") {
    const csv = buildReportsCsv(stats, variant as Exclude<ExportVariant, "all">);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(stats, variant, "csv")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const tenant = await getTenantById(user.tenantId).catch(() => null);
  const tenantName =
    tenant?.settings?.legalName || tenant?.name || tenant?.tenantName || user.tenantSlug;

  const buffer = await buildReportsWorkbook(stats, { tenantName, variant });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFilename(stats, variant, "xlsx")}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
});
