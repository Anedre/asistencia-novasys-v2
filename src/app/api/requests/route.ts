import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { createRequest, getMyRequests } from "@/lib/services/approval.service";
import { createRequestSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const requests = await getMyRequests(user.employeeId);
  return NextResponse.json({ ok: true, requests });
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json();
  const parsed = createRequestSchema.parse(body);

  const request = await createRequest(user.employeeId, user.name, parsed, user.tenantId);
  return NextResponse.json({ ok: true, request }, { status: 201 });
});
