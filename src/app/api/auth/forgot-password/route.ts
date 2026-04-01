import { NextRequest, NextResponse } from "next/server";
import {
  cognitoForgotPassword,
  cognitoConfirmForgotPassword,
  getCognitoErrorMessage,
} from "@/lib/cognito";

/**
 * POST /api/auth/forgot-password
 * Body: { email } → sends reset code
 * Body: { email, code, newPassword } → confirms reset
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, code, newPassword } = body;

    if (!email) {
      return NextResponse.json(
        { error: "El correo es obligatorio" },
        { status: 400 }
      );
    }

    // Step 2: Confirm reset with code + new password
    if (code && newPassword) {
      await cognitoConfirmForgotPassword(email, code, newPassword);
      return NextResponse.json({
        ok: true,
        message: "Contraseña actualizada correctamente",
      });
    }

    // Step 1: Initiate forgot password (send code to email)
    await cognitoForgotPassword(email);
    return NextResponse.json({
      ok: true,
      message: "Se envió un código de verificación a tu correo",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
