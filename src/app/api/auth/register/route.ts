import { NextResponse } from "next/server";
import { cognitoSignUp, getCognitoErrorMessage } from "@/lib/cognito";
import { createEmployee } from "@/lib/db/employees";
import { getInvitationByToken, markInvitationUsed } from "@/lib/db/invitations";
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
    const { email, password, fullName, phoneNumber, nickname, inviteToken } = body as {
      email?: string;
      password?: string;
      fullName?: string;
      phoneNumber?: string;
      nickname?: string;
      inviteToken?: string;
    };

    if (!email || !password || !fullName || !phoneNumber || !nickname) {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    // Determine tenant from invite token or default
    let tenantId = "TENANT#novasys";
    let role: "EMPLOYEE" | "ADMIN" = "EMPLOYEE";
    let area = "General";
    let position = "Empleado";
    let invitation = null;

    if (inviteToken) {
      invitation = await getInvitationByToken(inviteToken);

      if (!invitation) {
        return NextResponse.json(
          { error: "Invitacion no encontrada o invalida" },
          { status: 400 }
        );
      }

      if (invitation.Status !== "PENDING") {
        return NextResponse.json(
          { error: "Esta invitacion ya fue utilizada o revocada" },
          { status: 410 }
        );
      }

      if (new Date(invitation.ExpiresAt) < new Date()) {
        return NextResponse.json(
          { error: "Esta invitacion ha expirado" },
          { status: 410 }
        );
      }

      // Validate email matches invitation
      if (invitation.Email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: "El correo no coincide con la invitacion" },
          { status: 400 }
        );
      }

      tenantId = invitation.TenantID;
      role = invitation.Role || "EMPLOYEE";
      area = invitation.Area || "General";
      position = invitation.Position || "Empleado";
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
      TenantID: tenantId,
      EmployeeID: `EMP#${email.toLowerCase()}`,
      Email: email.toLowerCase(),
      DNI: `PENDING-${Date.now()}`,
      FullName: fullName.trim(),
      FirstName: firstName,
      LastName: lastName,
      Phone: phoneNumber,
      Area: area,
      Position: position,
      WorkMode: "ONSITE",
      EmploymentStatus: "ACTIVE",
      Role: role,
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
    }

    // 3) Mark invitation as used
    if (invitation) {
      try {
        await markInvitationUsed(invitation.InviteID);
      } catch (err) {
        console.error("[register] Error marking invitation as used:", err);
      }
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
