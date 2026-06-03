import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cognitoChangePassword, getCognitoErrorMessage } from "@/lib/cognito";

/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 * Requires authenticated session.
 *
 * Verifies the current password by re-auth, then changes via ChangePasswordCommand.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body ?? {};

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Debes ingresar tu contraseña actual y la nueva" },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "La nueva contraseña debe ser diferente de la actual" },
        { status: 400 }
      );
    }

    await cognitoChangePassword(session.user.email, currentPassword, newPassword);

    return NextResponse.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
