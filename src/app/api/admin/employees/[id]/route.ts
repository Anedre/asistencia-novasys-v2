import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getEmployeeById, updateEmployeeRole, deactivateEmployee, updateEmployeeProfile } from "@/lib/db/employees";
import { getDailySummaryRange } from "@/lib/db/daily-summary";
import { withErrorHandler } from "@/lib/utils/errors";
import { NotFoundError } from "@/lib/utils/errors";
import { updateEmployeeRoleSchema } from "@/lib/utils/validation";

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

/** PATCH: Update employee role or profile fields (admin only) */
export const PATCH = withErrorHandler(async (req: Request, context: unknown) => {
  await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();

  const employee = await getEmployeeById(id);
  if (!employee) {
    throw new NotFoundError("Empleado no encontrado");
  }

  // If updating role
  if (body.role !== undefined) {
    const parsed = updateEmployeeRoleSchema.parse(body);
    await updateEmployeeRole(id, parsed.role);
    return NextResponse.json({ ok: true, message: `Rol actualizado a ${parsed.role}` });
  }

  // If updating profile fields
  const updates: Record<string, string> = {};
  for (const key of ["Phone", "DNI", "Area", "Position", "WorkMode", "BirthDate"]) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length > 0) {
    await updateEmployeeProfile(id, updates);
    return NextResponse.json({ ok: true, message: "Empleado actualizado" });
  }

  return NextResponse.json({ ok: false, error: "No hay campos para actualizar" }, { status: 400 });
});

/** DELETE: Deactivate employee (admin only) */
export const DELETE = withErrorHandler(async (_req: Request, context: unknown) => {
  const admin = await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const employee = await getEmployeeById(id);
  if (!employee) {
    throw new NotFoundError("Empleado no encontrado");
  }

  // Prevent self-deactivation
  if (employee.EmployeeID === admin.employeeId) {
    return NextResponse.json(
      { ok: false, error: "No puedes desactivar tu propia cuenta" },
      { status: 400 }
    );
  }

  await deactivateEmployee(id);
  return NextResponse.json({ ok: true, message: "Empleado desactivado" });
});
