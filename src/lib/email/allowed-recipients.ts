/**
 * Recipient guard for the email diagnostics endpoint.
 *
 * The test button needs to target other people (an invitation that never
 * arrived is the whole reason it exists), but an endpoint that mails any
 * address an attacker supplies is an open relay wearing a different hat. So a
 * requested recipient is only honoured when it already belongs to the tenant:
 * an employee, or someone with a pending invitation.
 */

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export type RecipientDecision =
  | { ok: true; to: string }
  | { ok: false; error: string };

export function resolveTestRecipient(params: {
  /** Address asked for by the caller; absent means "send to myself". */
  requested?: string | null;
  /** The caller's own address, always allowed. */
  fallback: string;
  /** Addresses known to the tenant (employees + pending invitations). */
  allowed: string[];
}): RecipientDecision {
  const { requested, fallback, allowed } = params;

  if (!requested || !normalizeEmail(requested)) {
    if (!fallback) return { ok: false, error: "No hay una dirección de destino" };
    return { ok: true, to: fallback };
  }

  const target = normalizeEmail(requested);
  const permitted = new Set(
    [fallback, ...allowed].filter(Boolean).map((e) => normalizeEmail(e))
  );

  if (!permitted.has(target)) {
    return {
      ok: false,
      error: "Solo puedes enviar la prueba a una dirección de tu empresa",
    };
  }
  return { ok: true, to: target };
}
