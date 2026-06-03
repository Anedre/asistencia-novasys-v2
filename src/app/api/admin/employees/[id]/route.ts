import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getEmployeeById, updateEmployeeRole, deactivateEmployee, updateEmployeeProfile } from "@/lib/db/employees";
import { getDailySummaryRange } from "@/lib/db/daily-summary";
import { getRequestsByEmployee } from "@/lib/db/requests";
import { workDateLima } from "@/lib/utils/time";
import { withErrorHandler } from "@/lib/utils/errors";
import { NotFoundError } from "@/lib/utils/errors";
import { updateEmployeeRoleSchema } from "@/lib/utils/validation";
import { withAudit } from "@/lib/services/audit.service";

export const GET = withErrorHandler(async (req: Request, context: unknown) => {
  const user = await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;

  const employee = await getEmployeeById(id);
  if (!employee) {
    throw new NotFoundError("Empleado no encontrado");
  }

  // Last 30 days attendance — anchored on Lima local "today" so the window
  // doesn't slide forward by a day between 19:00–23:59 Lima (UTC-5), when
  // toISOString().slice(0,10) would return tomorrow's date.
  const toDateStr = workDateLima();
  const startMs = new Date(toDateStr + "T00:00:00-05:00").getTime() - 30 * 86400000;
  const fromDateStr = workDateLima(new Date(startMs));

  const [summaries, requestsRaw] = await Promise.all([
    getDailySummaryRange(id, fromDateStr, toDateStr),
    getRequestsByEmployee(id, 50),
  ]);

  const recentAttendance = summaries.map((s) => ({
    date: s.WorkDate.replace("DATE#", ""),
    firstInLocal: s.firstInLocal ?? null,
    lastOutLocal: s.lastOutLocal ?? null,
    breakMinutes: s.breakMinutes ?? 0,
    workedMinutes: s.workedMinutes ?? 0,
    status: s.status,
  }));

  const requests = requestsRaw.map((r) => ({
    id: r.RequestID,
    requestType: r.requestType,
    status: r.status,
    dateFrom: r.dateFrom ?? null,
    dateTo: r.dateTo ?? null,
    effectiveDate: r.effectiveDate ?? null,
    createdAt: r.createdAt ?? null,
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
    requests,
  });
});

/** PATCH: Update employee role or profile fields (admin only) */
export const PATCH = withErrorHandler(async (req: Request, context: unknown) => {
  const admin = await requireAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await req.json();

  const employee = await getEmployeeById(id);
  if (!employee) {
    throw new NotFoundError("Empleado no encontrado");
  }

  // If updating role
  if (body.role !== undefined) {
    const parsed = updateEmployeeRoleSchema.parse(body);
    await withAudit(
      {
        actor: admin,
        entityType: "EMPLOYEE",
        entityKey: { EmployeeID: id },
        action: "UPDATE",
        reason: `Cambio de rol a ${parsed.role}`,
      },
      async () => updateEmployeeRole(id, parsed.role)
    );
    return NextResponse.json({ ok: true, message: `Rol actualizado a ${parsed.role}` });
  }

  // If updating profile fields
  const updates: Record<string, string> = {};
  for (const key of ["FullName", "FirstName", "LastName", "Phone", "DNI", "Area", "Position", "WorkMode", "BirthDate"]) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length > 0) {
    await withAudit(
      {
        actor: admin,
        entityType: "EMPLOYEE",
        entityKey: { EmployeeID: id },
        action: "UPDATE",
        reason: `Perfil actualizado: ${Object.keys(updates).join(", ")}`,
      },
      async () => updateEmployeeProfile(id, updates)
    );
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

  await withAudit(
    {
      actor: admin,
      entityType: "EMPLOYEE",
      entityKey: { EmployeeID: id },
      action: "DELETE",
      reason: "Desactivación de empleado",
    },
    async () => deactivateEmployee(id)
  );
  return NextResponse.json({ ok: true, message: "Empleado desactivado" });
});
