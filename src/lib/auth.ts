import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { TABLES } from "@/lib/db/tables";
import { cognitoSignIn, getCognitoErrorMessage, isCognitoError } from "@/lib/cognito";
import { resolveEmployeeIdentity } from "@/lib/employee-session";

export type UserRole = "ADMIN" | "EMPLOYEE" | "SUPER_ADMIN";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      employeeId: string;
      area: string;
      tenantId: string;
      tenantSlug: string;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    employeeId: string;
    area: string;
    tenantId: string;
    tenantSlug: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "cognito-credentials",
      name: "Cognito",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Correo y contraseña son requeridos");
        }

        try {
          // Authenticate against Cognito
          const cognitoResult = await cognitoSignIn(
            credentials.email,
            credentials.password
          );

          // Resolved through the shared resolver so this session and a mobile
          // Bearer token can never disagree on role or tenant.
          return await resolveEmployeeIdentity({
            sub: cognitoResult.sub,
            email: cognitoResult.email,
            name: cognitoResult.name,
          });
        } catch (error) {
          if (isCognitoError(error, "UserNotConfirmedException")) {
            throw new Error("USER_NOT_CONFIRMED");
          }
          throw new Error(getCognitoErrorMessage(error));
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
    updateAge: 24 * 60 * 60,   // refresca el JWT como máximo 1 vez al día
  },
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, user object is populated from authorize()
      if (user) {
        const u = user as unknown as {
          id: string;
          email?: string;
          name?: string;
          role?: string;
          area?: string;
          employeeId?: string;
          tenantId?: string;
          tenantSlug?: string;
        };
        token.employeeId = u.employeeId || u.id;
        token.role = (u.role as UserRole) || "EMPLOYEE";
        token.area = u.area || "";
        token.name = u.name || "";
        token.email = u.email || "";
        token.tenantId = u.tenantId || "TENANT#novasys";
        token.tenantSlug = u.tenantSlug || "novasys";
      }

      // Refresh role from DB on every token renewal so admin promotions
      // take effect without requiring the user to log out and back in.
      if (token.employeeId) {
        try {
          const result = await docClient.send(
            new GetCommand({
              TableName: TABLES.EMPLOYEES,
              Key: { EmployeeID: token.employeeId as string },
              ProjectionExpression: "#r, Area",
              ExpressionAttributeNames: { "#r": "Role" },
            })
          );
          if (result.Item) {
            token.role = (result.Item.Role as UserRole) || token.role;
            token.area = (result.Item.Area as string) || token.area;
          }
        } catch {
          // If DB lookup fails, keep existing token values
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.employeeId = token.employeeId;
        session.user.area = token.area;
        session.user.id = token.employeeId;
        session.user.tenantId = token.tenantId;
        session.user.tenantSlug = token.tenantSlug;
      }
      return session;
    },
  },
};
