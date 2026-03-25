import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  await requireAdmin();
  const employees = await getAllActiveEmployees();

  const list = employees.map((e) => ({
    employeeId: e.EmployeeID,
    email: e.Email,
    fullName: e.FullName,
    area: e.Area,
    position: e.Position,
    role: e.Role,
    workMode: e.WorkMode,
    status: e.EmploymentStatus,
  }));

  return NextResponse.json({ ok: true, employees: list });
});
