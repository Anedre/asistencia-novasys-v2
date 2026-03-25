import { NextResponse } from "next/server";
import { cognitoSignUp, getCognitoErrorMessage } from "@/lib/cognito";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    const result = await cognitoSignUp(email, password, fullName);

    return NextResponse.json({
      ok: true,
      userSub: result.userSub,
      message: "Cuenta creada. Revisa tu correo para el código de verificación.",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
