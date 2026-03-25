import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

export async function createEmployee(employee: Employee): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLES.EMPLOYEES,
      Item: employee,
      ConditionExpression: "attribute_not_exists(EmployeeID)",
    })
  );
}

export async function updateEmployeeProfile(
  employeeId: string,
  updates: {
    Phone?: string;
    AvatarUrl?: string;
    DNI?: string;
    Area?: string;
    Position?: string;
    WorkMode?: string;
    BirthDate?: string;
  }
): Promise<void> {
  const expressions: string[] = ["updatedAt = :now"];
  const values: Record<string, unknown> = { ":now": new Date().toISOString() };

  if (updates.Phone !== undefined) {
    expressions.push("Phone = :phone");
    values[":phone"] = updates.Phone;
  }
  if (updates.AvatarUrl !== undefined) {
    expressions.push("AvatarUrl = :avatar");
    values[":avatar"] = updates.AvatarUrl;
  }
  if (updates.DNI !== undefined) {
    expressions.push("DNI = :dni");
    values[":dni"] = updates.DNI;
  }
  if (updates.Area !== undefined) {
    expressions.push("Area = :area");
    values[":area"] = updates.Area;
  }
  if (updates.Position !== undefined) {
    expressions.push("#pos = :position");
    values[":position"] = updates.Position;
  }
  if (updates.WorkMode !== undefined) {
    expressions.push("WorkMode = :workMode");
    values[":workMode"] = updates.WorkMode;
  }
  if (updates.BirthDate !== undefined) {
    expressions.push("BirthDate = :birthDate");
    values[":birthDate"] = updates.BirthDate;
  }

  const names: Record<string, string> = {};
  if (updates.Position !== undefined) {
    names["#pos"] = "Position";
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

export async function updateEmployeeRole(
  employeeId: string,
  role: "ADMIN" | "EMPLOYEE"
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.EMPLOYEES,
      Key: { EmployeeID: employeeId },
      UpdateExpression: "SET #role = :role, updatedAt = :now",
      ExpressionAttributeNames: { "#role": "Role" },
      ExpressionAttributeValues: {
        ":role": role,
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function deactivateEmployee(employeeId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.EMPLOYEES,
      Key: { EmployeeID: employeeId },
      UpdateExpression: "SET EmploymentStatus = :status, updatedAt = :now",
      ExpressionAttributeValues: {
        ":status": "INACTIVE",
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function getAllEmployees(): Promise<Employee[]> {
  const items: Employee[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.EMPLOYEES,
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      })
    );
    items.push(...((result.Items as Employee[]) ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}
