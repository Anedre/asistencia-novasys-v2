import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getChannelById, updateChannelLastMessage } from "@/lib/db/chat-channels";
import { getMessagesByChannel, createMessage } from "@/lib/db/chat-messages";
import { putNotification } from "@/lib/db/notifications";
import type { ChatMessage } from "@/lib/types/channel";

export const GET = withErrorHandler(
  async (
    req: NextRequest,
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

    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    const messages = await getMessagesByChannel(id, limit);
    return NextResponse.json({ messages });
  }
);

export const POST = withErrorHandler(
  async (
    req: NextRequest,
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

    const body = await req.json();
    const { content, type: msgType } = body as {
      content: string;
      type?: "text" | "image" | "file";
    };

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "El contenido es requerido" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const message: ChatMessage = {
      MessageID: `MSG#${crypto.randomUUID()}`,
      ChannelID: id,
      SenderID: user.employeeId,
      SenderName: user.name,
      Content: content.trim(),
      Type: msgType || "text",
      CreatedAt: now,
    };

    await createMessage(message);
    await updateChannelLastMessage(id, content.trim(), user.name);

    // Fan out a notification to every other channel member. Best-effort: if
    // any individual put fails we don't break the message send.
    const preview = content.trim().slice(0, 140);
    const recipients = channel.Members.filter((m) => m !== user.employeeId);
    await Promise.allSettled(
      recipients.map((recipientId) =>
        putNotification({
          recipientId,
          createdAt: now,
          notificationId: `NOTIF#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
          type: "NEW_MESSAGE",
          title: user.name,
          message: preview,
          referenceId: id,
          referenceType: "CHANNEL",
          read: false,
          soundType: "message",
          ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        })
      )
    );

    return NextResponse.json({ ok: true, message });
  }
);
