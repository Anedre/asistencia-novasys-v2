import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { TABLES, INDEXES } from "@/lib/db/tables";
import { cognitoSignIn, getCognitoErrorMessage, isCognitoError } from "@/lib/cognito";

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

async function findEmployeeByCognitoSub(sub: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EMPLOYEES,
      IndexName: INDEXES.EMPLOYEES_COGNITO_SUB,
      KeyConditionExpression: "CognitoSub = :sub",
      ExpressionAttributeValues: { ":sub": sub },
      Limit: 1,
    })
  );
  return result.Items?.[0] ?? null;
}

async function findEmployeeByEmail(email: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EMPLOYEES,
      IndexName: INDEXES.EMPLOYEES_EMAIL,
      KeyConditionExpression: "Email = :email",
      ExpressionAttributeValues: { ":email": email.toLowerCase() },
      Limit: 1,
    })
  );
  return result.Items?.[0] ?? null;
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

          // Look up employee in DynamoDB
          let employee = await findEmployeeByCognitoSub(cognitoResult.sub);
          if (!employee) {
            employee = await findEmployeeByEmail(cognitoResult.email);
          }

          if (employee) {
            // Extract tenant slug from TenantID (e.g., "TENANT#novasys" → "novasys")
            const tenantId = employee.TenantID || "TENANT#novasys";
            const tenantSlug = tenantId.replace("TENANT#", "");

            return {
              id: employee.EmployeeID,
              email: cognitoResult.email,
              name: employee.FullName || cognitoResult.name,
              role: (employee.Role as UserRole) || "EMPLOYEE",
              area: employee.Area || "",
              employeeId: employee.EmployeeID,
              tenantId,
              tenantSlug,
            };
          }

          // Employee not found in DynamoDB — allow login with default tenant
          return {
            id: `EMP#${cognitoResult.email}`,
            email: cognitoResult.email,
            name: cognitoResult.name,
            role: "EMPLOYEE" as UserRole,
            area: "",
            employeeId: `EMP#${cognitoResult.email}`,
            tenantId: "TENANT#novasys",
            tenantSlug: "novasys",
          };
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
    maxAge: 12 * 60 * 60, // 12 hours
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
