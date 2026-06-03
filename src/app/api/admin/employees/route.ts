import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAllEmployees } from "@/lib/db/employees";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") !== "false";
  const limitParam = url.searchParams.get("limit");
  const cursorParam = url.searchParams.get("cursor");
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10) || 0), 500) : undefined;
  let cursor: Record<string, unknown> | undefined;
  if (cursorParam) {
    try {
      cursor = JSON.parse(Buffer.from(cursorParam, "base64").toString("utf-8"));
    } catch {
      // Ignore malformed cursors — they just trigger a fresh page from the start.
    }
  }

  const { items: allEmployees, nextCursor } = await getAllEmployees(
    user.tenantId,
    { limit, cursor },
  );
  const employees = activeOnly
    ? allEmployees.filter((e) => e.EmploymentStatus === "ACTIVE")
    : allEmployees;

  const list = employees.map((e) => ({
    employeeId: e.EmployeeID,
    email: e.Email,
    fullName: e.FullName,
    firstName: e.FirstName,
    lastName: e.LastName,
    dni: e.DNI,
    area: e.Area,
    position: e.Position,
    role: e.Role,
    workMode: e.WorkMode,
    status: e.EmploymentStatus,
    phone: e.Phone ?? null,
    scheduleType: e.ScheduleType ?? e.Schedule?.type ?? "FULL_TIME",
  }));

  // Encode cursor as base64-JSON so the client can pass it back opaquely.
  const nextCursorEncoded = nextCursor
    ? Buffer.from(JSON.stringify(nextCursor), "utf-8").toString("base64")
    : null;

  return NextResponse.json({
    ok: true,
    employees: list,
    nextCursor: nextCursorEncoded,
  });
});
