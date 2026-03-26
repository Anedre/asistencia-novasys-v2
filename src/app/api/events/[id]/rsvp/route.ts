import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { updateEventRSVP, getEventById } from "@/lib/db/events";

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;
    const { status } = await req.json();

    if (!["going", "maybe", "declined"].includes(status)) {
      return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
    }

    const event = await getEventById(id);
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

    await updateEventRSVP(id, user.employeeId, status);
    return NextResponse.json({ ok: true });
  }
);
