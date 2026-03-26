import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getEventsByTenant, createEvent } from "@/lib/db/events";
import type { AppEvent } from "@/lib/types/event";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const events = await getEventsByTenant(user.tenantId);

  // Filter by visibility
  const filtered = events.filter((e) => {
    if (e.Status === "CANCELLED") return false;
    if (e.Visibility === "company") return true;
    if (e.Visibility === "area" && e.TargetArea === user.area) return true;
    if (e.Visibility === "private" && e.CreatorID === user.employeeId) return true;
    return false;
  });

  return NextResponse.json({ events: filtered });
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json();

  const { title, description, type, visibility, targetArea, startDate, endDate, location } = body;

  if (!title || !type || !visibility || !startDate) {
    return NextResponse.json({ error: "Titulo, tipo, visibilidad y fecha son requeridos" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const event: AppEvent = {
    EventID: `EVT#${crypto.randomUUID()}`,
    TenantID: user.tenantId,
    Title: title,
    Description: description || undefined,
    Type: type,
    Visibility: visibility,
    TargetArea: targetArea || undefined,
    StartDate: startDate,
    EndDate: endDate || undefined,
    Location: location || undefined,
    CreatorID: user.employeeId,
    CreatorName: user.name,
    RSVPs: {},
    Status: "ACTIVE",
    CreatedAt: now,
    UpdatedAt: now,
  };

  await createEvent(event);
  return NextResponse.json({ ok: true, event });
});
