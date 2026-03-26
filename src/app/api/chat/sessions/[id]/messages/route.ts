import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import {
  getChatSession,
  updateChatSessionMessages,
} from "@/lib/db/chat-sessions";
import { sendMessage } from "@/lib/ai/bedrock";
import type { AIChatMessage } from "@/lib/types/chat";

export const POST = withErrorHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const user = await requireSession();
    const { id } = await params;
    const body = await req.json();

    const { content } = body as { content: string };
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "El mensaje no puede estar vacío" },
        { status: 400 }
      );
    }

    const session = await getChatSession(id);
    if (!session) {
      return NextResponse.json(
        { error: "Sesión no encontrada" },
        { status: 404 }
      );
    }
    if (session.EmployeeID !== user.employeeId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Add user message
    const userMessage: AIChatMessage = {
      role: "user",
      content: content.trim(),
      timestamp: now,
    };
    const updatedMessages = [...session.Messages, userMessage];

    // Call Bedrock
    const assistantContent = await sendMessage(updatedMessages);

    const assistantMessage: AIChatMessage = {
      role: "assistant",
      content: assistantContent,
      timestamp: new Date().toISOString(),
    };
    updatedMessages.push(assistantMessage);

    // Auto-update title from first user message
    let title = session.Title;
    if (session.Messages.length === 0) {
      title =
        content.trim().length > 50
          ? content.trim().slice(0, 50) + "..."
          : content.trim();
    }

    await updateChatSessionMessages(id, updatedMessages, title);

    return NextResponse.json({ message: assistantMessage });
  }
);
