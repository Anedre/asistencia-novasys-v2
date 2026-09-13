/**
 * Report generation service.
 * Invokes the Python PDF Lambda and returns presigned URL.
 */

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getTenantById } from "@/lib/db/tenants";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { areaKey } from "@/lib/utils/area";
import { getHolidaySet } from "@/lib/utils/holidays";
import { AppError, ValidationError } from "@/lib/utils/errors";

const lambda = new LambdaClient({
  region: process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...((process.env.CUSTOM_ACCESS_KEY_ID && process.env.CUSTOM_SECRET_ACCESS_KEY) && {
    credentials: {
      accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
      secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
    },
  }),
});

/**
 * The stretch of time a report covers. Exactly one of these families is set;
 * they are forwarded to the Lambda verbatim, which owns the interpretation
 * (see `resolve_period` in lambda/pdf-report/handler.py).
 */
export interface ReportPeriod {
  week?: string; // "2026-W12"
  month?: string; // "2026-03"
  /** Explicit, possibly non-contiguous months — enero, febrero y mayo. */
  months?: string[];
  years?: string[]; // ["2025", "2026"]
  from?: string; // "2026-03-01"
  to?: string; // "2026-05-31"
}

interface GenerateReportParams extends ReportPeriod {
  employeeId: string;
  tenantId?: string;
}

interface ConsolidatedReportParams extends ReportPeriod {
  tenantId: string;
  /**
   * Optional hand-picked subset. Absent means the whole company; when present,
   * ONLY these people appear — nobody is added back for having attendance.
   */
  employeeIds?: string[];
  /** Whole departments. Combines with employeeIds as an intersection. */
  areas?: string[];
  /** Summary column keys, from the shared report-fields catalogue. */
  cols?: string[];
  groupByArea?: boolean;
  /** Day-by-day blocks. Undefined lets the Lambda decide by period length. */
  detail?: boolean;
}

/** Period fields as the Lambda's query string expects them. */
function periodQuery(p: ReportPeriod): Record<string, string> {
  const q: Record<string, string> = {};
  if (p.week) q.week = p.week;
  if (p.month) q.month = p.month;
  if (p.months?.length) q.months = p.months.join(",");
  if (p.years?.length) q.years = p.years.join(",");
  if (p.from) q.from = p.from;
  if (p.to) q.to = p.to;
  return q;
}

interface ReportResult {
  url: string;
  s3Key: string;
  reportType: string;
  employeeId: string;
  fromDate: string;
  toDate: string;
}

interface ConsolidatedReportResult {
  url: string;
  s3Key: string;
  reportType: string;
  employeeCount: number;
  fromDate: string;
  toDate: string;
}

/**
 * Company legal name + RUC for the PDF header. Resolved here rather than in the
 * Lambda so the Lambda keeps a minimal IAM scope (no access to the tenant table).
 */
async function resolveCompany(tenantId?: string) {
  if (!tenantId) return { companyName: "", companyRuc: "" };
  const tid = tenantId.startsWith("TENANT#") ? tenantId : `TENANT#${tenantId}`;
  try {
    const tenant = await getTenantById(tid);
    return {
      companyName: tenant?.settings?.legalName || tenant?.name || tenant?.tenantName || "",
      companyRuc: tenant?.settings?.ruc || "",
    };
  } catch {
    /* fall back to defaults in the Lambda */
    return { companyName: "", companyRuc: "" };
  }
}

/**
 * Holidays as the Lambda wants them: {"YYYY-MM-DD": "Fiestas Patrias"}.
 * Resolved here, like the company name, because the tenant table is ours to
 * read and the Lambda's role is deliberately not granted access to it. A
 * holiday the PDF does not know about prints as "Sin registro" — an absence,
 * to anyone reading it.
 */
async function resolveHolidays(tenantId?: string): Promise<Record<string, string>> {
  if (!tenantId) return {};
  const tid = tenantId.startsWith("TENANT#") ? tenantId : `TENANT#${tenantId}`;
  try {
    return Object.fromEntries(await getHolidaySet(tid));
  } catch {
    // Better an unlabelled holiday than no report at all.
    return {};
  }
}

/** Shape returned inside the Lambda's API-Gateway-style `body`. */
interface PdfLambdaBody {
  ok: boolean;
  error?: string;
  url: string;
  s3Key: string;
  reportType: string;
  employeeId?: string;
  employeeCount?: number;
  fromDate: string;
  toDate: string;
}

/**
 * Invoke the PDF Lambda and unwrap its API-Gateway-shaped response.
 *
 * Failures are raised as AppError, never a bare Error: `errorResponse` maps an
 * unrecognised Error to a blank 500 "Error interno del servidor", which turned
 * a plain "Falta employeeKey" from a stale Lambda into an unreadable 500 in the
 * browser. Admins need to see what the Lambda actually said.
 */
