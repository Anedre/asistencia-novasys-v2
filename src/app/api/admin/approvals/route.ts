import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getPendingRequests } from "@/lib/services/approval.service";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  await requireAdmin();
  const requests = await getPendingRequests();
  return NextResponse.json({ ok: true, requests });
});
