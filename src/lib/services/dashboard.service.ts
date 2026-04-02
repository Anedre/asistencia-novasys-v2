/**
 * Admin dashboard metrics aggregation service.
 */

import { getAllActiveEmployees } from "@/lib/db/employees";
import { getDailySummariesByDate } from "@/lib/db/daily-summary";
import { getEventsByDate } from "@/lib/db/attendance";
import { getRequestsByStatus } from "@/lib/db/requests";
import { getPostsByTenant } from "@/lib/db/posts";
import { getEventsByTenant } from "@/lib/db/events";
import { workDateLima, clockLima } from "@/lib/utils/time";
import { getHolidaySet } from "@/lib/utils/holidays";

export interface EmployeePresence {
  employeeId: string;
  fullName: string;
  area: string;
  position: string;
  avatarUrl?: string;
  status: string; // "WORKING" | "ON_BREAK" | "COMPLETED" | "NOT_CHECKED_IN"
  firstInLocal: string | null;
  lastOutLocal: string | null;
  workedMinutes: number;
  anomalies: string[];
}

export interface DashboardMetrics {
  totalActiveEmployees: number;
  presentToday: number;
  absentToday: number;
  onBreakNow: number;
  pendingRequests: number;
  anomaliesToday: number;
  todayDate: string;
  isHoliday: boolean;
  holidayName?: string;
  statusBreakdown: {
    ok: number;
    open: number;
    short: number;
    missing: number;
    absence: number;
    regularized: number;
  };
  /** Real-time employee presence list */
  presence: EmployeePresence[];
  /** Recent activity from all sources */
  recentActivity: Array<{
    id: string;
    type: "attendance" | "post" | "request" | "event";
    employeeName: string;
    action: string;
    detail?: string;
    time: string;
  }>;
}

