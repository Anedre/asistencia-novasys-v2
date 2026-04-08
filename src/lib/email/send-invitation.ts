/**
 * High-level helper that joins template + SES send for invitations.
 *
 * Best-effort: never throws — returns ok:false on failure so the caller can
 * still surface the invite link manually.
 */

import type { Invitation } from "@/lib/types/invitation";
import type { Tenant } from "@/lib/types/tenant";
import { sendEmail } from "./ses-client";
import { buildInvitationEmail } from "./templates/invitation";

interface SendInvitationParams {
  invitation: Invitation;
  tenant: Pick<Tenant, "name" | "branding"> | null;
  inviteLink: string;
}

export async function sendInvitationEmail(params: SendInvitationParams) {
  const { invitation, tenant, inviteLink } = params;

  const email = buildInvitationEmail({
    recipientName: invitation.FullName,
    tenantName: tenant?.name ?? "tu empresa",
    tenantLogoUrl: tenant?.branding?.logoUrl,
    tenantPrimaryColor: tenant?.branding?.primaryColor,
    inviterName: invitation.InvitedByName ?? "el equipo de admin",
    role: invitation.Role,
    area: invitation.Area,
    position: invitation.Position,
    inviteLink,
    expiresAt: invitation.ExpiresAt,
  });

  return sendEmail({
    to: invitation.Email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
