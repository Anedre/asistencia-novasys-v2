/**
 * Executes AI tool calls against real services.
 * Returns both a text result for the AI and a UIBlock for the frontend.
 */

import {
  createRequest,
  getMyRequests,
  getPendingRequests,
} from "@/lib/services/approval.service";
import { getTodayStatus, getWeekSummary, recordEvent } from "@/lib/services/attendance.service";
import { getReportsStats } from "@/lib/services/reports-stats.service";
import { getHolidaySet } from "@/lib/utils/holidays";
import { listAuditByTenant } from "@/lib/db/audit";
import { revertAudit, RevertBlockedError } from "@/lib/services/audit.service";
import { createInvitation } from "@/lib/db/invitations";
import { getTenantById, updateTenantSettings } from "@/lib/db/tenants";
import { sendInvitationEmail } from "@/lib/email/send-invitation";
import { withAudit } from "@/lib/services/audit.service";
import { REASON_LABELS } from "@/lib/constants/reason-codes";
import type { ToolName } from "./tools";
import type { UIBlock } from "@/lib/types/chat";
import type { SessionUser } from "@/lib/auth-helpers";
import type { Invitation } from "@/lib/types/invitation";

interface ToolContext {
  employeeId: string;
  employeeName: string;
  tenantId?: string;
  role?: "ADMIN" | "SUPER_ADMIN" | "EMPLOYEE";
}

export interface ToolExecResult {
  textForAI: string;
  block: UIBlock;
}

function requireAdmin(ctx: ToolContext): ToolExecResult | null {
  if (ctx.role !== "ADMIN" && ctx.role !== "SUPER_ADMIN") {
    return {
      textForAI: JSON.stringify({
        error:
          "Esta acción requiere rol de administrador. Tu rol actual no puede usar esta herramienta.",
      }),
      block: {
        type: "error",
        message:
          "Esta herramienta es solo para administradores.",
      },
    };
  }
  return null;
}

