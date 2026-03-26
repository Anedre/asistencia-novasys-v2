import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getTenantById, updateTenantSettings, updateTenantBranding } from "@/lib/db/tenants";
import { withErrorHandler } from "@/lib/utils/errors";

/** PUT /api/tenant/settings — update tenant settings and branding (admin only) */
export const PUT = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const body = await req.json();

  if (body.settings) {
    await updateTenantSettings(user.tenantId, body.settings);
  }

  if (body.branding) {
    await updateTenantBranding(user.tenantId, body.branding);
  }

  const updated = await getTenantById(user.tenantId);
  return NextResponse.json({ ok: true, tenant: updated });
});
