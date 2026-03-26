import { NextRequest, NextResponse } from "next/server";
import { getInvitationByToken } from "@/lib/db/invitations";
import { getTenantById } from "@/lib/db/tenants";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Token de invitacion requerido" },
      { status: 400 }
    );
  }

  try {
    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitacion no encontrada o invalida" },
        { status: 404 }
      );
    }

    if (invitation.Status !== "PENDING") {
      return NextResponse.json(
        { error: `Esta invitacion ya fue ${invitation.Status === "USED" ? "utilizada" : invitation.Status === "EXPIRED" ? "expirada" : "revocada"}` },
        { status: 410 }
      );
    }

    // Check expiration
    if (new Date(invitation.ExpiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Esta invitacion ha expirado" },
        { status: 410 }
      );
    }

    // Get tenant info
    const tenant = await getTenantById(invitation.TenantID);

    return NextResponse.json({
      ok: true,
      invitation: {
        email: invitation.Email,
        fullName: invitation.FullName || "",
        area: invitation.Area || "",
        position: invitation.Position || "",
        role: invitation.Role,
      },
      tenant: {
        name: tenant?.name || "Empresa",
        slug: tenant?.slug || "",
        logoUrl: tenant?.branding?.logoUrl || null,
      },
    });
  } catch (error) {
    console.error("[validate-invite]", error);
    return NextResponse.json(
      { error: "Error al validar la invitacion" },
      { status: 500 }
    );
  }
}
