/**
 * Report generation service.
 * Invokes the Python PDF Lambda and returns presigned URL.
 */

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

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

interface ReportResult {
  url: string;
  s3Key: string;
  reportType: string;
  employeeId: string;
  fromDate: string;
  toDate: string;
}

export async function generateReport(
  params: GenerateReportParams
): Promise<ReportResult> {
  const functionName = process.env.PDF_LAMBDA_FUNCTION_NAME;
  if (!functionName) {
    throw new Error("PDF_LAMBDA_FUNCTION_NAME no configurado");
  }

  const employeeKey = params.employeeId.replace("EMP#", "");

  const payload = {
    queryStringParameters: {
      employeeKey,
      ...(params.week && { week: params.week }),
      ...(params.month && { month: params.month }),
      ...(params.tenantId && { tenantId: params.tenantId }),
    },
  };

  const result = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    })
  );

  if (result.FunctionError) {
    const errorPayload = new TextDecoder().decode(result.Payload);
    throw new Error(`Lambda error: ${errorPayload}`);
  }

  const responsePayload = JSON.parse(
    new TextDecoder().decode(result.Payload)
  );
  const body = JSON.parse(responsePayload.body);

  if (!body.ok) {
    throw new Error(body.error || "Error generando reporte");
  }

  return {
    url: body.url,
    s3Key: body.s3Key,
    reportType: body.reportType,
    employeeId: body.employeeId,
    fromDate: body.fromDate,
    toDate: body.toDate,
  };
}
