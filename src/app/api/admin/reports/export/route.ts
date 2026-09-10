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
import { parseReportsQuery } from "@/lib/utils/reports-query";
import { DEFAULT_FIELDS } from "@/lib/constants/report-fields";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";

const VARIANTS: ExportVariant[] = [
  "all",
  "attendance",
  "hours",
  "absences",
  "payroll",
  "areas",
  "monthly",
  "yearly",
];

/**
 * GET /api/admin/reports/export
 *
 * Period: `months=` / `years=` / `from=&to=`.
 * Filters: `areas=`, `employees=`.
 * Shape: `variant=`, `cols=` (column picker), `group=area`, `format=xlsx|csv`.
 *
 * Tenant comes from the session, never from the query string — an admin can
 * only ever export their own tenant's data.
 */
export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const url = new URL(req.url);

  const format = (url.searchParams.get("format") || "xlsx").toLowerCase();
  const variant = (url.searchParams.get("variant") || "all") as ExportVariant;

  if (!VARIANTS.includes(variant)) {
    throw new ValidationError("Parámetro 'variant' inválido");
  }
  if (format !== "xlsx" && format !== "csv") {
    throw new ValidationError("Parámetro 'format' inválido (xlsx o csv)");
  }
  if (format === "csv" && variant === "all") {
    throw new ValidationError("El formato CSV requiere una vista concreta (variant)");
  }

  const defaultView = variant in DEFAULT_FIELDS ? (variant as keyof typeof DEFAULT_FIELDS) : "hours";
  const { query, fields, groupByArea } = parseReportsQuery(url, defaultView);

  const stats = await getReportsStats(user.tenantId, query);

  if (format === "csv") {
    const csv = buildReportsCsv(stats, variant as Exclude<ExportVariant, "all">, fields);
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

  const buffer = await buildReportsWorkbook(stats, {
    tenantName,
    variant,
    fields,
    groupByArea,
  });

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
