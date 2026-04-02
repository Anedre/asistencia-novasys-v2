import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { toggleReaction } from "@/lib/db/chat-messages";
import { getChannelById } from "@/lib/db/chat-channels";

export const POST = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const user = await requireSession();
  const { id, msgId } = await (context as { params: Promise<{ id: string; msgId: string }> }).params;

  // Verify membership
  const channel = await getChannelById(id);
  if (!channel || !channel.Members.includes(user.employeeId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { emoji } = await req.json();
  if (!emoji || typeof emoji !== "string") {
    return NextResponse.json({ error: "Emoji requerido" }, { status: 400 });
  }

  await toggleReaction(msgId, emoji, user.employeeId, user.name);
  return NextResponse.json({ ok: true });
});
