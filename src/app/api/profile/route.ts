import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getEmployeeById, updateEmployeeProfile } from "@/lib/db/employees";
import { updateProfileSchema } from "@/lib/utils/validation";
import { withErrorHandler } from "@/lib/utils/errors";
import { NotFoundError } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  const session = await requireSession();
  const employee = await getEmployeeById(session.employeeId);

  if (!employee) {
    throw new NotFoundError("Empleado no encontrado");
  }

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
  });
});

export const PUT = withErrorHandler(async (req: Request) => {
  const session = await requireSession();
  const body = await req.json();
  const validated = updateProfileSchema.parse(body);

  await updateEmployeeProfile(session.employeeId, validated);

  return NextResponse.json({ ok: true });
});
