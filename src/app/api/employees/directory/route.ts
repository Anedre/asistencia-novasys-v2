import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const employees = await getAllActiveEmployees(user.tenantId);

  const directory = employees.map((e) => ({
    EmployeeID: e.EmployeeID,
    FullName: e.FullName,
    Email: e.Email,
    Phone: e.Phone ?? null,
    Area: e.Area,
    Position: e.Position,
    AvatarUrl: e.AvatarUrl ?? null,
  }));

  return NextResponse.json(directory);
});
