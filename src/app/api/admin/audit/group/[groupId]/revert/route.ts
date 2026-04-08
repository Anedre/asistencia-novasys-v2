import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { revertGroup } from "@/lib/services/audit.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const POST = withErrorHandler(async (
  _req: Request,
  context: unknown
) => {
  const user = await requireAdmin();
  const { groupId } = await (context as {
    params: Promise<{ groupId: string }>;
  }).params;

  const result = await revertGroup(groupId, user);

  // Partial success: some rows reverted, the rest blocked by a later action.
  if (result.blockedBy) {
    return NextResponse.json(
      {
        ok: false,
        code: "REVERT_BLOCKED",
        message: `Se revirtieron ${result.reverted}/${result.total} filas. Una acción posterior bloquea el resto.`,
        ...result,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, ...result });
});
