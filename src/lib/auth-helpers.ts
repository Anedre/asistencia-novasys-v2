import { getServerSession } from "next-auth";
import { authOptions, type UserRole } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/utils/errors";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  employeeId: string;
  area: string;
  tenantId: string;
  tenantSlug: string;
}

/** Get session or throw UnauthorizedError */
export async function requireSession(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  const user = session.user as SessionUser;
  // Fallback for sessions created before multi-tenancy was added
  if (!user.tenantId) {
    user.tenantId = "TENANT#novasys";
    user.tenantSlug = "novasys";
  }
  return user;
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
  return (session?.user as SessionUser) ?? null;
}

/** Get session and require SUPER_ADMIN role */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (user.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Se requiere rol de super administrador");
  }
  return user;
}
