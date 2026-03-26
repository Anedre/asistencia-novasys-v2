import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { approveRequest, rejectRequest } from "@/lib/services/approval.service";
import { reviewRequestSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";

export const POST = withErrorHandler(async (
  req: Request,
  context: unknown
) => {
  const user = await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();
  const parsed = reviewRequestSchema.parse(body);

  let result;
  if (parsed.action === "APPROVE") {
    result = await approveRequest(id, user.employeeId, user.name, parsed.reviewerNote, user.tenantId);
  } else {
    result = await rejectRequest(id, user.employeeId, user.name, parsed.reviewerNote, user.tenantId);
  }

  return NextResponse.json(result);
});
