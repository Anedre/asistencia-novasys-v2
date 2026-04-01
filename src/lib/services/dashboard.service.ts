/**
 * Admin dashboard metrics aggregation service.
 */

import { getAllActiveEmployees } from "@/lib/db/employees";
import { getDailySummariesByDate } from "@/lib/db/daily-summary";
import { getRequestsByStatus } from "@/lib/db/requests";
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
}

export async function getDashboardMetrics(tenantId?: string): Promise<DashboardMetrics> {
  const todayDate = workDateLima();

  const [employees, summaries, pendingRequests, holMap] = await Promise.all([
    getAllActiveEmployees(tenantId),
    getDailySummariesByDate(todayDate, tenantId),
    getRequestsByStatus("PENDING", 200, tenantId),
    tenantId ? getHolidaySet(tenantId) : Promise.resolve(new Map<string, string>()),
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
      });
    }
  }

  const missingCount = employees.length - checkedIn.size;
  statusBreakdown.missing += missingCount;

  // Sort: working first, then on break, then completed, then not checked in
  const statusOrder: Record<string, number> = { WORKING: 0, ON_BREAK: 1, COMPLETED: 2, NOT_CHECKED_IN: 3 };
  presence.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

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
  };
}
