import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAllEmployees } from "@/lib/db/employees";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") !== "false";

  const allEmployees = await getAllEmployees(user.tenantId);
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

  return NextResponse.json({ ok: true, employees: list });
});
