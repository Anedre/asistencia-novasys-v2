"use client";

/**
 * Pending invitations panel.
 *
 * The invitations list endpoint and its hook already existed but nothing
 * rendered them, so once an invitation was created it became invisible: an
 * admin had no way to tell whether someone was still pending, and no way to
 * act when the email never reached them.
 *
 * SES can report a clean delivery for a message that landed in the recipient's
 * spam folder, so "Reenviar" is not enough on its own — "Copiar enlace" is the
 * escape hatch for handing the link over by WhatsApp.
 */

import { useState } from "react";
import { IconSvg, Icons } from "@/components/nova/icons";
import { useInvitations, useResendInvitation, useRevokeInvitation } from "@/hooks/use-invitations";

type Feedback = { id: string; kind: "ok" | "warn" | "error"; text: string };

function daysLeft(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
}

export function PendingInvitations() {
  const { data, isLoading } = useInvitations();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const pending = (data?.invitations ?? []).filter((i) => i.Status === "PENDING");

  // Nothing pending is the normal state — stay out of the way entirely.
  if (isLoading || pending.length === 0) return null;

  async function handleResend(inviteId: string, email: string) {
    setBusyId(inviteId);
    setFeedback(null);
    try {
      const res = await resend.mutateAsync(inviteId);
      setFeedback(
        res.emailSent
          ? { id: inviteId, kind: "ok", text: `Correo reenviado a ${email}` }
          : {
              id: inviteId,
              kind: "warn",
              text: `No se pudo enviar el correo (${res.emailError ?? "error desconocido"}). Usa "Copiar enlace".`,
            }
      );
    } catch (err) {
      setFeedback({
        id: inviteId,
        kind: "error",
        text: err instanceof Error ? err.message : "Error al reenviar",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy(inviteId: string, token: string) {
    const link = `${window.location.origin}/register?invite=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setFeedback({ id: inviteId, kind: "ok", text: "Enlace copiado al portapapeles" });
    } catch {
      // Clipboard needs a secure context and can be blocked; show the link so
      // it can still be selected by hand.
      setFeedback({ id: inviteId, kind: "warn", text: link });
    }
  }

  async function handleRevoke(inviteId: string) {
    setBusyId(inviteId);
    try {
      await revoke.mutateAsync(inviteId);
      setFeedback(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="table-wrap" style={{ marginBottom: 20 }}>
      <div className="table-toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Invitaciones pendientes
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {pending.length} persona{pending.length === 1 ? "" : "s"} sin completar su registro.
            Si no recibieron el correo, revisa su carpeta de spam o reenvía.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {pending.map((inv) => {
          const left = daysLeft(inv.ExpiresAt);
          const expired = left <= 0;
          const busy = busyId === inv.InviteID;
          const fb = feedback?.id === inv.InviteID ? feedback : null;

          return (
            <div
              key={inv.InviteID}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                padding: "10px 14px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {inv.FullName || inv.Email}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {inv.Email}
                  {inv.Area ? ` · ${inv.Area}` : ""}
                </div>
              </div>

              <span
                className="chip"
                style={{
                  fontSize: 10.5,
                  color: expired ? "var(--danger)" : "var(--text-secondary)",
                }}
              >
                {expired ? "Expirada" : `Expira en ${left} día${left === 1 ? "" : "s"}`}
              </span>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="btn outline btn-sm"
                  onClick={() => handleResend(inv.InviteID, inv.Email)}
                  disabled={busy}
                >
                  <IconSvg d={Icons.mail} size={13} />
                  {busy && resend.isPending ? "Enviando…" : "Reenviar"}
                </button>
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  onClick={() => handleCopy(inv.InviteID, inv.Token)}
                  disabled={busy}
                >
                  <IconSvg d={Icons.copy} size={13} /> Copiar enlace
                </button>
                <button
                  type="button"
                  className="btn ghost btn-sm"
                  onClick={() => handleRevoke(inv.InviteID)}
                  disabled={busy}
                  title="Revocar invitación"
                >
                  <IconSvg d={Icons.trash} size={13} />
                </button>
              </div>

              {fb && (
                <div
                  style={{
                    flexBasis: "100%",
                    fontSize: 11,
                    wordBreak: "break-all",
                    color:
                      fb.kind === "ok"
                        ? "var(--success)"
                        : fb.kind === "warn"
                          ? "var(--warning)"
                          : "var(--danger)",
                  }}
                >
                  {fb.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
