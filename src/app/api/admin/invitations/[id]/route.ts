import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { revokeInvitation, deleteInvitation } from "@/lib/db/invitations";

export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;

    // Revoke instead of hard delete
    await revokeInvitation(id);

    return NextResponse.json({ ok: true });
  }
);
