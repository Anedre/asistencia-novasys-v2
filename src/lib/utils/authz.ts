/**
 * Tenant-isolation authorization helpers.
 *
 * Multi-tenancy was added after the app first shipped single-tenant, so some
 * legacy rows have no TenantID — those are treated as belonging to the default
 * "TENANT#novasys" tenant (the same fallback requireSession() applies to legacy
 * sessions). We throw NotFound (404), not Forbidden (403), so a caller can't use
 * the response to confirm that an id exists in another tenant.
 *
 * Use these whenever a handler acts on an object identified by a CLIENT-SUPPLIED
 * id (URL param or body) — `requireAdmin()` only proves the caller is *an* admin,
 * not that the target belongs to their tenant. EmployeeID is `EMP#<email>`, i.e.
 * guessable, so an unchecked id is a cross-tenant IDOR.
 */
import { getEmployeeById } from "@/lib/db/employees";
import { NotFoundError } from "@/lib/utils/errors";
import type { SessionUser } from "@/lib/auth-helpers";
import type { Employee } from "@/lib/types";

/** Legacy rows written before multi-tenancy belong to the original Novasys tenant. */
const DEFAULT_TENANT_ID = "TENANT#novasys";

/** Throw 404 unless `entityTenantId` resolves to the caller's tenant. */
export function assertSameTenant(
  entityTenantId: string | undefined | null,
  user: Pick<SessionUser, "tenantId">
): void {
  const owner = entityTenantId || DEFAULT_TENANT_ID;
  if (owner !== user.tenantId) {
    throw new NotFoundError("Recurso no encontrado");
  }
}

/**
 * Load an employee and assert it belongs to the caller's tenant. Returns the
 * loaded employee so callers can reuse it instead of fetching twice. Throws 404
 * if the employee doesn't exist or lives in another tenant.
 */
export async function assertEmployeeInTenant(
  employeeId: string,
  user: Pick<SessionUser, "tenantId">
): Promise<Employee> {
  const employee = await getEmployeeById(employeeId);
  if (!employee) {
    throw new NotFoundError("Empleado no encontrado");
  }
  assertSameTenant(employee.TenantID, user);
  return employee;
}
