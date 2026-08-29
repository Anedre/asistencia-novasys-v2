import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { getInvitationById, refreshInvitationExpiry } from "@/lib/db/invitations";
import { getTenantById } from "@/lib/db/tenants";
import { sendInvitationEmail } from "@/lib/email/send-invitation";
import { withAudit } from "@/lib/services/audit.service";
import { assertSameTenant } from "@/lib/utils/authz";

/**
 * POST /api/admin/invitations/[id]/resend
 *
 * Sends the invitation email again and pushes the expiry back another 7 days.
 * The token is reused, so a link the person may already have keeps working.
 *
 * Exists because a delivered email is not a read email: SES can report a clean
 * delivery while the message sits in the recipient's spam folder. Without this
 * the only recovery was creating a second invitation for the same address.
 */
export const POST = withErrorHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await params;

    const invite = await getInvitationById(id);
    if (!invite) {
      throw new NotFoundError("Invitación no encontrada");
    }
    // Tenant isolation: only resend invitations owned by the admin's tenant.
    assertSameTenant(invite.TenantID, admin);

    if (invite.Status !== "PENDING") {
      throw new ValidationError(
        `No se puede reenviar una invitación en estado ${invite.Status}`
      );
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await withAudit(
      {
        actor: admin,
        entityType: "INVITATION",
        entityKey: { InviteID: id },
        action: "UPDATE",
        reason: `Reenvío de invitación a ${invite.Email}`,
      },
      async () => refreshInvitationExpiry(id, expiresAt)
    );

    const { getAppBaseUrl } = await import("@/lib/utils/app-url");
    const inviteLink = `${getAppBaseUrl()}/register?invite=${invite.Token}`;

    // Best-effort, like the original send: the link is returned either way so
    // the admin can pass it along by hand when the mail bounces or is filtered.
    const tenant = await getTenantById(admin.tenantId).catch(() => null);
    const emailResult = await sendInvitationEmail({
      invitation: { ...invite, ExpiresAt: expiresAt },
      tenant,
      inviteLink,
    });

    return NextResponse.json({
      ok: true,
      inviteLink,
      expiresAt,
      emailSent: emailResult.ok,
      emailError: emailResult.ok ? undefined : emailResult.error,
    });
  }
);