/** Build a SessionUser stub from a ToolContext for services that expect one. */
function ctxToSessionUser(ctx: ToolContext): SessionUser {
  return {
    id: ctx.employeeId,
    email: "",
    name: ctx.employeeName,
    role: (ctx.role ?? "EMPLOYEE") as SessionUser["role"],
    employeeId: ctx.employeeId,
    area: "",
    tenantId: ctx.tenantId ?? "TENANT#novasys",
    tenantSlug: "",
  };
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
      case "list_holidays":
        return await handleListHolidays(ctx);
      case "list_team_stats":
        return await handleListTeamStats(input, ctx);
      case "list_recent_audit":
        return (
          requireAdmin(ctx) ?? (await handleListRecentAudit(input, ctx))
        );
      case "check_pending_requests":
        return (
          requireAdmin(ctx) ?? (await handleCheckPending(ctx))
        );
      case "create_invitation":
        return (
          requireAdmin(ctx) ?? (await handleCreateInvitation(input, ctx))
        );
      case "update_tenant_setting":
        return (
          requireAdmin(ctx) ?? (await handleUpdateSetting(input, ctx))
        );
      case "revert_audit_entry":
        return (
          requireAdmin(ctx) ?? (await handleRevertAudit(input, ctx))
        );
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
      employeeName: ctx.employeeName,
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
      employeeName: ctx.employeeName,
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
    reviewedAt: r.reviewedAt || null,
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

/* ─────────────────── read-only handlers ─────────────────── */

const MONTH_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function daysBetween(a: string, b: string): number {
  const aD = new Date(a + "T00:00:00").getTime();
  const bD = new Date(b + "T00:00:00").getTime();
  return Math.round((bD - aD) / (24 * 60 * 60 * 1000));
}

async function handleListHolidays(ctx: ToolContext): Promise<ToolExecResult> {
  const tenantId = ctx.tenantId ?? "TENANT#novasys";
  const set = await getHolidaySet(tenantId);
  const today = new Date().toISOString().slice(0, 10);
  const entries = Array.from(set.entries())
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((h) => h.date >= today)
    .slice(0, 10);

  const items = entries.map((h) => {
    const [, monthStr, dayStr] = h.date.split("-");
    const monthIdx = Number(monthStr) - 1;
    return {
      date: h.date,
      name: h.name,
      daysUntil: Math.max(0, daysBetween(today, h.date)),
      monthShort: MONTH_SHORT[monthIdx] ?? monthStr,
      day: dayStr,
    };
  });

  return {
    textForAI: JSON.stringify({
      tenantId,
      totalConfigured: set.size,
      upcoming: items,
    }),
    block: {
      type: "holidays",
      totalConfigured: set.size,
      holidays: items,
    },
  };
}

async function handleListTeamStats(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  const tenantId = ctx.tenantId ?? "TENANT#novasys";
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const toYmd = (d: Date) => d.toISOString().slice(0, 10);

  const from = (input.from as string) || toYmd(defaultFrom);
  const to = (input.to as string) || toYmd(today);

  const stats = await getReportsStats(tenantId, from, to);
  const top5 = stats.employeeRanking.slice(0, 5).map((e) => ({
    name: e.employeeName,
    hours: e.workedHours,
    absences: e.absences,
  }));
  const distribution = Object.entries(stats.statusDistribution)
    .map(([status, count]) => ({ status, count: Number(count) }))
    .sort((a, b) => b.count - a.count);

  return {
    textForAI: JSON.stringify({
      range: { from, to },
      totals: stats.totals,
      topEmployees: top5,
      statusDistribution: distribution,
    }),
    block: {
      type: "team_stats",
      from,
      to,
      totals: {
        totalEmployees: stats.totals.totalEmployees,
        totalWorkedHours: stats.totals.totalWorkedHours,
        totalPlannedHours: stats.totals.totalPlannedHours,
        totalAbsences: stats.totals.totalAbsences,
        totalRegularizations: stats.totals.totalRegularizations,
        totalDays: stats.totals.totalDays,
      },
      topEmployees: top5,
      statusDistribution: distribution,
    },
  };
}

/* ─────────────────── admin-only handlers ─────────────────── */

async function handleListRecentAudit(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  const tenantId = ctx.tenantId ?? "TENANT#novasys";
  const limit = Math.min(
    Math.max(Number(input.limit ?? 10) || 10, 1),
    50
  );
  const result = await listAuditByTenant({ tenantId, limit, hideReverted: false });
  const items = result.items.map((e) => ({
    auditId: e.AuditID,
    action: e.action,
    entityType: e.entityType,
    entityLabel: e.entityLabel,
    actor: e.actorName,
    createdAt: e.createdAt,
    reverted: !!e.revertedAt,
  }));

  return {
    textForAI: JSON.stringify({ count: items.length, items }),
    block: {
      type: "audit_list",
      total: items.length,
      items,
    },
  };
}

async function handleCheckPending(
  ctx: ToolContext
): Promise<ToolExecResult> {
  const tenantId = ctx.tenantId ?? "TENANT#novasys";
  const pending = await getPendingRequests(tenantId);
  const sample = pending.slice(0, 5).map((r) => ({
    id: r.RequestID,
    employee: r.employeeName,
    type: r.requestType,
    from: r.dateFrom ?? r.effectiveDate ?? null,
    to: r.dateTo ?? null,
    reason: r.reasonCode,
    createdAt: r.createdAt,
  }));

  // Aggregate counts by request type.
  const typeCounts = new Map<string, number>();
  for (const r of pending) {
    typeCounts.set(r.requestType, (typeCounts.get(r.requestType) ?? 0) + 1);
  }
  const byType = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return {
    textForAI: JSON.stringify({ total: pending.length, byType, sample }),
    block: {
      type: "pending_requests",
      total: pending.length,
      byType,
      sample,
    },
  };
}

async function handleCreateInvitation(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  const email = String(input.email || "").toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return {
      textForAI: JSON.stringify({ error: "Email inválido" }),
      block: { type: "error", message: "Email inválido" },
    };
  }
  const confirm = input.confirm === true;
  const fullName = (input.fullName as string) || undefined;
  const area = (input.area as string) || undefined;
  const position = (input.position as string) || undefined;
  const role = ((input.role as string) || "EMPLOYEE") as "EMPLOYEE" | "ADMIN";

  // Preview mode — no execution.
  if (!confirm) {
    return {
      textForAI: JSON.stringify({
        preview: true,
        action: "create_invitation",
        email,
        fullName,
        area,
        position,
        role,
        note:
          "Confirmación requerida. Llama de nuevo con confirm=true para crear la invitación y enviar el email.",
      }),
      block: {
        type: "invitation_preview",
        email,
        fullName,
        area,
        position,
        role,
      },
    };
  }

  const tenantId = ctx.tenantId ?? "TENANT#novasys";
  const tenant = await getTenantById(tenantId).catch(() => null);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const token = crypto.randomUUID();
  const invitation: Invitation = {
    InviteID: `INV#${crypto.randomUUID()}`,
    TenantID: tenantId,
    Email: email,
    FullName: fullName,
    InvitedBy: ctx.employeeId,
    InvitedByName: ctx.employeeName,
    Role: role,
    Area: area,
    Position: position,
    Status: "PENDING",
    Token: token,
    CreatedAt: now.toISOString(),
    ExpiresAt: expiresAt.toISOString(),
  };

  await withAudit(
    {
      actor: ctxToSessionUser(ctx),
      entityType: "INVITATION",
      entityKey: { InviteID: invitation.InviteID },
      action: "CREATE",
      reason: `Invitación creada vía asistente IA a ${email}`,
      skipBeforeRead: true,
    },
    async () => createInvitation(invitation)
  );

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const inviteLink = `${baseUrl}/register?invite=${token}`;
  const emailResult = await sendInvitationEmail({
    invitation,
    tenant,
    inviteLink,
  });

  return {
    textForAI: JSON.stringify({
      ok: true,
      email,
      inviteLink,
      emailSent: emailResult.ok,
    }),
    block: {
      type: "invitation_created",
      email,
      inviteLink,
      emailSent: emailResult.ok,
    },
  };
}

