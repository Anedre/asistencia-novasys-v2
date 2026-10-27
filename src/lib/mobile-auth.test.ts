import { describe, it, expect, beforeEach } from "vitest";
import type { JWTPayload } from "jose";
import {
  extractBearerToken,
  assertIdTokenClaims,
  cognitoIssuer,
  identityFromIdToken,
} from "@/lib/mobile-auth";
import { AppError, UnauthorizedError } from "@/lib/utils/errors";

const POOL_ID = "us-east-1_TESTPOOL";
const CLIENT_ID = "testclientid";

beforeEach(() => {
  process.env.COGNITO_USER_POOL_ID = POOL_ID;
  process.env.COGNITO_CLIENT_ID_PASSWORD = CLIENT_ID;
});

describe("extractBearerToken", () => {
  it("pulls the token out of a well-formed header", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("accepts any casing of the scheme", () => {
    expect(extractBearerToken("bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(extractBearerToken("BEARER abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("tolerates surrounding and repeated whitespace", () => {
    expect(extractBearerToken("  Bearer   abc.def.ghi  ")).toBe("abc.def.ghi");
  });

  it("returns null when there is no token to read", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer   ")).toBeNull();
  });

  it("ignores other authorization schemes", () => {
    expect(extractBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(extractBearerToken("abc.def.ghi")).toBeNull();
  });
});

describe("assertIdTokenClaims", () => {
  const idToken: JWTPayload = {
    sub: "cognito-sub-1",
    email: "Andre@Novasys.com.pe",
    name: "Andre Novasys",
    token_use: "id",
  };

  it("accepts an ID token and lowercases the email", () => {
    expect(assertIdTokenClaims(idToken)).toEqual({
      sub: "cognito-sub-1",
      email: "andre@novasys.com.pe",
      name: "Andre Novasys",
    });
  });

  it("rejects an access token minted by the same pool", () => {
    // Cognito access tokens validate against the same JWKS, so this check is
    // the only thing keeping one from standing in for a login.
    expect(() => assertIdTokenClaims({ ...idToken, token_use: "access" })).toThrow(
      UnauthorizedError
    );
  });

  it("rejects a token with no token_use claim at all", () => {
    const withoutUse: JWTPayload = {
      sub: idToken.sub,
      email: idToken.email,
      name: idToken.name,
    };
    expect(() => assertIdTokenClaims(withoutUse)).toThrow(UnauthorizedError);
  });

  it("rejects a token missing sub or email", () => {
    expect(() => assertIdTokenClaims({ ...idToken, sub: undefined })).toThrow(
      UnauthorizedError
    );
    expect(() => assertIdTokenClaims({ ...idToken, email: undefined })).toThrow(
      UnauthorizedError
    );
  });

  it("falls back through name, given_name, then email", () => {
    const noName: JWTPayload = {
      sub: idToken.sub,
      email: idToken.email,
      token_use: "id",
    };
    expect(assertIdTokenClaims({ ...noName, given_name: "Andre" }).name).toBe("Andre");
    expect(assertIdTokenClaims(noName).name).toBe("andre@novasys.com.pe");
  });
});

describe("cognitoIssuer", () => {
  it("builds the issuer URL from the pool id", () => {
    expect(cognitoIssuer()).toBe(
      `https://cognito-idp.${process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${POOL_ID}`
    );
  });

  it("reports missing configuration as a server error, not a 401", () => {
    delete process.env.COGNITO_USER_POOL_ID;
    try {
      cognitoIssuer();
      throw new Error("deberia haber lanzado");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).not.toBeInstanceOf(UnauthorizedError);
      expect((error as AppError).statusCode).toBe(500);
    }
  });
});

describe("identityFromIdToken", () => {
  it("rejects a malformed token as unauthorized", async () => {
    // Must not leak out as a jose error: the route error handler would turn
    // that into a 500 instead of a 401.
    await expect(identityFromIdToken("not-a-jwt")).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });

  it("rejects an empty token as unauthorized", async () => {
    await expect(identityFromIdToken("")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
