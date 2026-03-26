import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getEventById, updateEvent, deleteEvent } from "@/lib/db/events";

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireSession();
    const { id } = await params;
    const event = await getEventById(id);
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    return NextResponse.json({ event });
  }
);

export const PUT = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;
    const body = await req.json();

    const event = await getEventById(id);
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    if (event.CreatorID !== user.employeeId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await updateEvent(id, body);
    return NextResponse.json({ ok: true });
  }
);

export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;

    const event = await getEventById(id);
    if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    if (event.CreatorID !== user.employeeId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await updateEvent(id, { Status: "CANCELLED" });
    return NextResponse.json({ ok: true });
  }
);
