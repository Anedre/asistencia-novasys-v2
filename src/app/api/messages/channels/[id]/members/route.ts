import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getChannelById, addMemberToChannel, deleteChannel } from "@/lib/db/chat-channels";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { TABLES } from "@/lib/db/tables";

/** POST — add member to channel */
export const POST = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const user = await requireSession();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const channel = await getChannelById(id);
  if (!channel || !channel.Members.includes(user.employeeId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (channel.Type === "direct") {
    return NextResponse.json({ error: "No se pueden agregar miembros a un chat directo" }, { status: 400 });
  }

  const { memberId, memberName } = await req.json();
  if (!memberId || !memberName) {
    return NextResponse.json({ error: "ID y nombre del miembro son requeridos" }, { status: 400 });
  }
  if (channel.Members.includes(memberId)) {
    return NextResponse.json({ error: "El miembro ya está en el grupo" }, { status: 400 });
  }

  await addMemberToChannel(id, memberId, memberName);
  return NextResponse.json({ ok: true });
});

/** DELETE — leave channel (remove self) */
export const DELETE = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const user = await requireSession();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const channel = await getChannelById(id);
  if (!channel || !channel.Members.includes(user.employeeId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (channel.Type === "direct") {
    return NextResponse.json({ error: "No puedes salir de un chat directo" }, { status: 400 });
  }

  // Remove member from channel
  const newMembers = channel.Members.filter((m) => m !== user.employeeId);
  const newMemberNames = { ...channel.MemberNames };
  delete newMemberNames[user.employeeId];

  if (newMembers.length === 0) {
    // Delete channel if no members left
    await deleteChannel(id);
  } else {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.CHAT_CHANNELS,
        Key: { ChannelID: id },
        UpdateExpression: "SET Members = :members, MemberNames = :names, UpdatedAt = :now",
        ExpressionAttributeValues: {
          ":members": newMembers,
          ":names": newMemberNames,
          ":now": new Date().toISOString(),
        },
      })
    );
  }

  return NextResponse.json({ ok: true });
});
