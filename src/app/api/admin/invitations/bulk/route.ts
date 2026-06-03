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
  const { getAppBaseUrl } = await import("@/lib/utils/app-url");
  const baseUrl = getAppBaseUrl();

  const created: CreatedResult[] = [];
  const failed: FailedResult[] = [];

  // Each input is processed independently: validate → create row → send
  // email. We fan out in chunks of 5 so a 50-row paste doesn't run
  // serially for ~10s+ (SES round-trip dominates) and risk a Lambda
  // timeout. SES default send rate is 14/s so 5 in-flight is safe.
  const CONCURRENCY = 5;
  const inputs = list as InviteInput[];

  async function processOne(
    raw: InviteInput,
  ): Promise<{ created?: CreatedResult; failed?: FailedResult }> {
    const email = (raw.email ?? "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return { failed: { email: raw.email ?? "(vacío)", error: "Email inválido" } };
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
      return {
        failed: {
          email,
          error: err instanceof Error ? err.message : "Error al crear",
        },
      };
    }

    const inviteLink = `${baseUrl}/register?invite=${token}`;
    const emailResult = await sendInvitationEmail({
      invitation,
      tenant,
      inviteLink,
    });
    return {
      created: {
        email,
        inviteId: invitation.InviteID,
        inviteLink,
        emailSent: emailResult.ok,
      },
    };
  }

  for (let i = 0; i < inputs.length; i += CONCURRENCY) {
    const chunk = inputs.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map((raw) => processOne(raw)));
    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.created) created.push(r.value.created);
        if (r.value.failed) failed.push(r.value.failed);
      } else {
        failed.push({ email: "(desconocido)", error: String(r.reason) });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    failed,
  });
});
