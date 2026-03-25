import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getHRDashboard, createHREvent } from "@/lib/services/hr.service";
import { createHREventSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";
import { ValidationError } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request) => {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? undefined;
  const dashboard = await getHRDashboard(month);
  return NextResponse.json({ ok: true, ...dashboard });
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const body = await req.json();
  const parsed = createHREventSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => i.message).join(", ")
    );
  }
  const notificationId = await createHREvent(parsed.data, user.employeeId);
  return NextResponse.json({ ok: true, notificationId }, { status: 201 });
});
