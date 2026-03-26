import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getAllTenants } from "@/lib/db/tenants";
import { getAllEmployees } from "@/lib/db/employees";

export const GET = withErrorHandler(async () => {
  await requireSuperAdmin();
  const tenants = await getAllTenants();

  // Get employee count per tenant
  const tenantsWithCounts = await Promise.all(
    tenants.map(async (tenant) => {
      try {
        const employees = await getAllEmployees(tenant.TenantID);
        return { ...tenant, employeeCount: employees.length };
      } catch {
        return { ...tenant, employeeCount: 0 };
      }
    })
  );

  return NextResponse.json({ tenants: tenantsWithCounts });
});
