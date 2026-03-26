import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getTenantById } from "@/lib/db/tenants";
import { withErrorHandler } from "@/lib/utils/errors";

/** GET /api/tenant — get current user's tenant config */
export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const tenant = await getTenantById(user.tenantId);

  if (!tenant) {
    return NextResponse.json({
      ok: true,
      tenant: {
        tenantId: user.tenantId,
        slug: user.tenantSlug,
        name: "Novasys",
        branding: {
          primaryColor: "#1e40af",
          secondaryColor: "#1e3a5f",
          accentColor: "#f59e0b",
        },
        settings: {
          approvalRequired: false,
          defaultScheduleType: "FULL_TIME",
          timezone: "America/Lima",
          features: { chat: false, social: false, aiAssistant: false },
        },
      },
    });
  }

  return NextResponse.json({ ok: true, tenant });
});
