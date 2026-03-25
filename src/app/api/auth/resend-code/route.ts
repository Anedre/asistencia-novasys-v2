import { NextResponse } from "next/server";
import { cognitoResendCode, getCognitoErrorMessage } from "@/lib/cognito";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Correo es requerido" },
        { status: 400 }
      );
    }

    await cognitoResendCode(email);

    return NextResponse.json({
      ok: true,
      message: "Código reenviado exitosamente.",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
