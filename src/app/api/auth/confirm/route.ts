import { NextResponse } from "next/server";
import { cognitoConfirmSignUp, getCognitoErrorMessage } from "@/lib/cognito";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, code } = body;

    if (!username || !code) {
      return NextResponse.json(
        { error: "Username y código son requeridos" },
        { status: 400 }
      );
    }

    await cognitoConfirmSignUp(username, code);

    return NextResponse.json({
      ok: true,
      message: "Cuenta verificada exitosamente.",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
