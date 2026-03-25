import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import { GetCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Employee } from "@/lib/types";

export async function getEmployeeById(employeeId: string): Promise<Employee | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.EMPLOYEES,
      Key: { EmployeeID: employeeId },
    })
  );
  return (result.Item as Employee) ?? null;
}

export async function getEmployeeByEmail(email: string): Promise<Employee | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EMPLOYEES,
      IndexName: INDEXES.EMPLOYEES_EMAIL,
      KeyConditionExpression: "Email = :email",
      ExpressionAttributeValues: { ":email": email.toLowerCase() },
      Limit: 1,
    })
  );
  return (result.Items?.[0] as Employee) ?? null;
}

export async function getEmployeeByCognitoSub(sub: string): Promise<Employee | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EMPLOYEES,
      IndexName: INDEXES.EMPLOYEES_COGNITO_SUB,
      KeyConditionExpression: "CognitoSub = :sub",
      ExpressionAttributeValues: { ":sub": sub },
      Limit: 1,
    })
  );
  return (result.Items?.[0] as Employee) ?? null;
}

export async function getAllActiveEmployees(): Promise<Employee[]> {
  const items: Employee[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.EMPLOYEES,
        FilterExpression: "EmploymentStatus = :active",
        ExpressionAttributeValues: { ":active": "ACTIVE" },
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      })
    );
    items.push(...((result.Items as Employee[]) ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

export async function getEmployeesByArea(area: string): Promise<Employee[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.EMPLOYEES,
      IndexName: INDEXES.EMPLOYEES_AREA,
      KeyConditionExpression: "Area = :area",
      ExpressionAttributeValues: { ":area": area },
    })
  );
  return (result.Items as Employee[]) ?? [];
}

export async function updateEmployeeProfile(
  employeeId: string,
  updates: { Phone?: string; AvatarUrl?: string }
): Promise<void> {
  const expressions: string[] = ["updatedAt = :now"];
  const values: Record<string, unknown> = { ":now": new Date().toISOString() };
  const names: Record<string, string> = {};

  if (updates.Phone !== undefined) {
    expressions.push("Phone = :phone");
    values[":phone"] = updates.Phone;
  }
  if (updates.AvatarUrl !== undefined) {
    expressions.push("AvatarUrl = :avatar");
    values[":avatar"] = updates.AvatarUrl;
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.EMPLOYEES,
      Key: { EmployeeID: employeeId },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length > 0 && { ExpressionAttributeNames: names }),
    })
  );
}
