/**
 * Bearer-token authentication for native clients (the Android app).
 *
 * The web app carries a NextAuth session cookie. A native client has no cookie
 * jar we control, so it authenticates against the Cognito user pool directly
 * (USER_PASSWORD_AUTH, the same flow `cognitoSignIn` uses) and sends the
 * resulting **ID token** as `Authorization: Bearer <token>`.
 *
 * This module verifies that token against the pool's published JWKS and
 * resolves it through `resolveEmployeeIdentity`, so a mobile caller ends up
 * with exactly the identity the cookie path would have produced.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  resolveEmployeeIdentity,
  type EmployeeIdentity,
  type CognitoIdentity,
} from "@/lib/employee-session";
import { AppError, UnauthorizedError } from "@/lib/utils/errors";

const REGION =
  process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1";

/** Allow a little clock drift — phone clocks are not always in sync. */
const CLOCK_TOLERANCE_SECONDS = 30;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // A missing pool id is a deployment problem, not a bad request, so this
    // must not surface to the client as "unauthorized".
    throw new AppError(`Falta la variable de entorno ${name}`, 500, "CONFIG_ERROR");
  }
  return value;
}

export function cognitoIssuer(): string {
  return `https://cognito-idp.${REGION}.amazonaws.com/${requiredEnv("COGNITO_USER_POOL_ID")}`;
}

// `createRemoteJWKSet` caches the fetched keys in the returned function and
// only refetches when it sees an unknown `kid`, so this is built once per
// process rather than per request.
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(issuer: string) {
  if (!cachedJwks) {
    cachedJwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }
  return cachedJwks;
}

/** Pull the token out of an `Authorization: Bearer <token>` header. */
export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Validate the Cognito-specific claims a verified ID token must carry.
 *
 * Signature, issuer, audience and expiry are checked by `jwtVerify`; what is
 * left is making sure this is an **ID** token. Cognito mints access tokens
 * from the same pool, and accepting one here would let a token issued for a
 * different purpose stand in for a login.
 */
export function assertIdTokenClaims(payload: JWTPayload): CognitoIdentity {
  if (payload.token_use !== "id") {
    throw new UnauthorizedError("Token inválido");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!sub || !email) {
    throw new UnauthorizedError("Token sin identidad");
  }

  const name =
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.given_name === "string" && payload.given_name) ||
    email;

  return { sub, email, name };
}

/** Verify a Cognito ID token and resolve it to an employee identity. */
export async function identityFromIdToken(token: string): Promise<EmployeeIdentity> {
  const issuer = cognitoIssuer();
  const audience = requiredEnv("COGNITO_CLIENT_ID_PASSWORD");

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, getJwks(issuer), {
      issuer,
      audience,
      algorithms: ["RS256"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    payload = verified.payload;
  } catch (error) {
    // Anything jose rejects is a bad credential, not a server fault. Without
    // this the route's error handler would report a 500 for an expired token.
    if (error instanceof AppError) throw error;
    const code = (error as { code?: string })?.code;
    if (code === "ERR_JWT_EXPIRED") {
      throw new UnauthorizedError("Token expirado");
    }
    throw new UnauthorizedError("Token inválido");
  }

  return resolveEmployeeIdentity(assertIdTokenClaims(payload));
}
