import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getTenantById } from "@/lib/db/tenants";
import { getAllEmployees } from "@/lib/db/employees";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { TABLES } from "@/lib/db/tables";

export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireSuperAdmin();
    const { id } = await params;

    const tenantId = decodeURIComponent(id);
    const tenant = await getTenantById(tenantId);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
    }

    const employees = await getAllEmployees(tenantId);

    return NextResponse.json({ tenant, employeeCount: employees.length });
  }
);

export const PUT = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireSuperAdmin();
    const { id } = await params;
    const body = await request.json();

    const tenantId = decodeURIComponent(id);
    const { status, plan, maxEmployees } = body as {
      status?: "ACTIVE" | "SUSPENDED";
      plan?: "FREE" | "PRO" | "ENTERPRISE";
      maxEmployees?: number;
    };

    const updates: string[] = [];
    const values: Record<string, unknown> = { ":now": new Date().toISOString() };

    if (status) { updates.push("#st = :st"); values[":st"] = status; }
    if (plan) { updates.push("plan = :plan"); values[":plan"] = plan; }
    if (maxEmployees !== undefined) { updates.push("maxEmployees = :me"); values[":me"] = maxEmployees; }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay cambios" }, { status: 400 });
    }

    updates.push("updatedAt = :now");

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.TENANTS,
        Key: { TenantID: tenantId },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeNames: status ? { "#st": "status" } : undefined,
        ExpressionAttributeValues: values,
      })
    );

    return NextResponse.json({ ok: true });
  }
);
