import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getTenantById } from "@/lib/db/tenants";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const tenant = await getTenantById(user.tenantId);
  const timezone = tenant?.settings?.timezone ?? "America/Lima";

  return NextResponse.json({ timezone });
});
