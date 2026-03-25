import { NextResponse } from "next/server";
import { cognitoSignUp, getCognitoErrorMessage } from "@/lib/cognito";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch (parseError) {
    return NextResponse.json(
      { error: "JSON inválido en el request", detail: String(parseError) },
      { status: 400 }
    );
  }

  try {
    const { email, password, fullName, phoneNumber, nickname } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      phoneNumber?: string;
      nickname?: string;
    };

    if (!email || !password || !fullName || !phoneNumber || !nickname) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos", received: Object.keys(body) },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    const result = await cognitoSignUp({
      email,
      password,
      fullName,
      phoneNumber,
      nickname,
    });

    return NextResponse.json({
      ok: true,
      userSub: result.userSub,
      message: "Cuenta creada. Revisa tu correo para el código de verificación.",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    const code = (error && typeof error === "object" && "name" in error)
      ? (error as { name: string }).name
      : "Unknown";
    const detail = (error && typeof error === "object" && "message" in error)
      ? (error as { message: string }).message
      : String(error);
    console.error("[register]", code, detail);
    return NextResponse.json({ error: message, code, detail }, { status: 400 });
  }
}
