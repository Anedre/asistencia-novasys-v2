import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler, NotFoundError } from "@/lib/utils/errors";
import { revokeInvitation, getInvitationById } from "@/lib/db/invitations";
import { withAudit } from "@/lib/services/audit.service";
import { assertSameTenant } from "@/lib/utils/authz";

export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await params;

    // Tenant isolation: only revoke invitations owned by the admin's tenant.
    const invite = await getInvitationById(id);
    if (!invite) {
      throw new NotFoundError("Invitación no encontrada");
    }
    assertSameTenant(invite.TenantID, admin);

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
