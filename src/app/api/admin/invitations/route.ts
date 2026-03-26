import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getInvitationsByTenant, createInvitation } from "@/lib/db/invitations";
import type { Invitation } from "@/lib/types/invitation";

export const GET = withErrorHandler(async () => {
  const user = await requireAdmin();
  const invitations = await getInvitationsByTenant(user.tenantId);
  return NextResponse.json({ invitations });
});

export const POST = withErrorHandler(async (request: Request) => {
  const user = await requireAdmin();
  const body = await request.json();

  const { email, fullName, area, position, role } = body as {
    email?: string;
    fullName?: string;
    area?: string;
    position?: string;
    role?: "EMPLOYEE" | "ADMIN";
  };

  if (!email) {
    return NextResponse.json(
      { error: "El correo es requerido" },
      { status: 400 }
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const token = crypto.randomUUID();

  const invitation: Invitation = {
    InviteID: `INV#${crypto.randomUUID()}`,
    TenantID: user.tenantId,
    Email: email.toLowerCase().trim(),
    FullName: fullName?.trim() || undefined,
    InvitedBy: user.employeeId,
    InvitedByName: user.name,
    Role: role || "EMPLOYEE",
    Area: area?.trim() || undefined,
    Position: position?.trim() || undefined,
    Status: "PENDING",
    Token: token,
    CreatedAt: now.toISOString(),
    ExpiresAt: expiresAt.toISOString(),
  };

  await createInvitation(invitation);

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const inviteLink = `${baseUrl}/register?invite=${token}`;

  return NextResponse.json({
    ok: true,
    invitation,
    inviteLink,
  });
});
