/**
 * Report generation service.
 * Invokes the Python PDF Lambda and returns presigned URL.
 */

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getTenantById } from "@/lib/db/tenants";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { AppError } from "@/lib/utils/errors";

const lambda = new LambdaClient({
  region: process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...((process.env.CUSTOM_ACCESS_KEY_ID && process.env.CUSTOM_SECRET_ACCESS_KEY) && {
    credentials: {
      accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
      secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
    },
  }),
});

interface GenerateReportParams {
  employeeId: string;
  week?: string; // "2026-W12"
  month?: string; // "2026-03"
  tenantId?: string;
}

interface ConsolidatedReportParams {
  month: string; // "2026-03"
  tenantId: string;
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
  const { companyName, companyRuc } = await resolveCompany(params.tenantId);

  const body = await invokePdfLambda({
    employeeKey,
    ...(params.week && { week: params.week }),
    ...(params.month && { month: params.month }),
    ...(params.tenantId && { tenantId: params.tenantId }),
    ...(companyName && { companyName }),
    ...(companyRuc && { companyRuc }),
  });

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
 * Monthly attendance register covering every employee of the tenant, in a
 * single printable PDF (`scope=tenant`).
 *
 * Built for SUNAFIL inspections, so the Lambda renders it without the "Estado"
 * and "Obs." columns of the per-employee report: no regularization badges and
 * no internal notes, just the hours actually worked.
 */
export async function generateConsolidatedReport(
  params: ConsolidatedReportParams
): Promise<ConsolidatedReportResult> {
  const [{ companyName, companyRuc }, employees] = await Promise.all([
    resolveCompany(params.tenantId),
    // The active roster is resolved HERE, not in the Lambda. Listing staff by
    // tenant needs a Query on the Employees GSI, and the Lambda's role is only
    // granted GetItem on the table itself — same reason the company name and
    // RUC are passed in. Sending the list keeps its IAM scope untouched.
    getAllActiveEmployees(params.tenantId),
  ]);

  const roster = employees.map((e) => ({
    employeeId: e.EmployeeID,
    fullName: e.FullName,
    dni: e.DNI,
    area: e.Area,
    position: e.Position,
  }));

  const body = await invokePdfLambda(
    {
      scope: "tenant",
      month: params.month,
      tenantId: params.tenantId,
      ...(companyName && { companyName }),
      ...(companyRuc && { companyRuc }),
    },
    { roster }
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
