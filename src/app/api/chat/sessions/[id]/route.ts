import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getChatSession, deleteChatSession } from "@/lib/db/chat-sessions";

export const GET = withErrorHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const user = await requireSession();
    const { id } = await params;

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

    return NextResponse.json({ session });
  }
);

export const DELETE = withErrorHandler(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const user = await requireSession();
    const { id } = await params;

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

    await deleteChatSession(id);
    return NextResponse.json({ ok: true });
  }
);
