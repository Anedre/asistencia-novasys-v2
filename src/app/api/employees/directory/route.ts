import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { withErrorHandler } from "@/lib/utils/errors";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const employees = await getAllActiveEmployees(user.tenantId);

  // Email and phone are sensitive PII. Only expose them to admins; regular
  // employees see the org-chart view (name, area, position, avatar).
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const directory = employees.map((e) => ({
    EmployeeID: e.EmployeeID,
    FullName: e.FullName,
    Email: isAdmin ? e.Email : null,
    Phone: isAdmin ? (e.Phone ?? null) : null,
    Area: e.Area,
    Position: e.Position,
    AvatarUrl: e.AvatarUrl ?? null,
  }));

  return NextResponse.json(directory);
});
