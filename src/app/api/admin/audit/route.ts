import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { listAuditByTenant } from "@/lib/db/audit";
import { withErrorHandler } from "@/lib/utils/errors";
import type { AuditEntityType } from "@/lib/types/audit";

const ALLOWED_ENTITY_TYPES: AuditEntityType[] = [
  "DAILY_SUMMARY",
  "APPROVAL_REQUEST",
  "EMPLOYEE",
  "INVITATION",
  "HR_EVENT",
  "HR_DOCUMENT",
  "TENANT_SETTINGS",
];

function parseEntityType(value: string | null): AuditEntityType | undefined {
  if (!value) return undefined;
  return ALLOWED_ENTITY_TYPES.includes(value as AuditEntityType)
    ? (value as AuditEntityType)
    : undefined;
}

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const url = new URL(req.url);

  const result = await listAuditByTenant({
    tenantId: user.tenantId,
    entityType: parseEntityType(url.searchParams.get("entityType")),
    actorId: url.searchParams.get("actorId") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    hideReverted: url.searchParams.get("hideReverted") === "true",
    limit: Math.min(
      Number(url.searchParams.get("limit") || "50") || 50,
      200
    ),
    cursor: url.searchParams.get("cursor") || undefined,
  });

  return NextResponse.json(result);
});
