/**
 * Bulk-invite endpoint used by the onboarding wizard (step 4).
 *
 * POST body: { invitations: [{ email, fullName?, area?, position?, role? }, ...] }
 *
 * For each entry: creates an Invitation row + dispatches an SES email.
 * Returns { created: [...], failed: [...] }.
 *
 * Capped at 50 entries per call to avoid route timeout.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";
import { createInvitation } from "@/lib/db/invitations";
import { getTenantById } from "@/lib/db/tenants";
import type { Invitation } from "@/lib/types/invitation";
import { withAudit } from "@/lib/services/audit.service";
import { sendInvitationEmail } from "@/lib/email/send-invitation";

const MAX_BULK = 50;

interface InviteInput {
  email?: string;
  fullName?: string;
  area?: string;
  position?: string;
  role?: "EMPLOYEE" | "ADMIN";
}

interface CreatedResult {
  email: string;
  inviteId: string;
  inviteLink: string;
  emailSent: boolean;
}

interface FailedResult {
  email: string;
  error: string;
}

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAdmin();
  const body = await request.json();

  const list = Array.isArray(body?.invitations) ? body.invitations : null;
  if (!list || list.length === 0) {
    throw new ValidationError("Debes enviar al menos una invitación");
  }
  if (list.length > MAX_BULK) {
    throw new ValidationError(
      `Máximo ${MAX_BULK} invitaciones por llamada (recibidas ${list.length})`
    );
  }

  // Load tenant once for the email branding.
  const tenant = await getTenantById(user.tenantId).catch(() => null);
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const created: CreatedResult[] = [];
  const failed: FailedResult[] = [];

  for (const raw of list as InviteInput[]) {
    const email = (raw.email ?? "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      failed.push({ email: raw.email ?? "(vacío)", error: "Email inválido" });
      continue;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const token = crypto.randomUUID();

    const invitation: Invitation = {
      InviteID: `INV#${crypto.randomUUID()}`,
      TenantID: user.tenantId,
      Email: email,
      FullName: raw.fullName?.trim() || undefined,
      InvitedBy: user.employeeId,
      InvitedByName: user.name,
      Role: raw.role || "EMPLOYEE",
      Area: raw.area?.trim() || undefined,
      Position: raw.position?.trim() || undefined,
      Status: "PENDING",
      Token: token,
      CreatedAt: now.toISOString(),
      ExpiresAt: expiresAt.toISOString(),
    };

    try {
      await withAudit(
        {
          actor: user,
          entityType: "INVITATION",
          entityKey: { InviteID: invitation.InviteID },
          action: "CREATE",
          reason: `Invitación masiva a ${email}`,
          skipBeforeRead: true,
        },
        async () => createInvitation(invitation)
      );
    } catch (err) {
      failed.push({
        email,
        error: err instanceof Error ? err.message : "Error al crear",
      });
      continue;
    }

    const inviteLink = `${baseUrl}/register?invite=${token}`;

    const emailResult = await sendInvitationEmail({
      invitation,
      tenant,
      inviteLink,
    });

    created.push({
      email,
      inviteId: invitation.InviteID,
      inviteLink,
      emailSent: emailResult.ok,
    });
  }

  return NextResponse.json({
    ok: true,
    created,
    failed,
  });
});
