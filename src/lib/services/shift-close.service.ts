/**
 * Closing shifts that were left open.
 *
 * A day stays `OPEN` when somebody clocks in and never clocks out. Nothing in
 * the request path ever closes it, so the row sits there forever: the hours
 * never land in a report and the employee shows as "en curso" months later.
 *
 * There are two scheduled jobs meant to prevent this
 * (`infrastructure/shift-autoclose-lambda`, which closes on reaching the goal
 * hours, and `infrastructure/shift-closer-lambda`, the nightly safety net).
 * Neither one repairs a backlog: both only ever look at *today*. This service
 * is the admin-driven path — it finds what is already stuck and closes it.
 *
 * The close time is chosen with the same rule the nightly Lambda documents, so
 * a day closed from the UI is indistinguishable from one closed by the cron:
 *
 *   1. the employee's last real event of that day, when it is later than their
 *      scheduled end — otherwise overtime would be silently thrown away;
 *   2. otherwise the scheduled end;
 *   3. never later than "now", so we cannot invent hours that have not
 *      happened yet.
 *
 * Every write goes through `withAudit` under one `groupId`, so a bulk close is
 * revertable in a single action from the audit page.
 */

import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { TABLES, INDEXES } from "@/lib/db/tables";
import { upsertDailySummary } from "@/lib/db/daily-summary";
import { getEventsByEmployeeAndDate } from "@/lib/db/attendance";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { getTenantDefaultSchedule, getTenantPlannedMinutes } from "@/lib/utils/holidays";
import { buildGroupId, withAudit } from "@/lib/services/audit.service";
import { buildLocalIso, clockLima, hhmmToMinutes, workDateLima } from "@/lib/utils/time";
import { ValidationError } from "@/lib/utils/errors";
import type { SessionUser } from "@/lib/auth-helpers";

/** How the close time was decided — shown to the admin and stored for audit. */
export type CloseSource = "LAST_EVENT" | "SCHEDULE_END" | "NOW";

/**
 * SOFT fills in the missing clock-out and keeps the hours.
 * STRICT refuses to guess: the day is demoted to MISSING with zero hours.
 * Mirrors `tenant.settings.workSchedule.autoCloseShifts`.
 */
export type ClosePolicy = "SOFT" | "STRICT";

export interface OpenShift {
  employeeId: string;
  employeeName: string;
  area: string;
  workDate: string; // "YYYY-MM-DD"
  firstInLocal: string | null;
  breakMinutes: number;
  plannedMinutes: number;
  /** Proposed clock-out, local "HH:MM". */
  closeAt: string;
  closeSource: CloseSource;
  /** Hours the close would record, in minutes. */
  workedMinutes: number;
  /** Calendar days the shift has been sitting open. */
  daysOpen: number;
}

interface RawRow {
  EmployeeID: string;
  WorkDate: string;
  TenantID?: string;
  status?: string;
  firstInLocal?: string;
  firstInUtc?: string;
  breakMinutes?: number;
  plannedMinutes?: number;
  autoClosedAt?: string;
  [k: string]: unknown;
}

const LIMA_OFFSET = "-05:00";

