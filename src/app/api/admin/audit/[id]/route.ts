import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAudit } from "@/lib/db/audit";
import { withErrorHandler, NotFoundError, ForbiddenError } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (
  _req: Request,
  context: unknown
) => {
  const user = await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const entry = await getAudit(id);
  if (!entry) throw new NotFoundError("Entrada de audit no encontrada");
  if (entry.tenantId !== user.tenantId) {
    throw new ForbiddenError("No puedes ver audits de otro tenant");
  }

  return NextResponse.json(entry);
});
