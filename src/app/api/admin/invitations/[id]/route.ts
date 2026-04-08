import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { revokeInvitation, deleteInvitation } from "@/lib/db/invitations";
import { withAudit } from "@/lib/services/audit.service";

export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await params;

    await withAudit(
      {
        actor: admin,
        entityType: "INVITATION",
        entityKey: { InviteID: id },
        action: "DELETE",
        reason: "Revocación de invitación",
      },
      async () => revokeInvitation(id)
    );

    return NextResponse.json({ ok: true });
  }
);
