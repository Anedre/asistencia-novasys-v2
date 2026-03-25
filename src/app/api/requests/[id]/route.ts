import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getRequestDetail, cancelRequest } from "@/lib/services/approval.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  await requireSession();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const request = await getRequestDetail(id);
  return NextResponse.json({ ok: true, request });
});

export const DELETE = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const user = await requireSession();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const result = await cancelRequest(id, user.employeeId);
  return NextResponse.json(result);
});
