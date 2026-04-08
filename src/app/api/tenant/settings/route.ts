import { NextResponse } from "next/server";
import { requireAdmin, requireSession } from "@/lib/auth-helpers";
import { getTenantById, updateTenantSettings, updateTenantBranding } from "@/lib/db/tenants";
import { withErrorHandler } from "@/lib/utils/errors";
import { withAudit } from "@/lib/services/audit.service";

/** GET /api/tenant/settings — read tenant settings */
export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const tenant = await getTenantById(user.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, tenant });
});

/** PUT /api/tenant/settings — update tenant settings and branding (admin only)
 *  Accepts two formats:
 *  1. { settings: { ... }, branding: { ... } } — bulk update
 *  2. { SettingKey: "holidays", value: [...] } — single key update
 */
export const PUT = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const body = await req.json();

  // Wrap all paths in a single audit entry so the before snapshot captures
  // the full tenant document — critical for reverting nested settings/branding.
  await withAudit(
    {
      actor: user,
      entityType: "TENANT_SETTINGS",
      entityKey: { TenantID: user.tenantId },
      action: "UPDATE",
      reason:
        body.SettingKey
          ? `Ajuste de ${body.SettingKey}`
          : body.settings && body.branding
          ? "Settings + branding"
          : body.settings
          ? "Settings"
          : body.branding
          ? "Branding"
          : "Configuración",
    },
    async () => {
      // Format 2: Single setting key
      if (body.SettingKey && body.value !== undefined) {
        const key = body.SettingKey as string;
        const partial: Record<string, unknown> = { [key]: body.value };
        await updateTenantSettings(user.tenantId, partial);
        return;
      }
      // Format 1: Bulk settings/branding
      if (body.settings) {
        await updateTenantSettings(user.tenantId, body.settings);
      }
      if (body.branding) {
        await updateTenantBranding(user.tenantId, body.branding);
      }
    }
  );

  const updated = await getTenantById(user.tenantId);
  return NextResponse.json({ ok: true, tenant: updated });
});
