import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { archiveEvent } from "@/lib/services/hr.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const DELETE = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  await archiveEvent(id);
  return NextResponse.json({ ok: true });
});
