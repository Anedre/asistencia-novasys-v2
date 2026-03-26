import { NextResponse } from "next/server";
import { cognitoSignUp, getCognitoErrorMessage } from "@/lib/cognito";
import { createEmployee } from "@/lib/db/employees";
import { createTenant, getTenantBySlug } from "@/lib/db/tenants";
import type { Employee } from "@/lib/types";
import type { Tenant } from "@/lib/types/tenant";

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
    const {
      companyName,
      companySlug,
      fullName,
      email,
      phoneNumber,
      password,
      nickname,
    } = body as {
      companyName?: string;
      companySlug?: string;
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      password?: string;
      nickname?: string;
    };

    // Validate required fields
    if (!companyName || !companySlug || !fullName || !email || !password || !phoneNumber) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    // Validate slug format (lowercase, alphanumeric, hyphens)
    const slugRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
    if (!slugRegex.test(companySlug)) {
      return NextResponse.json(
        { error: "El slug debe ser alfanumerico (minusculas), entre 3-50 caracteres, puede contener guiones" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingTenant = await getTenantBySlug(companySlug);
    if (existingTenant) {
      return NextResponse.json(
        { error: "Este nombre de empresa ya esta registrado. Elige otro slug." },
        { status: 409 }
      );
    }

    // 1) Create user in Cognito
    const cognitoResult = await cognitoSignUp({
      email,
      password,
      fullName,
      phoneNumber,
      nickname: nickname || companySlug,
    });

    const now = new Date().toISOString();
    const tenantId = `TENANT#${companySlug}`;

    // 2) Create Tenant record
    const tenant: Tenant = {
      TenantID: tenantId,
      slug: companySlug,
      name: companyName.trim(),
      branding: {
        primaryColor: "#2563eb",
        secondaryColor: "#1e40af",
        accentColor: "#3b82f6",
      },
      settings: {
        approvalRequired: false,
        defaultScheduleType: "FULL_TIME",
        timezone: "America/Lima",
        features: {
          chat: false,
          social: false,
          aiAssistant: false,
        },
      },
      plan: "FREE",
      maxEmployees: 25,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };

    await createTenant(tenant);

    // 3) Create Employee record as ADMIN of the new tenant
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const employee: Employee = {
      TenantID: tenantId,
      EmployeeID: `EMP#${email.toLowerCase()}`,
      Email: email.toLowerCase(),
      DNI: `PENDING-${Date.now()}`,
      FullName: fullName.trim(),
      FirstName: firstName,
      LastName: lastName,
      Phone: phoneNumber,
      Area: "Administracion",
      Position: "Administrador",
      WorkMode: "ONSITE",
      EmploymentStatus: "ACTIVE",
      Role: "ADMIN",
      CognitoSub: cognitoResult.userSub,
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
      console.error("[register-company] Error creating employee:", dbError);
    }

    return NextResponse.json({
      ok: true,
      userSub: cognitoResult.userSub,
      username: cognitoResult.username,
      tenantSlug: companySlug,
      message: "Empresa registrada. Revisa tu correo para el codigo de verificacion.",
    });
  } catch (error) {
    const message = getCognitoErrorMessage(error);
    console.error("[register-company]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
