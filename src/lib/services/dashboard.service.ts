/**
 * Admin dashboard metrics aggregation service.
 */

import { getAllActiveEmployees } from "@/lib/db/employees";
import { getDailySummariesByDate } from "@/lib/db/daily-summary";
import { getRequestsByStatus } from "@/lib/db/requests";
import { workDateLima } from "@/lib/utils/time";

export interface DashboardMetrics {
  totalActiveEmployees: number;
  presentToday: number;
  absentToday: number;
  onBreakNow: number;
  pendingRequests: number;
  anomaliesToday: number;
  todayDate: string;
  statusBreakdown: {
    ok: number;
    open: number;
    short: number;
    missing: number;
    absence: number;
    regularized: number;
  };
}

export async function getDashboardMetrics(tenantId?: string): Promise<DashboardMetrics> {
  const todayDate = workDateLima();

  const [employees, summaries, pendingRequests] = await Promise.all([
    getAllActiveEmployees(tenantId),
    getDailySummariesByDate(todayDate, tenantId),
    getRequestsByStatus("PENDING", 200, tenantId),
  ]);

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

  const employeeIds = new Set(employees.map((e) => e.EmployeeID));
  const checkedIn = new Set<string>();

  for (const s of summaries) {
    checkedIn.add(s.EmployeeID);

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

    if (s.breakStartUtc) onBreak++;
    if (s.anomalies && s.anomalies.length > 0) anomalies++;
  }

  // People who didn't check in at all
  const missingCount = employees.length - checkedIn.size;
  statusBreakdown.missing += missingCount;

  return {
    totalActiveEmployees: employees.length,
    presentToday: checkedIn.size,
    absentToday: missingCount,
    onBreakNow: onBreak,
    pendingRequests: pendingRequests.length,
    anomaliesToday: anomalies,
    todayDate,
    statusBreakdown,
  };
}
