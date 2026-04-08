import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { revertAudit, RevertBlockedError } from "@/lib/services/audit.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const POST = withErrorHandler(async (
  _req: Request,
  context: unknown
) => {
  const user = await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  try {
    const result = await revertAudit(id, user);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof RevertBlockedError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          code: "REVERT_BLOCKED",
          conflict: err.conflict,
        },
        { status: 409 }
      );
    }
    throw err;
  }
});
