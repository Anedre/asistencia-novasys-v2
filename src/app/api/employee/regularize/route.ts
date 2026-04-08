import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { getTenantById } from "@/lib/db/tenants";
import { regularizeSingle } from "@/lib/services/regularization.service";
import { createRequest } from "@/lib/services/approval.service";
import { withErrorHandler } from "@/lib/utils/errors";
import { z } from "zod";
import { ValidationError } from "@/lib/utils/errors";

const selfRegularizeSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha invalido"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  breakMinutes: z.number().min(0).max(480).default(60),
  reasonCode: z.string().min(1, "Falta motivo"),
  reasonNote: z.string().max(500).optional(),
});

/** POST /api/employee/regularize — self-service regularization */
export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json();

  const parsed = selfRegularizeSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((i) => i.message).join(", ")
    );
  }

  const { workDate, startTime, endTime, breakMinutes, reasonCode, reasonNote } =
    parsed.data;

  // Validate end > start
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (eh * 60 + em <= sh * 60 + sm) {
    throw new ValidationError("La hora de salida debe ser posterior a la de entrada");
  }

  // Check tenant settings for approval requirement
  const tenantId = user.tenantId || "TENANT#novasys";
  const tenant = await getTenantById(tenantId);
  const approvalRequired = tenant?.settings?.approvalRequired ?? false;

  if (approvalRequired) {
    // Create an approval request instead of applying directly
    const request = await createRequest(
      user.employeeId,
      user.name,
      {
        requestType: "REGULARIZATION_SINGLE",
        effectiveDate: workDate,
        startTime,
        endTime,
        breakMinutes,
        reasonCode,
        reasonNote,
      },
      tenantId
    );

    return NextResponse.json({
      ok: true,
      mode: "PENDING_APPROVAL",
      message: "Solicitud de regularizacion creada. Pendiente de aprobacion.",
      requestId: request.RequestID,
    });
  }

  // Apply immediately (no approval needed)
  const result = await regularizeSingle(
    {
      employeeId: user.employeeId,
      workDate,
      startTime,
      endTime,
      breakMinutes,
      reasonCode,
      reasonNote,
      overwrite: true,
      tenantId,
    },
    user
  );

  return NextResponse.json({
    ok: true,
    mode: "APPLIED",
    message: "Regularizacion aplicada exitosamente.",
    result,
  });
});
