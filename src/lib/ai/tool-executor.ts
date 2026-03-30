/**
 * Executes AI tool calls against real services.
 */

import { createRequest, getMyRequests } from "@/lib/services/approval.service";
import { getTodayStatus, getWeekSummary, recordEvent } from "@/lib/services/attendance.service";
import type { ToolName } from "./tools";

interface ToolContext {
  employeeId: string;
  employeeName: string;
  tenantId?: string;
}

export async function executeTool(
  toolName: ToolName,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  try {
    switch (toolName) {
      case "create_regularization_request":
        return await handleCreateRegularization(input, ctx);
      case "create_permission_request":
        return await handleCreatePermission(input, ctx);
      case "check_attendance_today":
        return await handleCheckToday(ctx);
      case "check_attendance_week":
        return await handleCheckWeek(input, ctx);
      case "check_my_requests":
        return await handleCheckRequests(ctx);
      case "record_attendance":
        return await handleRecordAttendance(input, ctx);
      default:
        return JSON.stringify({ error: `Tool desconocido: ${toolName}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return JSON.stringify({ error: message });
  }
}

async function handleCreateRegularization(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const request = await createRequest(ctx.employeeId, ctx.employeeName, {
    requestType: input.requestType as "REGULARIZATION_SINGLE" | "REGULARIZATION_RANGE",
    effectiveDate: input.effectiveDate as string | undefined,
    dateFrom: input.dateFrom as string | undefined,
    dateTo: input.dateTo as string | undefined,
    startTime: input.startTime as string | undefined,
    endTime: input.endTime as string | undefined,
    breakMinutes: (input.breakMinutes as number) ?? 60,
    reasonCode: input.reasonCode as string,
    reasonNote: input.reasonNote as string | undefined,
  }, ctx.tenantId);

  return JSON.stringify({
    success: true,
    requestId: request.RequestID,
    status: "PENDING",
    message: `Solicitud de regularización creada exitosamente. Estado: PENDIENTE. Un administrador la revisará pronto.`,
  });
}

async function handleCreatePermission(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const request = await createRequest(ctx.employeeId, ctx.employeeName, {
    requestType: input.requestType as "PERMISSION" | "VACATION",
    dateFrom: input.dateFrom as string,
    dateTo: input.dateTo as string,
    reasonCode: input.reasonCode as string,
    reasonNote: input.reasonNote as string | undefined,
  }, ctx.tenantId);

  return JSON.stringify({
    success: true,
    requestId: request.RequestID,
    status: "PENDING",
    message: `Solicitud de ${input.requestType === "VACATION" ? "vacaciones" : "permiso"} creada exitosamente. Estado: PENDIENTE.`,
  });
}

async function handleCheckToday(ctx: ToolContext): Promise<string> {
  const status = await getTodayStatus(ctx.employeeId);
  return JSON.stringify({
    date: status.date,
    status: status.status,
    firstIn: status.firstInLocal || "Sin registro",
    lastOut: status.lastOutLocal || "Sin registro",
    breakMinutes: status.breakMinutes,
    workedMinutes: status.workedMinutes,
    workedHHMM: status.workedHHMM,
    plannedMinutes: status.plannedMinutes,
    deltaMinutes: status.deltaMinutes,
    deltaHHMM: status.deltaHHMM,
    hasOpenShift: status.hasOpenShift,
    anomalies: status.anomalies,
  });
}

async function handleCheckWeek(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const offset = (input.weekOffset as number) ?? 0;
  const summary = await getWeekSummary(ctx.employeeId, offset);
  return JSON.stringify({
    week: summary.week,
    fromDate: summary.fromDate,
    toDate: summary.toDate,
    totalWorkedHHMM: summary.totalWorkedHHMM,
    totalPlannedMinutes: summary.totalPlannedMinutes,
    totalDeltaHHMM: summary.totalDeltaHHMM,
    days: summary.days.map((d) => ({
      date: d.date,
      weekday: d.weekday,
      status: d.status,
      firstIn: d.firstInLocal || "—",
      lastOut: d.lastOutLocal || "—",
      workedHHMM: d.workedHHMM,
      deltaHHMM: d.deltaHHMM,
    })),
  });
}

async function handleCheckRequests(ctx: ToolContext): Promise<string> {
  const requests = await getMyRequests(ctx.employeeId);
  const recent = requests.slice(0, 10);
  return JSON.stringify({
    total: requests.length,
    requests: recent.map((r) => ({
      id: r.RequestID,
      type: r.requestType,
      status: r.status,
      date: r.effectiveDate || `${r.dateFrom} a ${r.dateTo}`,
      reasonCode: r.reasonCode,
      createdAt: r.createdAt,
      reviewedBy: r.reviewedByName || null,
    })),
  });
}

async function handleRecordAttendance(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  const eventType = input.eventType as "START" | "BREAK_START" | "BREAK_END" | "END";
  const result = await recordEvent({
    employeeId: ctx.employeeId,
    eventType,
    ip: "127.0.0.1",
    userAgent: "AI-Assistant",
    tenantId: ctx.tenantId,
  });

  const labels: Record<string, string> = {
    START: "entrada",
    BREAK_START: "inicio de break",
    BREAK_END: "fin de break",
    END: "salida",
  };

  return JSON.stringify({
    success: true,
    eventType,
    message: `Se registró tu ${labels[eventType]} exitosamente a las ${result.serverClockLocal}.`,
    time: result.serverClockLocal,
  });
}
