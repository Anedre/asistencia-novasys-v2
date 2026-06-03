import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getEventById, updateEvent, deleteEvent } from "@/lib/db/events";
import type { AppEvent } from "@/lib/types/event";

type SessionUser = { employeeId: string; tenantId?: string; area?: string; role?: string };

/**
 * Returns true when the caller is allowed to see this event.
 * Mirrors the filter on the LIST endpoint so direct-by-id fetches
 * can't leak private or cross-tenant events.
 */
function canViewEvent(event: AppEvent, user: SessionUser): boolean {
  if (user.tenantId && event.TenantID && event.TenantID !== user.tenantId) return false;
  if (event.Visibility === "company") return true;
  if (event.Visibility === "area" && event.TargetArea === user.area) return true;
  if (event.Visibility === "private" && event.CreatorID === user.employeeId) return true;
  // Creators always see their own event regardless of visibility.
  if (event.CreatorID === user.employeeId) return true;
  // Admins of the same tenant can see/manage everything in their tenant.
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return false;
}

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = (await requireSession()) as SessionUser;
    const { id } = await params;
    const event = await getEventById(id);
    if (!event || !canViewEvent(event, user)) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ event });
  }
);

export const PUT = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = (await requireSession()) as SessionUser;
    const { id } = await params;
    const body = await req.json();

    const event = await getEventById(id);
    if (!event || !canViewEvent(event, user)) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }
    const canMutate =
      event.CreatorID === user.employeeId ||
      user.role === "ADMIN" ||
      user.role === "SUPER_ADMIN";
    if (!canMutate) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await updateEvent(id, body);
    return NextResponse.json({ ok: true });
  }
);

export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = (await requireSession()) as SessionUser;
    const { id } = await params;

    const event = await getEventById(id);
    if (!event || !canViewEvent(event, user)) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }
    const canMutate =
      event.CreatorID === user.employeeId ||
      user.role === "ADMIN" ||
      user.role === "SUPER_ADMIN";
    if (!canMutate) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await updateEvent(id, { Status: "CANCELLED" });
    return NextResponse.json({ ok: true });
  }
);
