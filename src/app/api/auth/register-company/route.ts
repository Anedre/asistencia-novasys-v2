import { NextResponse } from "next/server";
import { cognitoDeleteUser, cognitoSignUp, getCognitoErrorMessage } from "@/lib/cognito";
import { createEmployee, deleteEmployee } from "@/lib/db/employees";
import { createTenant, deleteTenant, getTenantBySlug } from "@/lib/db/tenants";
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
        { error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // ── Saga: create Tenant → Cognito user → Employee, rolling back
    //    each completed step on failure of the next so we never leave
    //    orphan Cognito accounts or half-created tenants.
    //
    //    Step 1 (create tenant) is conditional on attribute_not_exists,
    //    which makes the slug claim atomic: two concurrent registrations
    //    with the same slug — the loser gets ConditionalCheckFailed.

    // Cheap pre-check just to give a 409 with a clear message before we
    // start spending Cognito quota; the conditional put below is the
    // real source of truth.
    const existingTenant = await getTenantBySlug(companySlug);
    if (existingTenant) {
      return NextResponse.json(
        { error: "Este nombre de empresa ya esta registrado. Elige otro slug." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const tenantId = `TENANT#${companySlug}`;
    const employeeId = `EMP#${email.toLowerCase()}`;
    let tenantCreated = false;
    let cognitoUsername: string | null = null;

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

    try {
      // 1) Create Tenant first — conditional on attribute_not_exists,
      //    so a slug race resolves cleanly at this step.
      await createTenant(tenant);
      tenantCreated = true;
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "name" in err &&
        (err as { name: string }).name === "ConditionalCheckFailedException"
      ) {
        return NextResponse.json(
          { error: "Este nombre de empresa ya esta registrado. Elige otro slug." },
          { status: 409 },
        );
      }
      throw err;
    }

    let cognitoResult: { userSub: string; username: string };
    try {
      // 2) Create user in Cognito
      cognitoResult = await cognitoSignUp({
        email,
        password,
        fullName,
        phoneNumber,
        nickname: nickname || companySlug,
      });
      cognitoUsername = cognitoResult.username;
    } catch (err) {
      // Roll back the tenant — no admin user => unusable tenant.
      if (tenantCreated) await deleteTenant(tenantId).catch(() => undefined);
      throw err;
    }

    // 3) Create Employee record as ADMIN of the new tenant
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const employee: Employee = {
      TenantID: tenantId,
      EmployeeID: employeeId,
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
      // Roll back Cognito + Tenant — an orphan Cognito account that
      // cannot sign in (no employee row) is the worst possible state.
      if (cognitoUsername)
        await cognitoDeleteUser(cognitoUsername).catch(() => undefined);
      if (tenantCreated) await deleteTenant(tenantId).catch(() => undefined);
      throw dbError;
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
    console.error(
      "[register-company]",
      (error as { name?: string })?.name,
      (error as { message?: string })?.message,
    );
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
