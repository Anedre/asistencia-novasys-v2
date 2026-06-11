import { docClient } from "./client";
import { TABLES, INDEXES } from "./tables";
import { BatchGetCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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

export async function getAllActiveEmployees(tenantId?: string): Promise<Employee[]> {
  // Refuse the call without a tenant — falling through to a full table Scan
  // would return ALL employees across ALL tenants, which is the kind of
  // cross-tenant leak we want to make impossible. Callers must always pass
  // `user.tenantId` (the migration is long past).
  if (!tenantId) {
    throw new Error(
      "getAllActiveEmployees requires a tenantId — refusing to Scan the table",
    );
  }

  const items: Employee[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.EMPLOYEES,
        IndexName: INDEXES.EMPLOYEES_BY_TENANT,
        KeyConditionExpression: "TenantID = :tid",
        FilterExpression: "EmploymentStatus = :active",
        ExpressionAttributeValues: { ":tid": tenantId, ":active": "ACTIVE" },
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
    FullName?: string;
    FirstName?: string;
    LastName?: string;
    Phone?: string;
    AvatarUrl?: string;
    DNI?: string;
    Area?: string;
    Position?: string;
    WorkMode?: string;
    BirthDate?: string;
    ScheduleType?: string;
    Schedule?: { startTime: string; endTime: string; breakMinutes: number; type?: string };
    Location?: { lat: number; lng: number; address: string; formattedAddress: string };
  }
): Promise<void> {
  const expressions: string[] = ["updatedAt = :now"];
  const values: Record<string, unknown> = { ":now": new Date().toISOString() };

  if (updates.FullName !== undefined) {
    expressions.push("FullName = :fullName");
    values[":fullName"] = updates.FullName;
  }
  if (updates.FirstName !== undefined) {
    expressions.push("FirstName = :firstName");
    values[":firstName"] = updates.FirstName;
  }
  if (updates.LastName !== undefined) {
    expressions.push("LastName = :lastName");
    values[":lastName"] = updates.LastName;
  }
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
  if (updates.Schedule !== undefined) {
    expressions.push("Schedule = :schedule");
    values[":schedule"] = updates.Schedule;
  }
  if (updates.ScheduleType !== undefined) {
    expressions.push("ScheduleType = :scheduleType");
    values[":scheduleType"] = updates.ScheduleType;
    // Also update the Schedule map's type field if Schedule was not already replaced entirely
    if (updates.Schedule === undefined) {
      expressions.push("Schedule.#type = :scheduleType");
    }
  }
  if (updates.Location !== undefined) {
    expressions.push("#loc = :loc");
    values[":loc"] = updates.Location;
  }

  const names: Record<string, string> = {};
  if (updates.Position !== undefined) {
    names["#pos"] = "Position";
  }
  if (updates.ScheduleType !== undefined && updates.Schedule === undefined) {
    names["#type"] = "type";
  }
  if (updates.Location !== undefined) {
    names["#loc"] = "Location";
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

/** Hard-delete an employee row. Used only as part of register-company
 *  rollback. For normal admin de-activations use `deactivateEmployee` so the
 *  history (attendance, requests) stays intact. */
export async function deleteEmployee(employeeId: string): Promise<void> {
  const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.EMPLOYEES,
      Key: { EmployeeID: employeeId },
    }),
  );
}

export async function getAllEmployees(
  tenantId?: string,
  opts?: { limit?: number; cursor?: Record<string, unknown> },
): Promise<{ items: Employee[]; nextCursor?: Record<string, unknown> }> {
  if (!tenantId) {
    throw new Error(
      "getAllEmployees requires a tenantId — refusing to Scan the table",
    );
  }

  // When the caller provides a limit we return a single page (the value is
  // applied per request, so the total returned may be smaller). When no
  // limit is provided we keep the historical behaviour and walk every page,
  // but cap the absolute total at MAX_EMPLOYEES to avoid pulling unbounded
  // multi-MB JSON for huge tenants.
  const MAX_EMPLOYEES_DEFAULT = 1000;
  const items: Employee[] = [];
  let lastKey: Record<string, unknown> | undefined = opts?.cursor;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.EMPLOYEES,
        IndexName: INDEXES.EMPLOYEES_BY_TENANT,
        KeyConditionExpression: "TenantID = :tid",
        ExpressionAttributeValues: { ":tid": tenantId },
        ...(opts?.limit && { Limit: opts.limit }),
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      })
    );
    items.push(...((result.Items as Employee[]) ?? []));
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    if (opts?.limit) break;
    if (items.length >= MAX_EMPLOYEES_DEFAULT) break;
  } while (lastKey);
  return { items, nextCursor: lastKey };
}

// ── Presence ──────────────────────────────────────────────────────

export async function updatePresence(
  employeeId: string,
  status: "online" | "idle" | "offline"
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.EMPLOYEES,
      Key: { EmployeeID: employeeId },
      UpdateExpression: "SET LastActivityAt = :ts, PresenceStatus = :st",
      ExpressionAttributeValues: {
        ":ts": new Date().toISOString(),
        ":st": status,
      },
    })
  );
}

export async function updateTypingStatus(
  employeeId: string,
  channelId: string | null
): Promise<void> {
  if (channelId) {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.EMPLOYEES,
        Key: { EmployeeID: employeeId },
        UpdateExpression: "SET TypingInChannel = :ch",
        ExpressionAttributeValues: { ":ch": channelId },
      })
    );
  } else {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.EMPLOYEES,
        Key: { EmployeeID: employeeId },
        UpdateExpression: "REMOVE TypingInChannel",
      })
    );
  }
}

export async function getPresenceForEmployees(
  employeeIds: string[],
  tenantId?: string
): Promise<Record<string, { status: string; lastActivity: string; typingIn?: string }>> {
  const result: Record<string, { status: string; lastActivity: string; typingIn?: string }> = {};
  if (employeeIds.length === 0) return result;
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  // Batch up to 100 keys per BatchGetItem call (DynamoDB limit). The presence
  // endpoint is polled every 10s for every chat user, so the previous
  // sequential N+1 loop was making N round-trips per poll.
  const unique = Array.from(new Set(employeeIds));
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const res = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.EMPLOYEES]: {
            Keys: chunk.map((EmployeeID) => ({ EmployeeID })),
            ProjectionExpression: "EmployeeID, LastActivityAt, TypingInChannel, TenantID",
          },
        },
      }),
    );
    const items = (res.Responses?.[TABLES.EMPLOYEES] ?? []) as Array<{
      EmployeeID: string;
      LastActivityAt?: string;
      TypingInChannel?: string;
      TenantID?: string;
    }>;
    for (const emp of items) {
      // Tenant isolation: never leak presence for employees outside the caller's
      // tenant (the ids come straight from the client query string).
      if (tenantId && (emp.TenantID || "TENANT#novasys") !== tenantId) continue;
      const lastAct = emp.LastActivityAt ?? "";
      let status: string = "offline";
      if (lastAct > twoMinAgo) status = "online";
      else if (lastAct > fiveMinAgo) status = "idle";
      result[emp.EmployeeID] = {
        status,
        lastActivity: lastAct,
        typingIn: emp.TypingInChannel,
      };
    }
  }
  return result;
}
