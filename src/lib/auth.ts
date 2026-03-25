import type { NextAuthOptions, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CognitoProvider from "next-auth/providers/cognito";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { TABLES, INDEXES } from "@/lib/db/tables";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export type UserRole = "ADMIN" | "EMPLOYEE";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      employeeId: string;
      area: string;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    employeeId: string;
    area: string;
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
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
      issuer: process.env.COGNITO_ISSUER!,
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
    async jwt({ token, account, profile }) {
      // On initial sign-in, look up the employee in DynamoDB
      if (account && profile) {
        const sub = account.providerAccountId || (profile as { sub?: string }).sub;
        const email = token.email || (profile as { email?: string }).email;

        let employee = sub ? await findEmployeeByCognitoSub(sub) : null;
        if (!employee && email) {
          employee = await findEmployeeByEmail(email);
        }

        if (employee) {
          token.employeeId = employee.EmployeeID;
          token.role = (employee.Role as UserRole) || "EMPLOYEE";
          token.area = employee.Area || "";
          token.name = employee.FullName || token.name;
        } else {
          // Employee not found — default to EMPLOYEE role
          token.employeeId = email ? `EMP#${email.toLowerCase()}` : "EMP#UNKNOWN";
          token.role = "EMPLOYEE";
          token.area = "";
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
      }
      return session;
    },
  },
};
