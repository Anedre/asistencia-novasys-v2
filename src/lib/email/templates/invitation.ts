/**
 * HTML + plain-text email template for inviting an employee to a tenant.
 *
 * Uses inline styles + table layout for compatibility with Gmail, Outlook,
 * Apple Mail, etc. Tenant branding (logo + primary color) is applied where
 * possible.
 */

interface InvitationEmailParams {
  recipientName?: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  tenantPrimaryColor?: string | null;
  inviterName: string;
  role: string;
  area?: string;
  position?: string;
  inviteLink: string;
  expiresAt: string;
}

export interface InvitationEmail {
  subject: string;
  html: string;
  text: string;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatExpiry(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-PE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function buildInvitationEmail(
  p: InvitationEmailParams
): InvitationEmail {
  const color = p.tenantPrimaryColor || "#6366f1";
  const greeting = p.recipientName
    ? `Hola ${escape(p.recipientName)},`
    : "Hola,";
  const expiryHuman = formatExpiry(p.expiresAt);
  const roleText = escape(p.role);
  const tenant = escape(p.tenantName);
  const inviter = escape(p.inviterName);
  const link = p.inviteLink;
  const escapedLink = escape(link);

  const detailLines: string[] = [];
  if (p.area) detailLines.push(`Área: ${escape(p.area)}`);
  if (p.position) detailLines.push(`Cargo: ${escape(p.position)}`);

  const subject = `Te invitaron a ${p.tenantName} en Novasys Asistencia`;

  const text = `${greeting}

${inviter} te invitó a unirte a ${p.tenantName} como ${p.role} en Novasys Asistencia, el sistema de control de asistencia del equipo.

${detailLines.length > 0 ? detailLines.join("\n") + "\n\n" : ""}Para aceptar la invitación y crear tu cuenta, abre este enlace:

${link}

Este enlace expira el ${expiryHuman}.

Si no esperabas esta invitación, simplemente ignora este correo.

— Novasys Asistencia
`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <!-- Header bar -->
          <tr>
            <td style="background:${color};padding:24px 32px;color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    ${
                      p.tenantLogoUrl
                        ? `<img src="${escape(p.tenantLogoUrl)}" alt="${tenant}" width="48" height="48" style="display:block;border-radius:8px;background:#ffffff;padding:4px;" />`
                        : `<div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:8px;text-align:center;line-height:48px;font-size:22px;font-weight:bold;color:#ffffff;">${tenant.slice(0, 1).toUpperCase()}</div>`
                    }
                  </td>
                  <td style="vertical-align:middle;padding-left:14px;">
                    <div style="font-size:18px;font-weight:600;line-height:1.2;">${tenant}</div>
                    <div style="font-size:12px;opacity:0.85;margin-top:2px;">vía Novasys Asistencia</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#111827;">Tienes una invitación</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">
                ${greeting}
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#374151;">
                <strong>${inviter}</strong> te invitó a unirte a <strong>${tenant}</strong> como
                <strong style="color:${color};">${roleText}</strong>.
                ${p.area || p.position ? "Los detalles de tu rol son:" : ""}
              </p>
              ${
                detailLines.length > 0
                  ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin:0 0 24px 0;">
                      ${detailLines
                        .map(
                          (line) =>
                            `<tr><td style="font-size:13px;color:#374151;padding:4px 0;">${line}</td></tr>`
                        )
                        .join("")}
                    </table>`
                  : ""
              }
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${escapedLink}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;">
                      Aceptar invitación
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.5;color:#6b7280;">
                O abre este enlace en tu navegador:<br />
                <a href="${escapedLink}" style="color:${color};word-break:break-all;">${escapedLink}</a>
              </p>
              <p style="margin:24px 0 0 0;font-size:13px;color:#6b7280;">
                Este enlace expira el <strong>${expiryHuman}</strong>. Si no esperabas esta invitación, puedes ignorar este correo.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Novasys Asistencia · Control de asistencia para equipos modernos
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