async function handleUpdateSetting(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  const key = String(input.key || "");
  const allowed = new Set(["approvalRequired", "timezone", "defaultScheduleType"]);
  if (!allowed.has(key)) {
    return {
      textForAI: JSON.stringify({ error: `Setting no permitido: ${key}` }),
      block: { type: "error", message: `Setting no permitido: ${key}` },
    };
  }
  const value = input.value;
  const confirm = input.confirm === true;

  if (!confirm) {
    return {
      textForAI: JSON.stringify({
        preview: true,
        key,
        newValue: value,
        note: "Confirmación requerida. Llama de nuevo con confirm=true para aplicar.",
      }),
      block: {
        type: "setting_preview",
        key,
        newValue: value,
      },
    };
  }

  const tenantId = ctx.tenantId ?? "TENANT#novasys";
  const partial: Record<string, unknown> = { [key]: value };

  await withAudit(
    {
      actor: ctxToSessionUser(ctx),
      entityType: "TENANT_SETTINGS",
      entityKey: { TenantID: tenantId },
      action: "UPDATE",
      reason: `Ajuste vía asistente IA: ${key}`,
    },
    async () => updateTenantSettings(tenantId, partial)
  );

  return {
    textForAI: JSON.stringify({ ok: true, key, value }),
    block: {
      type: "setting_updated",
      key,
      newValue: value,
    },
  };
}

async function handleRevertAudit(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecResult> {
  const auditId = String(input.auditId || "");
  if (!auditId) {
    return {
      textForAI: JSON.stringify({ error: "Falta auditId" }),
      block: { type: "error", message: "Falta el ID del audit a revertir." },
    };
  }
  const confirm = input.confirm === true;
  if (!confirm) {
    return {
      textForAI: JSON.stringify({
        preview: true,
        auditId,
        note: "Confirmación requerida. Llama con confirm=true para revertir.",
      }),
      block: {
        type: "revert_preview",
        auditId,
      },
    };
  }

  try {
    const result = await revertAudit(auditId, ctxToSessionUser(ctx));
    return {
      textForAI: JSON.stringify({
        ok: true,
        auditId,
        revertAuditId: result.revertAuditId,
      }),
      block: {
        type: "revert_done",
        auditId,
        revertAuditId: result.revertAuditId,
      },
    };
  } catch (err) {
    if (err instanceof RevertBlockedError) {
      return {
        textForAI: JSON.stringify({
          error: "REVERT_BLOCKED",
          message: err.message,
          conflict: err.conflict,
        }),
        block: {
          type: "error",
          message: err.message,
        },
      };
    }
    throw err;
  }
}
