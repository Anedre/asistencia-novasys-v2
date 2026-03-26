import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { recordEvent } from "@/lib/services/attendance.service";
import { recordEventSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json();
  const parsed = recordEventSchema.parse(body);

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  const ip =
    headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    headers["x-real-ip"] ||
    "unknown";
  const ua = headers["user-agent"] || "unknown";

  const result = await recordEvent({
    employeeId: user.employeeId,
    eventType: parsed.eventType,
    note: parsed.note,
    clientTime: parsed.clientTime,
    deviceId: parsed.deviceId,
    ip,
    userAgent: ua,
    tenantId: user.tenantId,
  });

  return NextResponse.json({ ok: true, ...result });
});