async function invokePdfLambda(
  queryStringParameters: Record<string, string>,
  extraPayload: Record<string, unknown> = {}
): Promise<PdfLambdaBody> {
  const functionName = process.env.PDF_LAMBDA_FUNCTION_NAME;
  if (!functionName) {
    throw new AppError("PDF_LAMBDA_FUNCTION_NAME no configurado", 500, "PDF_LAMBDA_UNCONFIGURED");
  }

  const result = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: new TextEncoder().encode(
        JSON.stringify({ queryStringParameters, ...extraPayload })
      ),
    })
  );

  if (result.FunctionError) {
    const errorPayload = new TextDecoder().decode(result.Payload);
    throw new AppError(`El Lambda de PDF falló: ${errorPayload}`, 502, "PDF_LAMBDA_ERROR");
  }

  const responsePayload = JSON.parse(new TextDecoder().decode(result.Payload));
  const body = JSON.parse(responsePayload.body);

  if (!body.ok) {
    throw new AppError(body.error || "Error generando reporte", 502, "PDF_LAMBDA_ERROR");
  }
  return body;
}

export async function generateReport(
  params: GenerateReportParams
): Promise<ReportResult> {
  const employeeKey = params.employeeId.replace("EMP#", "");
  const [{ companyName, companyRuc }, holidays] = await Promise.all([
    resolveCompany(params.tenantId),
    resolveHolidays(params.tenantId),
  ]);

  const body = await invokePdfLambda(
    {
      employeeKey,
      ...periodQuery(params),
      ...(params.tenantId && { tenantId: params.tenantId }),
      ...(companyName && { companyName }),
      ...(companyRuc && { companyRuc }),
    },
    { holidays }
  );

  return {
    url: body.url,
    s3Key: body.s3Key,
    reportType: body.reportType,
    employeeId: body.employeeId ?? params.employeeId,
    fromDate: body.fromDate,
    toDate: body.toDate,
  };
}

/**
 * Attendance register covering the tenant's staff over any period, in a single
 * printable PDF (`scope=tenant`). Narrow it with `employeeIds` (hand-picked
 * people), `areas` (whole departments), or both.
 *
 * Built for SUNAFIL inspections, so the Lambda renders it without the "Estado"
 * and "Obs." columns of the per-employee report: no regularization badges and
 * no internal notes, just the hours actually worked.
 */
export async function generateConsolidatedReport(
  params: ConsolidatedReportParams
): Promise<ConsolidatedReportResult> {
  const [{ companyName, companyRuc }, employees, holidays] = await Promise.all([
    resolveCompany(params.tenantId),
    // The active roster is resolved HERE, not in the Lambda. Listing staff by
    // tenant needs a Query on the Employees GSI, and the Lambda's role is only
    // granted GetItem on the table itself — same reason the company name and
    // RUC are passed in. Sending the list keeps its IAM scope untouched.
    getAllActiveEmployees(params.tenantId),
    resolveHolidays(params.tenantId),
  ]);

  const picked = params.employeeIds?.length ? new Set(params.employeeIds) : null;
  // Accent-insensitive, so a report filtered on "Consultoría" also catches the
  // records typed as "Consultoria".
  const wantedAreas = params.areas?.length
    ? new Set(params.areas.map(areaKey).filter(Boolean))
    : null;

  const roster = employees
    .filter((e) => !picked || picked.has(e.EmployeeID))
    .filter((e) => !wantedAreas || wantedAreas.has(areaKey(e.Area)))
    .map((e) => ({
      employeeId: e.EmployeeID,
      fullName: e.FullName,
      dni: e.DNI,
      area: e.Area,
      position: e.Position,
      email: e.Email,
    }));

  if ((picked || wantedAreas) && roster.length === 0) {
    throw new ValidationError(
      picked
        ? "Ninguno de los empleados seleccionados pertenece a tu empresa"
        : "Ningún empleado pertenece a las áreas seleccionadas"
    );
  }

  const body = await invokePdfLambda(
    {
      scope: "tenant",
      ...periodQuery(params),
      tenantId: params.tenantId,
      ...(params.areas?.length && { areas: params.areas.join(",") }),
      ...(params.cols?.length && { cols: params.cols.join(",") }),
      ...(params.groupByArea && { groupByArea: "1" }),
      ...(params.detail !== undefined && { detail: params.detail ? "1" : "0" }),
      ...(companyName && { companyName }),
      ...(companyRuc && { companyRuc }),
    },
    // rosterOnly stops the Lambda from re-adding anyone with attendance who is
    // not on the list — otherwise an explicit exclusion would be undone. An
    // area filter does NOT set it: someone who left mid-period still belongs in
    // their area's register, and the Lambda applies the same area filter to
    // whoever it pulls in.
    { roster, rosterOnly: Boolean(picked), holidays }
  );

  return {
    url: body.url,
    s3Key: body.s3Key,
    reportType: body.reportType,
    employeeCount: Number(body.employeeCount) || 0,
    fromDate: body.fromDate,
    toDate: body.toDate,
  };
}
