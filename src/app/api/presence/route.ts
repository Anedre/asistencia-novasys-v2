import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { updatePresence, updateTypingStatus, getPresenceForEmployees } from "@/lib/db/employees";

/** POST /api/presence — heartbeat + typing indicator */
export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json().catch(() => ({}));

  // Update heartbeat
  await updatePresence(user.employeeId, "online");

  // Update typing if provided
  if (body.typingInChannel !== undefined) {
    await updateTypingStatus(user.employeeId, body.typingInChannel || null);
  }

  return NextResponse.json({ ok: true });
});

/** GET /api/presence?ids=EMP1,EMP2 — get presence for specific employees */
export const GET = withErrorHandler(async (req: Request) => {
  await requireSession();
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids") ?? "";

  if (!idsParam) {
    return NextResponse.json({ presence: {} });
  }

  const ids = idsParam.split(",").filter(Boolean);
  const presence = await getPresenceForEmployees(ids);
  return NextResponse.json({ presence });
});