/** "2026-09-09T17:45:00-05:00" → "17:45". Tolerates a bare "HH:MM". */
function hhmmFromLocal(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = /T(\d{2}):(\d{2})/.exec(value);
  if (m) return `${m[1]}:${m[2]}`;
  const bare = /^(\d{2}):(\d{2})/.exec(value);
  return bare ? `${bare[1]}:${bare[2]}` : null;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Every OPEN row of the tenant in range, paginated. */
async function queryOpenRows(
  tenantId: string,
  from: string,
  to: string
): Promise<RawRow[]> {
  const items: RawRow[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.DAILY_SUMMARY,
        IndexName: INDEXES.DAILY_BY_TENANT,
        KeyConditionExpression:
          "TenantID = :tid AND WorkDate BETWEEN :from AND :to",
        FilterExpression: "#st = :open",
        ExpressionAttributeNames: { "#st": "status" },
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":from": `DATE#${from}`,
          ":to": `DATE#${to}`,
          ":open": "OPEN",
        },
        ExclusiveStartKey: lastKey,
      })
    );
    items.push(...((result.Items as RawRow[]) ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

/** Latest local "HH:MM" among that day's events, or null when there are none. */
async function lastEventHhmm(
  employeeId: string,
  workDate: string
): Promise<string | null> {
  try {
    const events = await getEventsByEmployeeAndDate(employeeId, workDate);
    let best: string | null = null;
    for (const ev of events) {
      const hhmm =
        hhmmFromLocal((ev as { tsLocal?: string }).tsLocal) ??
        hhmmFromLocal((ev as { EventTS?: string }).EventTS?.replace(/^TS#/, ""));
      if (hhmm && (!best || hhmm > best)) best = hhmm;
    }
    return best;
  } catch {
    // The events table is a nicety here — losing it must not block a close,
    // it only means we fall back to the scheduled end.
    return null;
  }
}

interface Proposal {
  closeAt: string;
  closeSource: CloseSource;
  workedMinutes: number;
}

function buildProposal(
  row: RawRow,
  scheduleEnd: string,
  lastEvent: string | null
): Proposal {
  const workDate = row.WorkDate.replace(/^DATE#/, "");
  const firstIn = hhmmFromLocal(row.firstInLocal);
  const breakMinutes = Number(row.breakMinutes ?? 0);

  let closeAt = scheduleEnd;
  let closeSource: CloseSource = "SCHEDULE_END";

  // A last event past the scheduled end means real overtime — keep it.
  if (lastEvent && hhmmToMinutes(lastEvent) > hhmmToMinutes(scheduleEnd)) {
    closeAt = lastEvent;
    closeSource = "LAST_EVENT";
  }

  // Never invent hours: for today, the clock-out cannot be in the future.
  if (workDate === workDateLima()) {
    const nowHhmm = clockLima().slice(0, 5);
    if (hhmmToMinutes(closeAt) > hhmmToMinutes(nowHhmm)) {
      closeAt = nowHhmm;
      closeSource = "NOW";
    }
  }

  let workedMinutes = 0;
  if (firstIn) {
    const span = hhmmToMinutes(closeAt) - hhmmToMinutes(firstIn);
    workedMinutes = Math.max(0, span - breakMinutes);
  }

  return { closeAt, closeSource, workedMinutes };
}

/**
 * Shifts still open in the range, each with the clock-out that would be
 * written. Read-only — nothing is modified until `closeOpenShifts` runs.
 */
export async function findOpenShifts(
  tenantId: string,
  from: string,
  to: string
): Promise<OpenShift[]> {
  const [rows, employees, schedule, tenantPlanned] = await Promise.all([
    queryOpenRows(tenantId, from, to),
    getAllActiveEmployees(tenantId),
    getTenantDefaultSchedule(tenantId),
    getTenantPlannedMinutes(tenantId),
  ]);

  const empById = new Map(employees.map((e) => [e.EmployeeID, e]));
  const today = workDateLima();

  const shifts = await Promise.all(
    rows.map(async (row) => {
      const workDate = row.WorkDate.replace(/^DATE#/, "");
      const emp = empById.get(row.EmployeeID);
      const scheduleEnd = emp?.Schedule?.endTime || schedule.endTime;
      const plannedMinutes = Number(row.plannedMinutes ?? tenantPlanned);
      const lastEvent = await lastEventHhmm(row.EmployeeID, workDate);
      const proposal = buildProposal(row, scheduleEnd, lastEvent);

      return {
        employeeId: row.EmployeeID,
        employeeName: emp?.FullName ?? row.EmployeeID.replace(/^EMP#/, ""),
        area: emp?.Area ?? "",
        workDate,
        firstInLocal: row.firstInLocal ?? null,
        breakMinutes: Number(row.breakMinutes ?? 0),
        plannedMinutes,
        daysOpen: daysBetween(workDate, today),
        ...proposal,
      } satisfies OpenShift;
    })
  );

  // Oldest first: those are the ones distorting closed payroll periods.
  return shifts.sort(
    (a, b) => a.workDate.localeCompare(b.workDate) || a.employeeName.localeCompare(b.employeeName, "es")
  );
}

export interface CloseTarget {
  employeeId: string;
  workDate: string;
}

export interface CloseOutcome {
  employeeId: string;
  workDate: string;
  status: "closed" | "skipped" | "failed";
  /** Why it was skipped, or what failed. */
  message?: string;
  closeAt?: string;
  closeSource?: CloseSource;
  workedMinutes?: number;
}

export interface CloseResult {
  groupId: string;
  closed: number;
  skipped: number;
  failed: number;
  outcomes: CloseOutcome[];
}

const ANOMALY: Record<CloseSource, string> = {
  LAST_EVENT: "Auto-cerrado al último evento — revisar",
  SCHEDULE_END: "Auto-cerrado a la hora planificada — revisar",
  NOW: "Auto-cerrado a la hora actual — revisar",
};

const STRICT_ANOMALY = "Auto-cerrado: jornada no finalizada";

/**
 * Close the given shifts, one audited write each under a shared group.
 *
 * Each row is re-read immediately before writing: between listing and clicking,
 * the employee may have clocked out on their own, and overwriting that with a
 * guessed time would destroy a real record. Those come back as `skipped`.
 */
export async function closeOpenShifts(
  params: {
    tenantId: string;
    targets: CloseTarget[];
    policy?: ClosePolicy;
    reason?: string;
  },
  actor: SessionUser
): Promise<CloseResult> {
  const { tenantId, targets, policy = "SOFT" } = params;

  if (targets.length === 0) {
    throw new ValidationError("No se seleccionó ninguna jornada");
  }
  if (targets.length > 500) {
    throw new ValidationError("Demasiadas jornadas en una sola operación (máximo 500)");
  }

  const [employees, schedule, tenantPlanned] = await Promise.all([
    getAllActiveEmployees(tenantId),
    getTenantDefaultSchedule(tenantId),
    getTenantPlannedMinutes(tenantId),
  ]);
  const empById = new Map(employees.map((e) => [e.EmployeeID, e]));

  const groupId = buildGroupId();
  const reason = params.reason?.trim() || "Cierre de jornadas abiertas";
  const outcomes: CloseOutcome[] = [];

  // Sequential on purpose: each iteration reads, writes and appends an audit
  // entry, and a burst of 500 parallel writes would trip Dynamo throttling for
  // no real gain — an admin clicking once can wait a few seconds.
  for (const target of targets) {
    const { employeeId, workDate } = target;
    try {
      const current = await readRow(employeeId, workDate);

      if (!current) {
        outcomes.push({ ...target, status: "skipped", message: "La jornada ya no existe" });
        continue;
      }
      // Tenant isolation: employeeId is a guessable EMP#<email>, so never
      // trust the caller's list without checking who the row belongs to.
      if (current.TenantID && current.TenantID !== tenantId) {
        outcomes.push({ ...target, status: "skipped", message: "La jornada es de otra empresa" });
        continue;
      }
      if (current.status !== "OPEN") {
        outcomes.push({
          ...target,
          status: "skipped",
          message: `Ya no está abierta (${current.status ?? "sin estado"})`,
        });
        continue;
      }

      const emp = empById.get(employeeId);
      const scheduleEnd = emp?.Schedule?.endTime || schedule.endTime;
      const plannedMinutes = Number(current.plannedMinutes ?? tenantPlanned);
      const lastEvent = await lastEventHhmm(employeeId, workDate);
      const proposal = buildProposal(current, scheduleEnd, lastEvent);

      const item = buildClosedItem(current, proposal, plannedMinutes, policy);

      await withAudit(
        {
          actor,
          entityType: "DAILY_SUMMARY",
          entityKey: { EmployeeID: employeeId, WorkDate: `DATE#${workDate}` },
          action: "UPDATE",
          reason,
          groupId,
          groupSize: targets.length,
        },
        async () => upsertDailySummary(item, true)
      );

      outcomes.push({
        ...target,
        status: "closed",
        closeAt: proposal.closeAt,
        closeSource: proposal.closeSource,
        workedMinutes: policy === "STRICT" ? 0 : proposal.workedMinutes,
      });
    } catch (err) {
      outcomes.push({
        ...target,
        status: "failed",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  }

  return {
    groupId,
    closed: outcomes.filter((o) => o.status === "closed").length,
    skipped: outcomes.filter((o) => o.status === "skipped").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    outcomes,
  };
}

async function readRow(employeeId: string, workDate: string): Promise<RawRow | null> {
  const res = await docClient.send(
    new GetCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: { EmployeeID: employeeId, WorkDate: `DATE#${workDate}` },
    })
  );
  return (res.Item as RawRow) ?? null;
}

/**
 * The row as it will be stored. Built by spreading the existing item so every
 * field we do not touch (GPS, photos, regularization metadata, TenantID)
 * survives — `upsertDailySummary` replaces the whole item.
 */
function buildClosedItem(
  current: RawRow,
  proposal: Proposal,
  plannedMinutes: number,
  policy: ClosePolicy
): Record<string, unknown> {
  const workDate = current.WorkDate.replace(/^DATE#/, "");
  const nowIso = new Date().toISOString();
  const anomalies = Array.isArray(current.anomalies) ? [...(current.anomalies as string[])] : [];

  if (policy === "STRICT") {
    if (!anomalies.includes(STRICT_ANOMALY)) anomalies.push(STRICT_ANOMALY);
    return {
      ...current,
      status: "MISSING",
      workedMinutes: 0,
      deltaMinutes: -plannedMinutes,
      plannedMinutes,
      source: "AUTO_CLOSE",
      autoClosedAt: nowIso,
      autoCloseSource: "STRICT",
      anomalies,
      updatedAt: nowIso,
    };
  }

  const note = ANOMALY[proposal.closeSource];
  if (!anomalies.includes(note)) anomalies.push(note);

  const closeLocalIso = buildLocalIso(workDate, proposal.closeAt);
  const worked = proposal.workedMinutes;

  return {
    ...current,
    lastOut: proposal.closeAt,
    lastOutLocal: closeLocalIso,
    lastOutUtc: new Date(`${workDate}T${proposal.closeAt}:00${LIMA_OFFSET}`).toISOString(),
    workedMinutes: worked,
    plannedMinutes,
    deltaMinutes: worked - plannedMinutes,
    // A guessed clock-out does not make an incomplete day complete: keep the
    // distinction the rest of the app already draws between OK and SHORT.
    status: worked >= plannedMinutes ? "OK" : "SHORT",
    source: "AUTO_CLOSE",
    autoClosedAt: nowIso,
    autoCloseSource: proposal.closeSource,
    anomalies,
    updatedAt: nowIso,
    updatedAtLocal: closeLocalIso,
  };
}
