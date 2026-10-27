import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "@/lib/auth";
import type { EmployeeIdentity } from "@/lib/employee-session";
import { extractBearerToken, identityFromIdToken } from "@/lib/mobile-auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/utils/errors";

/** The authenticated caller, however they authenticated. */
export type SessionUser = EmployeeIdentity;

/**
 * Resolve a native client's `Authorization: Bearer <id-token>` header.
 *
 * Returns null when the request carries no token at all. A token that is
 * present but invalid throws, so a broken client gets a clear 401 instead of
 * silently looking like an anonymous request.
 */
async function sessionFromBearerToken(): Promise<SessionUser | null> {
  let token: string | null = null;
  try {
    token = extractBearerToken((await headers()).get("authorization"));
  } catch {
    // `headers()` only works inside a request scope. Outside one there is no
    // token to read, and the cookie path has already come up empty.
    return null;
  }
  if (!token) return null;
  return identityFromIdToken(token);
}

/** Get session or throw UnauthorizedError */
export async function requireSession(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const user = session.user as SessionUser;
    // Fallback for sessions created before multi-tenancy was added
    if (!user.tenantId) {
      user.tenantId = "TENANT#novasys";
      user.tenantSlug = "novasys";
    }
    return user;
  }

  const mobileUser = await sessionFromBearerToken();
  if (mobileUser) return mobileUser;

  throw new UnauthorizedError();
}

/** Get session and require ADMIN role */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.role !== "ADMIN") {
    throw new ForbiddenError("Se requiere rol de administrador");
  }
  return user;
}

/** Get session — returns null if not authenticated (no throw) */
export async function getSession(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (session?.user) return session.user as SessionUser;

  try {
    return await sessionFromBearerToken();
  } catch {
    // This variant promises never to throw, so an invalid token reads as
    // "not authenticated" here.
    return null;
  }
}

/** Get session and require SUPER_ADMIN role */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Se requiere rol de super administrador");
  }
  return user;
}
