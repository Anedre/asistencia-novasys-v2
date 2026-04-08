import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { listAuditByGroup } from "@/lib/db/audit";
import { withErrorHandler, ForbiddenError } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (
  _req: Request,
  context: unknown
) => {
  const user = await requireAdmin();
  const { groupId } = await (context as {
    params: Promise<{ groupId: string }>;
  }).params;

  const items = await listAuditByGroup(groupId);
  // Tenant check: reject if any row belongs to another tenant.
  if (items.some((i) => i.tenantId !== user.tenantId)) {
    throw new ForbiddenError("No puedes ver grupos de otro tenant");
  }

  return NextResponse.json({ items });
});
