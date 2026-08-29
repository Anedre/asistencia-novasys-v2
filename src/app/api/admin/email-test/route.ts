import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getEmployeeById } from "@/lib/db/employees";
import { sendEmail, EMAIL_FROM } from "@/lib/email/ses-client";

/**
 * POST /api/admin/email-test
 *
 * Sends a diagnostic email and reports exactly what happened.
 *
 * Aggregate SES metrics only say "N messages were accepted"; when invitations
 * appeared to send but never arrived there was no way to tell which message
 * was which. This returns the SES MessageId, the resolved sender and the real
 * recipient, so a single click produces an identifier you can trace.
 *
 * The recipient is always the caller's own address — never taken from the
 * request — so this cannot be used to send mail to arbitrary people.
 */
export const POST = withErrorHandler(async () => {
  const admin = await requireAdmin();

  // The employee record holds the address the app would really use for this
  // person; the session address comes from Cognito and can differ.
  const employee = await getEmployeeById(admin.employeeId).catch(() => null);
  const to = employee?.Email || admin.email;

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
