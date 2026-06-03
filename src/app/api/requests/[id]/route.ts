import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getRequestDetail, cancelRequest } from "@/lib/services/approval.service";
import { withErrorHandler, NotFoundError } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const user = await requireSession();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const request = await getRequestDetail(id);
  if (!request) {
    throw new NotFoundError("Solicitud no encontrada");
  }
  // Authorization: owner OR admin/super-admin of the same tenant.
  const isOwner = request.employeeId === user.employeeId;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const sameTenant =
    !user.tenantId || !request.TenantID || request.TenantID === user.tenantId;
  if (!sameTenant || (!isOwner && !isAdmin)) {
    // Match 404 so we don't confirm existence of cross-tenant IDs.
    throw new NotFoundError("Solicitud no encontrada");
  }
  return NextResponse.json({ ok: true, request });
});

export const DELETE = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const user = await requireSession();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const result = await cancelRequest(id, user.employeeId);
  return NextResponse.json(result);
});
