/**
 * Shared identity resolution for every login path.
 *
 * The web app signs in through NextAuth and carries a session cookie; the
 * native Android client signs in against Cognito directly and sends an ID
 * token. Both end up here on purpose: `role` and `tenantId` decide what the
 * caller is allowed to touch, so the two paths must never resolve them
 * differently.
 */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { TABLES, INDEXES } from "@/lib/db/tables";
import type { UserRole } from "@/lib/auth";

/** A Cognito user mapped onto their employee row. */
export interface EmployeeIdentity {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  area: string;
  employeeId: string;
  tenantId: string;
  tenantSlug: string;
}

/** The verified claims each login path hands in. */
export interface CognitoIdentity {
  sub: string;
  email: string;
  name: string;
}

const DEFAULT_TENANT_ID = "TENANT#novasys";

export async function findEmployeeByCognitoSub(sub: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EMPLOYEES,
      IndexName: INDEXES.EMPLOYEES_COGNITO_SUB,
      KeyConditionExpression: "CognitoSub = :sub",
      ExpressionAttributeValues: { ":sub": sub },
      Limit: 1,
    })
  );
  return result.Items?.[0] ?? null;
}

export async function findEmployeeByEmail(email: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EMPLOYEES,
      IndexName: INDEXES.EMPLOYEES_EMAIL,
      KeyConditionExpression: "Email = :email",
      ExpressionAttributeValues: { ":email": email.toLowerCase() },
      Limit: 1,
    })
  );
  return result.Items?.[0] ?? null;
}

/** Derive the tenant slug from a TenantID (e.g. "TENANT#novasys" → "novasys"). */
export function tenantSlugFromId(tenantId: string): string {
  return tenantId.replace("TENANT#", "");
}

/**
 * Map verified Cognito claims onto the employee row in DynamoDB.
 *
 * Looks up by Cognito sub first and falls back to email, because employees
 * invited before the CognitoSub index existed only carry an email.
 */
export async function resolveEmployeeIdentity(
  cognito: CognitoIdentity
): Promise<EmployeeIdentity> {
  let employee = await findEmployeeByCognitoSub(cognito.sub);
  if (!employee) {
    employee = await findEmployeeByEmail(cognito.email);
  }

  if (employee) {
    const tenantId = employee.TenantID || DEFAULT_TENANT_ID;
    return {
      id: employee.EmployeeID,
      email: cognito.email,
      name: employee.FullName || cognito.name,
      role: (employee.Role as UserRole) || "EMPLOYEE",
      area: employee.Area || "",
      employeeId: employee.EmployeeID,
      tenantId,
      tenantSlug: tenantSlugFromId(tenantId),
    };
  }

  // Authenticated in Cognito but with no employee row yet. Fall back to the
  // default tenant and the lowest role — never to anything privileged.
  return {
    id: `EMP#${cognito.email}`,
    email: cognito.email,
    name: cognito.name,
    role: "EMPLOYEE",
    area: "",
    employeeId: `EMP#${cognito.email}`,
    tenantId: DEFAULT_TENANT_ID,
    tenantSlug: tenantSlugFromId(DEFAULT_TENANT_ID),
  };
}
