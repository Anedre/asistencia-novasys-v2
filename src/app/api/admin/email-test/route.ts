import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getEmployeeById, getAllActiveEmployees } from "@/lib/db/employees";
import { getInvitationsByTenant } from "@/lib/db/invitations";
import { sendEmail, EMAIL_FROM } from "@/lib/email/ses-client";
import { resolveTestRecipient } from "@/lib/email/allowed-recipients";

/**
 * Every address the tenant legitimately mails: its active staff plus anyone
 * with an invitation still pending. Doubles as the picker's options and as the
 * server-side allow-list, so the two can never drift apart.
 */
async function tenantRecipients(tenantId: string) {
  const [employees, invitations] = await Promise.all([
    getAllActiveEmployees(tenantId).catch(() => []),
    getInvitationsByTenant(tenantId).catch(() => []),
  ]);

  const seen = new Map<string, { email: string; label: string }>();
  employees.forEach((e) => {
    if (e.Email) seen.set(e.Email.toLowerCase(), { email: e.Email, label: e.FullName || e.Email });
  });
  invitations
    .filter((i) => i.Status === "PENDING")
    .forEach((i) => {
      const key = i.Email?.toLowerCase();
      if (key && !seen.has(key)) {
        seen.set(key, { email: i.Email, label: `${i.FullName || i.Email} (invitación pendiente)` });
      }
    });

  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** GET — addresses this admin may send a test to. */
export const GET = withErrorHandler(async () => {
  const admin = await requireAdmin();
  return NextResponse.json({ recipients: await tenantRecipients(admin.tenantId) });
});

/**
 * POST /api/admin/email-test
 *
 * Sends a diagnostic email and reports exactly what happened: the SES
 * MessageId, the sender actually resolved and the real recipient. Aggregate
 * SES metrics only say "N messages were accepted", which is useless when one
 * specific invitation never turns up.
 *
 * An optional `to` is honoured only when it already belongs to the tenant —
 * see resolveTestRecipient. Without that guard this would be an open relay.
 */
export const POST = withErrorHandler(async (request: Request) => {
  const admin = await requireAdmin();

  const body = await request.json().catch(() => ({}));
  const requested = typeof body?.to === "string" ? body.to : undefined;

  // The employee record holds the address the app would really use for this
  // person; the session address comes from Cognito and can differ.
  const employee = await getEmployeeById(admin.employeeId).catch(() => null);
  const fallback = employee?.Email || admin.email;

  const allowed = requested ? (await tenantRecipients(admin.tenantId)).map((r) => r.email) : [];
  const decision = resolveTestRecipient({ requested, fallback, allowed });
  if (!decision.ok) {
    return NextResponse.json({ ok: false, error: decision.error }, { status: 400 });
  }
  const to = decision.to;

  const stamp = new Date().toISOString();
  const result = await sendEmail({
    to,
    subject: `Prueba de envio Novasys Asistencia - ${stamp}`,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">` +
      `<h2 style="color:#1e3a5f">Prueba de envio</h2>` +
      `<p>Si estas leyendo esto, el envio de correo del sistema funciona.</p>` +
      `<p style="color:#475569">Destinatario: <b>${to}</b><br>Enviado: ${stamp}</p>` +
      `</div>`,
    text: `Prueba de envio Novasys Asistencia\n\nDestinatario: ${to}\nEnviado: ${stamp}\n`,
  });

  return NextResponse.json({
    ok: true,
    sent: result.ok,
    messageId: result.messageId,
    error: result.error,
    from: EMAIL_FROM,
    to,
    region: process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
    sentAt: stamp,
  });
});
