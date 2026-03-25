import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getNotifications, getUnreadCount, markAllAsRead } from "@/lib/db/notifications";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.employeeId, limit),
    getUnreadCount(user.employeeId),
  ]);

  return NextResponse.json({
    ok: true,
    notifications,
    unreadCount,
  });
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json();

  if (body.action === "markAllRead") {
    await markAllAsRead(user.employeeId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Acción no válida" }, { status: 400 });
});