export async function getDashboardMetrics(tenantId?: string): Promise<DashboardMetrics> {
  const todayDate = workDateLima();

  const [employees, summaries, pendingRequests, holMap, todayEvents, recentPosts, recentRequests, calendarEvents] = await Promise.all([
    getAllActiveEmployees(tenantId),
    getDailySummariesByDate(todayDate, tenantId),
    getRequestsByStatus("PENDING", 200, tenantId),
    tenantId ? getHolidaySet(tenantId) : Promise.resolve(new Map<string, string>()),
    getEventsByDate(todayDate),
    tenantId ? getPostsByTenant(tenantId, 15) : Promise.resolve([]),
    tenantId ? getRequestsByStatus("APPROVED", 20, tenantId) : Promise.resolve([]),
    tenantId ? getEventsByTenant(tenantId, 10) : Promise.resolve([]),
  ]);

  const isHol = holMap.has(todayDate);
  const holName = holMap.get(todayDate);

  const statusBreakdown = {
    ok: 0,
    open: 0,
    short: 0,
    missing: 0,
    absence: 0,
    regularized: 0,
  };

  let onBreak = 0;
  let anomalies = 0;

  // Build employee lookup
  const empMap = new Map<string, (typeof employees)[0]>();
  for (const e of employees) empMap.set(e.EmployeeID, e);

  const checkedIn = new Set<string>();
  const presence: EmployeePresence[] = [];

  for (const s of summaries) {
    checkedIn.add(s.EmployeeID);
    const emp = empMap.get(s.EmployeeID);

    // Determine real-time status
    let presenceStatus = "NOT_CHECKED_IN";
    const hasIn = !!s.firstInUtc;
    const hasOut = !!s.lastOutUtc;
    const hasBreakStart = !!s.breakStartUtc;

    if (hasIn && !hasOut) {
      presenceStatus = hasBreakStart ? "ON_BREAK" : "WORKING";
    } else if (hasIn && hasOut) {
      presenceStatus = "COMPLETED";
    }

    presence.push({
      employeeId: s.EmployeeID,
      fullName: emp?.FullName ?? s.EmployeeID,
      area: emp?.Area ?? "",
      position: emp?.Position ?? "",
      avatarUrl: emp?.AvatarUrl,
      status: presenceStatus,
      firstInLocal: s.firstInLocal ?? null,
      lastOutLocal: s.lastOutLocal ?? null,
      workedMinutes: Number(s.workedMinutes ?? 0),
      anomalies: s.anomalies ?? [],
    });

    switch (s.status) {
      case "OK":
        statusBreakdown.ok++;
        break;
      case "OPEN":
        statusBreakdown.open++;
        break;
      case "SHORT":
        statusBreakdown.short++;
        break;
      case "ABSENCE":
        statusBreakdown.absence++;
        break;
      case "REGULARIZED":
        statusBreakdown.regularized++;
        break;
      default:
        statusBreakdown.missing++;
    }

    if (hasBreakStart && !hasOut) onBreak++;
    if (s.anomalies && s.anomalies.length > 0) anomalies++;
  }

  // Add employees who didn't check in
  for (const emp of employees) {
    if (!checkedIn.has(emp.EmployeeID)) {
      presence.push({
        employeeId: emp.EmployeeID,
        fullName: emp.FullName,
        area: emp.Area ?? "",
        position: emp.Position ?? "",
        avatarUrl: emp.AvatarUrl,
        status: "NOT_CHECKED_IN",
        firstInLocal: null,
        lastOutLocal: null,
        workedMinutes: 0,
        anomalies: [],
      });
    }
  }

  const missingCount = employees.length - checkedIn.size;
  statusBreakdown.missing += missingCount;

  // Sort: working first, then on break, then completed, then not checked in
  const statusOrder: Record<string, number> = { WORKING: 0, ON_BREAK: 1, COMPLETED: 2, NOT_CHECKED_IN: 3 };
  presence.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  // Build unified activity feed from multiple sources
  type ActivityItem = {
    id: string;
    type: "attendance" | "post" | "request" | "event";
    employeeName: string;
    action: string;
    detail?: string;
    time: string;
    sortTs: string; // ISO for sorting
  };

  const activityItems: ActivityItem[] = [];

  // 1) Attendance events
  const attendanceLabels: Record<string, string> = {
    START: "Marco entrada",
    BREAK_START: "Inicio break",
    BREAK_END: "Fin de break",
    END: "Marco salida",
  };
  for (const ev of todayEvents) {
    if (!empMap.has(ev.EmployeeID)) continue;
    const emp = empMap.get(ev.EmployeeID);
    const timeStr = ev.serverClockLocal ?? clockLima(new Date(ev.serverTimeUtc));
    activityItems.push({
      id: ev.EventTS,
      type: "attendance",
      employeeName: emp?.FullName ?? ev.EmployeeID,
      action: attendanceLabels[ev.eventType] ?? ev.eventType,
      time: timeStr.slice(0, 5),
      sortTs: ev.serverTimeUtc,
    });
  }

  // 2) Posts
  for (const post of recentPosts) {
    activityItems.push({
      id: post.PostID,
      type: "post",
      employeeName: post.AuthorName,
      action: "Publico un post",
      detail: post.Content.slice(0, 60) + (post.Content.length > 60 ? "..." : ""),
      time: post.CreatedAt ? new Date(post.CreatedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "",
      sortTs: post.CreatedAt ?? "",
    });
  }

  // 3) Approval requests (pending + approved)
  const requestLabels: Record<string, string> = {
    REGULARIZATION_SINGLE: "regularizacion",
    REGULARIZATION_RANGE: "regularizacion",
    PERMISSION: "permiso",
    VACATION: "vacaciones",
  };
  const allRequests = [...pendingRequests, ...recentRequests];
  for (const req of allRequests) {
    const typeLabel = requestLabels[req.requestType] ?? req.requestType;
    const statusAction = req.status === "PENDING"
      ? `Solicito ${typeLabel}`
      : req.status === "APPROVED"
        ? `Solicitud de ${typeLabel} aprobada`
        : `Solicitud de ${typeLabel} ${req.status.toLowerCase()}`;
    activityItems.push({
      id: req.RequestID,
      type: "request",
      employeeName: req.employeeName,
      action: statusAction,
      time: req.createdAt ? new Date(req.createdAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "",
      sortTs: req.updatedAt ?? req.createdAt ?? "",
    });
  }

  // 4) Calendar events
  for (const ev of calendarEvents) {
    activityItems.push({
      id: ev.EventID,
      type: "event",
      employeeName: ev.CreatorName ?? "Sistema",
      action: ev.Status === "CANCELLED" ? "Cancelo un evento" : "Creo un evento",
      detail: ev.Title,
      time: ev.CreatedAt ? new Date(ev.CreatedAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "",
      sortTs: ev.CreatedAt ?? "",
    });
  }

  // Sort by timestamp descending, take top 20
  activityItems.sort((a, b) => b.sortTs.localeCompare(a.sortTs));
  const recentActivity = activityItems.slice(0, 20).map(({ sortTs: _sortTs, ...item }) => item);

  return {
    totalActiveEmployees: employees.length,
    presentToday: checkedIn.size,
    absentToday: missingCount,
    onBreakNow: onBreak,
    pendingRequests: pendingRequests.length,
    anomaliesToday: anomalies,
    todayDate,
    isHoliday: isHol,
    holidayName: holName,
    statusBreakdown,
    presence,
    recentActivity,
  };
}
