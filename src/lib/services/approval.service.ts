/**
 * Approval workflow business logic.
 */

import {
  putRequest,
  getRequest,
  getRequestsByEmployee,
  getRequestsByStatus,
  updateRequestStatus,
  cancelRequest as dbCancelRequest,
} from "@/lib/db/requests";
import { putNotification } from "@/lib/db/notifications";
import { regularizeSingle, regularizeRange } from "./regularization.service";
import { ValidationError, NotFoundError, ConflictError } from "@/lib/utils/errors";
import type {
  ApprovalRequest,
  CreateRequestInput,
  RequestStatus,
  UserNotification,
} from "@/lib/types";

function generateRequestId(): string {
  const ts = Date.now();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `REQ#${ts}#${id}`;
}

function generateNotificationId(): string {
  return `NOTIF#${Date.now()}#${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

export async function createRequest(
  employeeId: string,
  employeeName: string,
  input: CreateRequestInput,
  tenantId?: string
): Promise<ApprovalRequest> {
  const now = new Date().toISOString();
  const request: ApprovalRequest = {
    RequestID: generateRequestId(),
    SK: "METADATA",
    employeeId,
    employeeName,
    requestType: input.requestType,
    status: "PENDING",
    effectiveDate: input.effectiveDate,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
    reasonCode: input.reasonCode,
    reasonNote: input.reasonNote,
    createdAt: now,
    updatedAt: now,
    ...(tenantId && { TenantID: tenantId }),
  };

  await putRequest(request);
  return request;
}

export async function getMyRequests(employeeId: string) {
  return getRequestsByEmployee(employeeId);
}

export async function getPendingRequests(tenantId?: string) {
  return getRequestsByStatus("PENDING", undefined, tenantId);
}

export async function getRequestDetail(requestId: string) {
  const request = await getRequest(requestId);
  if (!request) throw new NotFoundError("Solicitud no encontrada");
  return request;
}

export async function approveRequest(
  requestId: string,
  reviewerId: string,
  reviewerName: string,
  reviewerNote?: string,
  tenantId?: string
) {
  const request = await getRequest(requestId);
  if (!request) throw new NotFoundError("Solicitud no encontrada");
  if (request.status !== "PENDING") {
    throw new ConflictError("Solo se pueden aprobar solicitudes pendientes");
  }

  // Update status
  await updateRequestStatus(requestId, "APPROVED", reviewerId, reviewerName, reviewerNote);

  // Auto-apply regularization to DailySummary
  try {
    if (
      request.requestType === "REGULARIZATION_SINGLE" &&
      request.effectiveDate
    ) {
      await regularizeSingle({
        employeeId: request.employeeId,
        workDate: request.effectiveDate,
        startTime: request.startTime,
        endTime: request.endTime,
        breakMinutes: request.breakMinutes,
        reasonCode: request.reasonCode,
        reasonNote: request.reasonNote,
        overwrite: true,
      });
    } else if (
      request.requestType === "REGULARIZATION_RANGE" &&
      request.dateFrom &&
      request.dateTo
    ) {
      await regularizeRange({
        employeeId: request.employeeId,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        startTime: request.startTime,
        endTime: request.endTime,
        breakMinutes: request.breakMinutes,
        reasonCode: request.reasonCode,
        reasonNote: request.reasonNote,
        overwrite: true,
      });
    } else if (
      (request.requestType === "PERMISSION" || request.requestType === "VACATION") &&
      request.dateFrom &&
      request.dateTo
    ) {
      await regularizeRange({
        employeeId: request.employeeId,
        dateFrom: request.dateFrom,
        dateTo: request.dateTo,
        reasonCode: request.reasonCode,
        reasonNote: request.reasonNote,
        overwrite: true,
      });
    }
  } catch (err) {
    console.error("Error auto-applying regularization after approval:", err);
    // Don't fail the approval — the regularization can be retried manually
  }

  // Notify employee
  const notification: UserNotification = {
    recipientId: request.employeeId,
    createdAt: new Date().toISOString(),
    notificationId: generateNotificationId(),
    type: "REQUEST_APPROVED",
    title: "Solicitud aprobada",
    message: `Tu solicitud ha sido aprobada por ${reviewerName}${reviewerNote ? `. Nota: ${reviewerNote}` : ""}`,
    referenceId: requestId,
    referenceType: "REQUEST",
    read: false,
    ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
  };
  await putNotification(notification);

  return { ok: true, status: "APPROVED" };
}

export async function rejectRequest(
  requestId: string,
  reviewerId: string,
  reviewerName: string,
  reviewerNote?: string,
  tenantId?: string
) {
  const request = await getRequest(requestId);
  if (!request) throw new NotFoundError("Solicitud no encontrada");
  if (request.status !== "PENDING") {
    throw new ConflictError("Solo se pueden rechazar solicitudes pendientes");
  }

  await updateRequestStatus(requestId, "REJECTED", reviewerId, reviewerName, reviewerNote);

  // Notify employee
  const notification: UserNotification = {
    recipientId: request.employeeId,
    createdAt: new Date().toISOString(),
    notificationId: generateNotificationId(),
    type: "REQUEST_REJECTED",
    title: "Solicitud rechazada",
    message: `Tu solicitud fue rechazada por ${reviewerName}${reviewerNote ? `. Motivo: ${reviewerNote}` : ""}`,
    referenceId: requestId,
    referenceType: "REQUEST",
    read: false,
    ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  };
  await putNotification(notification);

  return { ok: true, status: "REJECTED" };
}

export async function cancelRequest(requestId: string, employeeId: string) {
  await dbCancelRequest(requestId, employeeId);
  return { ok: true, status: "CANCELLED" };
}
