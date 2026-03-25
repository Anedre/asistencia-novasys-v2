import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getEmployeeById } from "@/lib/db/employees";
import { getDailySummaryRange } from "@/lib/db/daily-summary";
import { withErrorHandler } from "@/lib/utils/errors";
import { NotFoundError } from "@/lib/utils/errors";

export const GET = withErrorHandler(async (req: Request, context: unknown) => {
  await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const employee = await getEmployeeById(id);
  if (!employee) {
    throw new NotFoundError("Empleado no encontrado");
  }

  // Last 30 days attendance
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 30);

  const toDateStr = today.toISOString().slice(0, 10);
  const fromDateStr = start.toISOString().slice(0, 10);

  const summaries = await getDailySummaryRange(id, fromDateStr, toDateStr);

  const recentAttendance = summaries.map((s) => ({
    date: s.WorkDate.replace("DATE#", ""),
    firstInLocal: s.firstInLocal ?? null,
    lastOutLocal: s.lastOutLocal ?? null,
    breakMinutes: s.breakMinutes ?? 0,
    workedMinutes: s.workedMinutes ?? 0,
    status: s.status,
  }));

  return NextResponse.json({
    ok: true,
    employee: {
      employeeId: employee.EmployeeID,
      email: employee.Email,
      dni: employee.DNI,
      fullName: employee.FullName,
      firstName: employee.FirstName,
      lastName: employee.LastName,
      phone: employee.Phone ?? null,
      birthDate: employee.BirthDate ?? null,
      hireDate: employee.HireDate ?? null,
      area: employee.Area,
      position: employee.Position,
      workMode: employee.WorkMode,
      status: employee.EmploymentStatus,
      role: employee.Role,
      avatarUrl: employee.AvatarUrl ?? null,
      schedule: employee.Schedule,
      createdAt: employee.CreatedAt,
      updatedAt: employee.UpdatedAt,
    },
    recentAttendance,
  });
});
