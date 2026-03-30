import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getPendingRequests } from "@/lib/services/approval.service";
import { getRequestsByStatus } from "@/lib/db/requests";
import { withErrorHandler } from "@/lib/utils/errors";
import type { RequestStatus } from "@/lib/types";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAdmin();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as RequestStatus | null;

  if (status && status !== "PENDING") {
    // Fetch by specific status (APPROVED, REJECTED, CANCELLED)
    const requests = await getRequestsByStatus(status, 100, user.tenantId);
    return NextResponse.json({ ok: true, requests });
  }

  // Default: fetch pending
  const requests = await getPendingRequests(user.tenantId);
  return NextResponse.json({ ok: true, requests });
});
