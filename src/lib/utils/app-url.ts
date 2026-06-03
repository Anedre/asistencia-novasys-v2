/**
 * Resolve the public-facing base URL of the app.
 *
 * Source of truth is `NEXTAUTH_URL` (e.g. `https://app.novasys.com`). We
 * intentionally do NOT silently default to `http://localhost:3000` in
 * production: when invitation / email links are built from a missing env
 * var, recipients receive broken links that point to a local machine and
 * the admin spends hours wondering why people can't accept invites.
 *
 *   - In `NODE_ENV === "production"` the missing env throws so the
 *     misconfiguration surfaces immediately in logs / health-check.
 *   - In dev/test we fall back to `http://localhost:3000` so contributors
 *     don't have to set the env locally.
 */
export function getAppBaseUrl(): string {
  const raw = process.env.NEXTAUTH_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_URL no está configurado — los enlaces (invitaciones, emails) no se pueden construir en producción.",
    );
  }
  return "http://localhost:3000";
}
