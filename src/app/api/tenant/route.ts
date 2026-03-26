import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getTenantById } from "@/lib/db/tenants";
import { withErrorHandler } from "@/lib/utils/errors";

const defaultTenantResponse = (tenantId: string, slug: string) => ({
  ok: true,
  tenant: {
    TenantID: tenantId,
    slug,
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

/** GET /api/tenant — get current user's tenant config */
export const GET = withErrorHandler(async () => {
  const user = await requireSession();

  let tenant = null;
  try {
    tenant = await getTenantById(user.tenantId);
  } catch {
    // Table schema mismatch or record not found — use defaults
  }

  if (!tenant) {
    return NextResponse.json(
      defaultTenantResponse(user.tenantId, user.tenantSlug || "novasys")
    );
  }

  return NextResponse.json({ ok: true, tenant });
});
