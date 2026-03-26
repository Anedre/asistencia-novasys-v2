import { NextResponse } from "next/server";
import { cognitoSignUp, getCognitoErrorMessage } from "@/lib/cognito";
import { createEmployee } from "@/lib/db/employees";
import type { Employee } from "@/lib/types";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalido en el request" },
      { status: 400 }
    );
  }

  try {
    const { email, password, fullName, phoneNumber, nickname } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      phoneNumber?: string;
      nickname?: string;
    };

    if (!email || !password || !fullName || !phoneNumber || !nickname) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // 1) Create user in Cognito
    const result = await cognitoSignUp({
      email,
      password,
      fullName,
      phoneNumber,
      nickname,
    });

    // 2) Create employee record in DynamoDB
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const now = new Date().toISOString();

    const employee: Employee = {
      TenantID: "TENANT#novasys",
      EmployeeID: `EMP#${email.toLowerCase()}`,
      Email: email.toLowerCase(),
      DNI: `PENDING-${Date.now()}`,
      FullName: fullName.trim(),
      FirstName: firstName,
      LastName: lastName,
      Phone: phoneNumber,
      Area: "General",
      Position: "Empleado",
      WorkMode: "ONSITE",
      EmploymentStatus: "ACTIVE",
      Role: "EMPLOYEE",
      CognitoSub: result.userSub,
      Schedule: {
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: 60,
        type: "FULL_TIME",
      },
      ScheduleType: "FULL_TIME",
      CreatedAt: now,
      UpdatedAt: now,
    };

    try {
      await createEmployee(employee);
    } catch (dbError) {
      console.error("[register] Error creating employee in DynamoDB:", dbError);
      // Don't fail registration if DB creation fails — user can still login
    }

    return NextResponse.json({
      ok: true,
      userSub: result.userSub,
      username: result.username,
      message: "Cuenta creada. Revisa tu correo para el codigo de verificacion.",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    console.error("[register]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
