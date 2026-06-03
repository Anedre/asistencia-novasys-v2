import { NextRequest, NextResponse } from "next/server";
import {
  cognitoForgotPassword,
  cognitoConfirmForgotPassword,
  getCognitoErrorMessage,
  isCognitoError,
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

    // Step 1: Initiate forgot password (send code to email).
    //
    // To prevent email enumeration we ALWAYS return the same success message
    // here regardless of whether the address exists. The `UserNotFoundException`
    // path is treated as a soft success so attackers can't iterate emails.
    try {
      await cognitoForgotPassword(email);
    } catch (err) {
      if (!isCognitoError(err, "UserNotFoundException")) throw err;
    }
    return NextResponse.json({
      ok: true,
      message:
        "Si la cuenta existe, te enviamos un código de verificación a tu correo",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
