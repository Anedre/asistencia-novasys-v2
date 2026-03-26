import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import {
  getChannelById,
  deleteChannel,
} from "@/lib/db/chat-channels";
import { deleteMessagesByChannel } from "@/lib/db/chat-messages";

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
