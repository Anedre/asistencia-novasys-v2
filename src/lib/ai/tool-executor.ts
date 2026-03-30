/**
 * Executes AI tool calls against real services.
 * Returns both a text result for the AI and a UIBlock for the frontend.
 */

import { createRequest, getMyRequests } from "@/lib/services/approval.service";
import { getTodayStatus, getWeekSummary, recordEvent } from "@/lib/services/attendance.service";
import { REASON_LABELS } from "@/lib/constants/reason-codes";
import type { ToolName } from "./tools";
import type { UIBlock } from "@/lib/types/chat";

interface ToolContext {
  employeeId: string;
  employeeName: string;
  tenantId?: string;
}

export interface ToolExecResult {
  textForAI: string;
  block: UIBlock;
}

export async function executeTool(
  toolName: ToolName,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
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
        return {
          textForAI: JSON.stringify({ error: `Tool desconocido: ${toolName}` }),
          block: { type: "error", message: `Herramienta desconocida: ${toolName}` },
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return {
      textForAI: JSON.stringify({ error: message }),
      block: { type: "error", message },
    };
  }
}

async function handleCreateRegularization(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
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

  const data = {
    success: true,
    requestId: request.RequestID,
    status: "PENDING",
  };

  return {
    textForAI: JSON.stringify({ ...data, message: "Solicitud de regularización creada exitosamente." }),
    block: {
      type: "request_created",
      requestId: request.RequestID,
      requestType: input.requestType as string,
      status: "PENDING",
      date: input.effectiveDate as string | undefined,
      dateFrom: input.dateFrom as string | undefined,
      dateTo: input.dateTo as string | undefined,
      reasonCode: input.reasonCode as string,
    },
  };
}

async function handleCreatePermission(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  const request = await createRequest(ctx.employeeId, ctx.employeeName, {
    requestType: input.requestType as "PERMISSION" | "VACATION",
    dateFrom: input.dateFrom as string,
    dateTo: input.dateTo as string,
    reasonCode: input.reasonCode as string,
    reasonNote: input.reasonNote as string | undefined,
  }, ctx.tenantId);

  return {
    textForAI: JSON.stringify({ success: true, requestId: request.RequestID, status: "PENDING" }),
    block: {
      type: "request_created",
      requestId: request.RequestID,
      requestType: input.requestType as string,
      status: "PENDING",
      dateFrom: input.dateFrom as string,
      dateTo: input.dateTo as string,
      reasonCode: input.reasonCode as string,
    },
  };
}

async function handleCheckToday(ctx: ToolContext): Promise<ToolExecResult> {
  const status = await getTodayStatus(ctx.employeeId);
  const data = {
    date: status.date,
    status: status.status,
    firstIn: status.firstInLocal || "Sin registro",
    lastOut: status.lastOutLocal || "Sin registro",
    breakMinutes: status.breakMinutes,
    workedHHMM: status.workedHHMM,
    plannedMinutes: status.plannedMinutes,
    deltaHHMM: status.deltaHHMM,
    hasOpenShift: status.hasOpenShift,
  };

  return {
    textForAI: JSON.stringify(data),
    block: {
      type: "attendance_today",
      ...data,
    },
  };
}

async function handleCheckWeek(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  const offset = (input.weekOffset as number) ?? 0;
  const summary = await getWeekSummary(ctx.employeeId, offset);
  const days = summary.days.map((d) => ({
    date: d.date,
    weekday: d.weekday,
    status: d.status,
    firstIn: d.firstInLocal || "—",
    lastOut: d.lastOutLocal || "—",
    workedHHMM: d.workedHHMM,
    deltaHHMM: d.deltaHHMM,
  }));

  const data = {
    week: summary.week,
    fromDate: summary.fromDate,
    toDate: summary.toDate,
    totalWorkedHHMM: summary.totalWorkedHHMM,
    totalPlannedMinutes: summary.totalPlannedMinutes,
    totalDeltaHHMM: summary.totalDeltaHHMM,
    days,
  };

  return {
    textForAI: JSON.stringify(data),
    block: { type: "week_summary", ...data },
  };
}

async function handleCheckRequests(ctx: ToolContext): Promise<ToolExecResult> {
  const requests = await getMyRequests(ctx.employeeId);
  const recent = requests.slice(0, 10);
  const mapped = recent.map((r) => ({
    id: r.RequestID,
    type: r.requestType,
    status: r.status,
    date: r.effectiveDate || `${r.dateFrom} a ${r.dateTo}`,
    reasonCode: r.reasonCode,
    createdAt: r.createdAt,
    reviewedBy: r.reviewedByName || null,
  }));

  return {
    textForAI: JSON.stringify({ total: requests.length, requests: mapped }),
    block: { type: "request_list", total: requests.length, requests: mapped },
  };
}

async function handleRecordAttendance(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  const eventType = input.eventType as "START" | "BREAK_START" | "BREAK_END" | "END";
  const result = await recordEvent({
    employeeId: ctx.employeeId,
    eventType,
    ip: "127.0.0.1",
    userAgent: "AI-Assistant",
    tenantId: ctx.tenantId,
  });

  return {
    textForAI: JSON.stringify({ success: true, eventType, time: result.serverClockLocal }),
    block: {
      type: "attendance_recorded",
      eventType,
      time: result.serverClockLocal,
    },
  };
}
