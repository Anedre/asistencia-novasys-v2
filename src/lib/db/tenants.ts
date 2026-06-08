/**
 * Tenant CRUD operations for multi-tenancy.
 */

import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Tenant, TenantBranding, TenantSettings } from "@/lib/types/tenant";

/** Get tenant by ID (e.g., "TENANT#novasys") */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.TENANTS,
      Key: { TenantID: tenantId },
    })
  );
  return (result.Item as Tenant) ?? null;
}

/** Get tenant by slug (e.g., "novasys") */
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.TENANTS,
      IndexName: INDEXES.TENANT_SLUG,
      KeyConditionExpression: "slug = :slug",
      ExpressionAttributeValues: { ":slug": slug },
      Limit: 1,
    })
  );
  return (result.Items?.[0] as Tenant) ?? null;
}

/** List all tenants */
export async function getAllTenants(): Promise<Tenant[]> {
  const result = await docClient.send(
    new ScanCommand({ TableName: TABLES.TENANTS })
  );
  return (result.Items as Tenant[]) ?? [];
}

/** Create a new tenant */
export async function createTenant(tenant: Tenant): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.TENANTS,
      Item: tenant,
      ConditionExpression: "attribute_not_exists(TenantID)",
    })
  );
}

/** Delete a tenant — used only as part of register-company rollback when
 *  a downstream step (Cognito sign-up or employee create) fails. */
export async function deleteTenant(tenantId: string): Promise<void> {
  const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.TENANTS,
      Key: { TenantID: tenantId },
    }),
  );
}

/**
 * Returns the URL unchanged if it lives on the configured S3 bucket, throws
 * otherwise. Used to gate tenant branding image fields — admins shouldn't
 * be able to set their logo / background to an arbitrary external host
 * (phishing, tracking pixels on the login page).
 */
function assertTrustedImageUrl(url: string, field: string): string {
  const trustedHost =
    (process.env.REPORT_BUCKET || "novasys-v2-reports") + ".s3.amazonaws.com";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== trustedHost) {
      throw new Error(`${field}: URL no permitida (debe ser ${trustedHost})`);
    }
  } catch {
    throw new Error(`${field}: URL inválida`);
  }
  return url;
}

/** Update tenant branding (logo, colors, background) */
export async function updateTenantBranding(
  tenantId: string,
  branding: Partial<TenantBranding>
): Promise<void> {
  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":now": new Date().toISOString() };

  if (branding.logoUrl !== undefined && branding.logoUrl !== null) {
    updates.push("branding.logoUrl = :logo");
    values[":logo"] = assertTrustedImageUrl(branding.logoUrl, "logoUrl");
  } else if (branding.logoUrl === null) {
    updates.push("branding.logoUrl = :logo");
    values[":logo"] = null;
  }
  if (
    branding.backgroundImageUrl !== undefined &&
    branding.backgroundImageUrl !== null
  ) {
    updates.push("branding.backgroundImageUrl = :bg");
    values[":bg"] = assertTrustedImageUrl(
      branding.backgroundImageUrl,
      "backgroundImageUrl",
    );
  } else if (branding.backgroundImageUrl === null) {
    updates.push("branding.backgroundImageUrl = :bg");
    values[":bg"] = null;
  }
  if (branding.primaryColor !== undefined) {
    updates.push("branding.primaryColor = :pc");
    values[":pc"] = branding.primaryColor;
  }
  if (branding.secondaryColor !== undefined) {
    updates.push("branding.secondaryColor = :sc");
    values[":sc"] = branding.secondaryColor;
  }
  if (branding.accentColor !== undefined) {
    updates.push("branding.accentColor = :ac");
    values[":ac"] = branding.accentColor;
  }

  if (updates.length === 0) return;

  updates.push("updatedAt = :now");

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.TENANTS,
      Key: { TenantID: tenantId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
      ExpressionAttributeValues: values,
    })
  );
}

/** Update tenant settings */
export async function updateTenantSettings(
  tenantId: string,
  settings: Partial<TenantSettings>
): Promise<void> {
  const updates: string[] = [];
  const values: Record<string, unknown> = { ":now": new Date().toISOString() };

  if (settings.approvalRequired !== undefined) {
    updates.push("settings.approvalRequired = :ar");
    values[":ar"] = settings.approvalRequired;
  }
  if (settings.defaultScheduleType !== undefined) {
    updates.push("settings.defaultScheduleType = :dst");
    values[":dst"] = settings.defaultScheduleType;
  }
  if (settings.timezone !== undefined) {
    updates.push("settings.#tz = :tz");
    values[":tz"] = settings.timezone;
  }
  if (settings.features !== undefined) {
    updates.push("settings.features = :feat");
    values[":feat"] = settings.features;
  }
  if (settings.defaultSchedule !== undefined) {
    updates.push("settings.defaultSchedule = :ds");
    values[":ds"] = settings.defaultSchedule;
  }
  if (settings.holidays !== undefined) {
    updates.push("settings.holidays = :hol");
    values[":hol"] = settings.holidays;
  }
  if (settings.notifications !== undefined) {
    updates.push("settings.notifications = :notif");
    values[":notif"] = settings.notifications;
  }
  if (settings.workPolicy !== undefined) {
    updates.push("settings.workPolicy = :wp");
    values[":wp"] = settings.workPolicy;
  }
  if (settings.onboardingCompleted !== undefined) {
    updates.push("settings.onboardingCompleted = :oc");
    values[":oc"] = settings.onboardingCompleted;
  }
  // General-settings extended fields (legal data + display prefs). These are
  // sent by the Settings → General form and are also read by the PDF report
  // Lambda for the header (company legal name + RUC).
  if (settings.legalName !== undefined) {
    updates.push("settings.legalName = :ln");
    values[":ln"] = settings.legalName;
  }
  if (settings.ruc !== undefined) {
    updates.push("settings.ruc = :ruc");
    values[":ruc"] = settings.ruc;
  }
  if (settings.industry !== undefined) {
    updates.push("settings.industry = :ind");
    values[":ind"] = settings.industry;
  }
  if (settings.address !== undefined) {
    updates.push("settings.address = :addr");
    values[":addr"] = settings.address;
  }
  if (settings.weekStart !== undefined) {
    updates.push("settings.weekStart = :ws");
    values[":ws"] = settings.weekStart;
  }
  if (settings.dateFormat !== undefined) {
    updates.push("settings.dateFormat = :df");
    values[":df"] = settings.dateFormat;
  }
  if (settings.timeFormat !== undefined) {
    updates.push("settings.timeFormat = :tf");
    values[":tf"] = settings.timeFormat;
  }

  if (updates.length === 0) return;

  updates.push("updatedAt = :now");

  const hasTimezone = settings.timezone !== undefined;

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.TENANTS,
      Key: { TenantID: tenantId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: hasTimezone ? { "#tz": "timezone" } : undefined,
      ExpressionAttributeValues: values,
    })
  );
}
