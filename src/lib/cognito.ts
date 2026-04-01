/**
 * Cognito SDK helpers for custom auth flow (no hosted UI).
 * Uses a User Pool Client WITHOUT client secret and with USER_PASSWORD_AUTH enabled.
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...((process.env.CUSTOM_ACCESS_KEY_ID && process.env.CUSTOM_SECRET_ACCESS_KEY) && {
    credentials: {
      accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
      secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
    },
  }),
});

const PASSWORD_CLIENT_ID = process.env.COGNITO_CLIENT_ID_PASSWORD!;

/** Decode a JWT token payload (no verification — Cognito tokens are trusted server-side). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
}

/** Error mapping: Cognito exception name → Spanish user-facing message */
const ERROR_MESSAGES: Record<string, string> = {
  NotAuthorizedException: "Correo o contraseña incorrectos",
  UserNotFoundException: "No existe una cuenta con ese correo",
  UserNotConfirmedException: "Tu cuenta no ha sido verificada. Revisa tu correo.",
  UsernameExistsException: "Ya existe una cuenta con ese correo",
  CodeMismatchException: "Código de verificación incorrecto",
  ExpiredCodeException: "El código ha expirado, solicita uno nuevo",
  InvalidPasswordException: "La contraseña no cumple los requisitos (mínimo 8 caracteres, mayúscula, minúscula, número)",
  LimitExceededException: "Demasiados intentos, intenta más tarde",
  InvalidParameterException: "Los datos ingresados no son válidos",
};

export function getCognitoErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name: string }).name;
    return ERROR_MESSAGES[name] || "Error de autenticación. Intenta nuevamente.";
  }
  return "Error inesperado. Intenta nuevamente.";
}

export function isCognitoError(error: unknown, name: string): boolean {
  return !!(error && typeof error === "object" && "name" in error && (error as { name: string }).name === name);
}

// ── Sign In ──

export interface CognitoSignInResult {
  sub: string;
  email: string;
  name: string;
  tokens: AuthenticationResultType;
}

export async function cognitoSignIn(
  email: string,
  password: string
): Promise<CognitoSignInResult> {
  const result = await cognitoClient.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: PASSWORD_CLIENT_ID,
      AuthParameters: {
        USERNAME: email.toLowerCase(),
        PASSWORD: password,
      },
    })
  );

  const tokens = result.AuthenticationResult!;
  const payload = decodeJwtPayload(tokens.IdToken!);

  return {
    sub: payload.sub as string,
    email: (payload.email as string) || email.toLowerCase(),
    name: (payload.name as string) || "",
    tokens,
  };
}

// ── Sign Up ──

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  nickname: string;
}

export async function cognitoSignUp(
  params: SignUpParams
): Promise<{ userSub: string; username: string }> {
  const { email, password, fullName, phoneNumber, nickname } = params;

  // When email is configured as an alias, Username must NOT be an email.
  // Use a UUID as the username; users will sign in via email alias.
  const username = crypto.randomUUID();

  const result = await cognitoClient.send(
    new SignUpCommand({
      ClientId: PASSWORD_CLIENT_ID,
      Username: username,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email.toLowerCase() },
        { Name: "name", Value: fullName },
        { Name: "phone_number", Value: phoneNumber },
        { Name: "nickname", Value: nickname },
      ],
    })
  );

  return { userSub: result.UserSub!, username };
}

// ── Confirm Sign Up ──

export async function cognitoConfirmSignUp(
  username: string,
  code: string
): Promise<void> {
  await cognitoClient.send(
    new ConfirmSignUpCommand({
      ClientId: PASSWORD_CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
    })
  );
}

// ── Resend Confirmation Code ──

export async function cognitoResendCode(username: string): Promise<void> {
  await cognitoClient.send(
    new ResendConfirmationCodeCommand({
      ClientId: PASSWORD_CLIENT_ID,
      Username: username,
    })
  );
}

// ── Forgot Password (initiate reset) ──

export async function cognitoForgotPassword(email: string): Promise<void> {
  await cognitoClient.send(
    new ForgotPasswordCommand({
      ClientId: PASSWORD_CLIENT_ID,
      Username: email.toLowerCase(),
    })
  );
}

// ── Confirm Forgot Password (set new password with code) ──

export async function cognitoConfirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  await cognitoClient.send(
    new ConfirmForgotPasswordCommand({
      ClientId: PASSWORD_CLIENT_ID,
      Username: email.toLowerCase(),
      ConfirmationCode: code,
      Password: newPassword,
    })
  );
}
