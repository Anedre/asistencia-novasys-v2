import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import {
  getChannelById,
  deleteChannel,
} from "@/lib/db/chat-channels";
import { deleteMessagesByChannel } from "@/lib/db/chat-messages";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { TABLES } from "@/lib/db/tables";

export const GET = withErrorHandler(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const user = await requireSession();
    const { id } = await params;

    const channel = await getChannelById(id);
    if (!channel) {
      return NextResponse.json(
        { error: "Canal no encontrado" },
        { status: 404 }
      );
    }

    if (!channel.Members.includes(user.employeeId)) {
      return NextResponse.json(
        { error: "No eres miembro de este canal" },
        { status: 403 }
      );
    }

    return NextResponse.json({ channel });
  }
);

/** PATCH — edit channel (name, description) */
export const PATCH = withErrorHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const user = await requireSession();
    const { id } = await params;
    const channel = await getChannelById(id);

    if (!channel) {
      return NextResponse.json({ error: "Canal no encontrado" }, { status: 404 });
    }
    if (!channel.Members.includes(user.employeeId)) {
      return NextResponse.json({ error: "No eres miembro de este canal" }, { status: 403 });
    }
    if (channel.Type === "direct") {
      return NextResponse.json({ error: "No se puede editar un chat directo" }, { status: 400 });
    }

    const body = await req.json();
    const updates: string[] = ["UpdatedAt = :now"];
    const values: Record<string, unknown> = { ":now": new Date().toISOString() };

    if (body.name !== undefined) {
      updates.push("#n = :name");
      values[":name"] = body.name;
    }
    if (body.description !== undefined) {
      updates.push("Description = :desc");
      values[":desc"] = body.description;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.CHAT_CHANNELS,
        Key: { ChannelID: id },
        UpdateExpression: `SET ${updates.join(", ")}`,
        ExpressionAttributeNames: body.name !== undefined ? { "#n": "Name" } : undefined,
        ExpressionAttributeValues: values,
      })
    );

    const updated = await getChannelById(id);
    return NextResponse.json({ ok: true, channel: updated });
  }
);

export const DELETE = withErrorHandler(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const user = await requireSession();
    const { id } = await params;

    const channel = await getChannelById(id);
    if (!channel) {
      return NextResponse.json(
        { error: "Canal no encontrado" },
        { status: 404 }
      );
    }

    if (channel.CreatedBy !== user.employeeId && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo el creador puede eliminar este canal" },
        { status: 403 }
      );
    }

    // Delete all messages first, then the channel
    await deleteMessagesByChannel(id);
    await deleteChannel(id);

    return NextResponse.json({ ok: true });
  }
);
