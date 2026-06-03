/**
 * novasys-shift-closer Lambda
 * ---------------------------
 * Triggered nightly by EventBridge at 23:00 America/Lima (04:00 UTC next day).
 *
 * For each ACTIVE tenant:
 *   1. Find DailySummary rows for today (Lima TZ) with status === "OPEN".
 *   2. Apply auto-close policy (read from tenant.settings.workSchedule):
 *      - strict (`autoCloseShifts = false`)
 *          → mark the row as MISSING, clear worked time, anomaly tag.
 *      - soft   (`autoCloseShifts = true`, default)
 *          → set lastOutUtc to schedule end time (clamped to "now" so we
 *            never invent future hours), recompute worked/delta, push
 *            anomaly "Auto-cerrado".
 *   3. Write notifications to the employee AND the tenant admins.
 *
 * Idempotency: each DailySummary gets `autoClosedAt` once. The Lambda
 * skips any row that already has that field, so re-running on the same
 * day is a no-op.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const REGION = process.env.AWS_REGION || "us-east-1";
const PREFIX = process.env.TABLE_PREFIX || "NovasysV2_";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const TABLES = {
  TENANTS: `${PREFIX}Tenants`,
  EMPLOYEES: `${PREFIX}Employees`,
  DAILY_SUMMARY: `${PREFIX}DailySummary`,
  ATTENDANCE_EVENTS: `${PREFIX}AttendanceEvents`,
  USER_NOTIFICATIONS: `${PREFIX}UserNotifications`,
};

const INDEXES = {
  DAILY_BY_TENANT: "Tenant-WorkDate-index",
};

/* ───────────────────────────── helpers ────────────────────────────── */

function todayLima() {
  // The Lambda fires at 04:00 UTC = 23:00 Lima prev day. To target
  // *yesterday Lima* (i.e., the workday that's ending), we compute the
  // current Lima date by subtracting 5 hours from UTC.
  const now = new Date();
  const limaMs = now.getTime() - 5 * 60 * 60 * 1000;
  const d = new Date(limaMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseClockToMin(clock) {
  if (!clock) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(clock);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function fmtMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Build a Lima local ISO string from YYYY-MM-DD and minutes-since-midnight. */
function buildLimaIso(ymd, minutesOfDay) {
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${ymd}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00-05:00`;
}

function limaIsoToUtcIso(limaIso) {
  return new Date(limaIso).toISOString();
}

async function listActiveTenants() {
  const out = [];
  let lastKey;
  do {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: TABLES.TENANTS,
        FilterExpression: "#s = :active",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":active": "ACTIVE" },
        ExclusiveStartKey: lastKey,
      })
    );
    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

async function getEmployee(employeeId) {
  const r = await ddb.send(
    new GetCommand({
      TableName: TABLES.EMPLOYEES,
      Key: { EmployeeID: employeeId },
    })
  );
  return r.Item || null;
}

async function listOpenDaysForTenant(tenantId, workDate) {
  const out = [];
  let lastKey;
  do {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: TABLES.DAILY_SUMMARY,
        IndexName: INDEXES.DAILY_BY_TENANT,
        KeyConditionExpression: "TenantID = :tid AND WorkDate = :wd",
        FilterExpression: "#s = :open AND attribute_not_exists(autoClosedAt)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":wd": `DATE#${workDate}`,
          ":open": "OPEN",
        },
        ExclusiveStartKey: lastKey,
      })
    );
    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

/**
 * Find the most recent attendance event for `employeeId` on `workDate`
 * (Lima local). Returns its UTC timestamp (ISO string) or null when no
 * events exist. We widen the EventTS range to cover the whole Lima day
 * in UTC (workDate 00:00 Lima = previous-UTC-05:00 ... workDate 23:59
 * Lima = next-UTC-04:59), so events that crossed midnight UTC are still
 * captured.
 */
async function getLastEventUtc(employeeId, workDate) {
  // workDate "2026-05-22" → Lima window = UTC "2026-05-22T05:00:00Z" to "2026-05-23T05:00:00Z".
  // Add a small slop so we definitely include events at the boundaries.
  const startTs = `TS#${workDate}T00:00:00.000Z`;
  // Next day UTC at 12:00 — plenty of buffer.
  const nextDay = new Date(`${workDate}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextYmd = `${nextDay.getUTCFullYear()}-${String(
    nextDay.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;
  const endTs = `TS#${nextYmd}T12:00:00.000Z`;

  const resp = await ddb.send(
    new QueryCommand({
      TableName: TABLES.ATTENDANCE_EVENTS,
      KeyConditionExpression:
        "EmployeeID = :eid AND EventTS BETWEEN :start AND :end",
      // Defensive filter on workDate attribute too — covers edge cases
      // where the EventTS range catches a stray event from another day.
      FilterExpression: "workDate = :wd",
      ExpressionAttributeValues: {
        ":eid": employeeId,
        ":start": startTs,
        ":end": endTs,
        ":wd": workDate,
      },
      ScanIndexForward: false, // newest first
      Limit: 1,
    })
  );
  const item = resp.Items?.[0];
  return item?.serverTimeUtc || null;
}

async function getAdmins(tenantId) {
  const out = [];
  let lastKey;
  do {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: TABLES.EMPLOYEES,
        IndexName: "Tenant-index",
        KeyConditionExpression: "TenantID = :tid",
        FilterExpression:
          "EmploymentStatus = :active AND (#r = :admin OR #r = :super)",
        ExpressionAttributeNames: { "#r": "Role" },
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":active": "ACTIVE",
          ":admin": "ADMIN",
          ":super": "SUPER_ADMIN",
        },
        ExclusiveStartKey: lastKey,
      })
    );
    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

async function writeNotifications(notifs) {
  for (let i = 0; i < notifs.length; i += 25) {
    const chunk = notifs.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLES.USER_NOTIFICATIONS]: chunk.map((n) => ({
            PutRequest: { Item: n },
          })),
        },
      })
    );
  }
}

/* ───────────────────────────── policy ────────────────────────────── */

/**
 * Pick the end-of-shift time used by the soft auto-close. Priority:
 *   employee.Schedule.endTime → tenant.workSchedule.endTime
 *   → tenant.defaultSchedule.endTime → "18:00"
 */
function pickEndTime(employee, tenantSettings) {
  return (
    employee?.Schedule?.endTime ||
    tenantSettings?.workSchedule?.endTime ||
    tenantSettings?.defaultSchedule?.endTime ||
    "18:00"
  );
}

/**
 * Apply auto-close to a single OPEN day.
 * Returns the notification objects to enqueue (empty array on failure).
 */
async function autoCloseOne({
  row,
  employee,
  admins,
  tenantSettings,
  workDate,
  nowIso,
}) {
  const policy =
    tenantSettings?.workSchedule?.autoCloseShifts === false ? "strict" : "soft";

  // For SOFT mode we want the most accurate "actual end of work" we can
  // infer. Priority:
  //   1. Latest attendance event timestamp for the day (BREAK_END after
  //      schedule, a forgotten END, anything > scheduleEnd → respect the
  //      overtime instead of trimming it).
  //   2. scheduleEndTime from employee or tenant.
  //   Both are clamped to "now" so we never invent future hours.
  let closedLocalIso = null;
  let usedOvertime = false;
  if (policy !== "strict") {
    const endTime = pickEndTime(employee, tenantSettings);
    const endMin = parseClockToMin(endTime) ?? 18 * 60;

    // Now in Lima = UTC - 5 hours (no DST in Peru).
    const nowLima = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const nowMinLima =
      nowLima.getUTCHours() * 60 + nowLima.getUTCMinutes();

    let closeMin = Math.min(endMin, nowMinLima);

    // Look for the actual last event — if the employee clocked
    // something AFTER their schedule (e.g. BREAK_END at 18:45 because
    // they came back from a long break and forgot to END), respect it.
    try {
      const lastUtc = await getLastEventUtc(row.EmployeeID, workDate);
      if (lastUtc) {
        const lastDate = new Date(lastUtc);
        const limaMs = lastDate.getTime() - 5 * 60 * 60 * 1000;
        const limaDate = new Date(limaMs);
        // Ensure we're still on the same Lima day as workDate
        const sameDay =
          `${limaDate.getUTCFullYear()}-${String(
            limaDate.getUTCMonth() + 1
          ).padStart(2, "0")}-${String(limaDate.getUTCDate()).padStart(2, "0")}` ===
          workDate;
        if (sameDay) {
          const lastMinLima =
            limaDate.getUTCHours() * 60 + limaDate.getUTCMinutes();
          if (lastMinLima > closeMin) {
            // Overtime: respect the actual last event time.
            closeMin = Math.min(lastMinLima, nowMinLima);
            usedOvertime = true;
          }
        }
      }
    } catch (err) {
      console.warn(
        `[shift-closer] getLastEventUtc failed for ${row.EmployeeID}:`,
        err?.message || err
      );
      // fall back to scheduleEnd silently
    }

    closedLocalIso = buildLimaIso(workDate, closeMin);
  }

  if (policy === "strict") {
    // Demote the row to MISSING (no worked hours).
    await ddb.send(
      new UpdateCommand({
        TableName: TABLES.DAILY_SUMMARY,
        Key: row.EmployeeID
          ? { EmployeeID: row.EmployeeID, WorkDate: row.WorkDate }
          : null,
        UpdateExpression:
          "SET #s = :missing, workedMinutes = :zero, deltaMinutes = :negPlanned, autoClosedAt = :ts, anomalies = :anom",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":missing": "MISSING",
          ":zero": 0,
          ":negPlanned": -Number(row.plannedMinutes || 480),
          ":ts": nowIso,
          ":anom": [...(row.anomalies || []), "Auto-cerrado: jornada no finalizada"],
        },
      })
    );
  } else {
    // Soft close: set lastOutUtc/Local, recompute worked, leave anomaly.
    const closedUtc = limaIsoToUtcIso(closedLocalIso);
    const firstInUtc = row.firstInUtc;
    const breakMin = Number(row.breakMinutes || 0);
    let worked = 0;
    if (firstInUtc) {
      const total = Math.floor(
        (new Date(closedUtc).getTime() - new Date(firstInUtc).getTime()) / 60000
      );
      worked = Math.max(0, total - breakMin);
    }
    const planned = Number(row.plannedMinutes || 480);
    const delta = worked - planned;
    const status = worked >= planned ? "OK" : "SHORT";
    // Different anomaly tag depending on whether we used overtime fallback
    // or the schedule end. The admin reading the log can tell at a glance
    // whether the chosen time matched real activity or was a default.
    const anomalyTag = usedOvertime
      ? "Auto-cerrado al último evento — revisar"
      : "Auto-cerrado a la hora planificada — revisar";
    await ddb.send(
      new UpdateCommand({
        TableName: TABLES.DAILY_SUMMARY,
        Key: { EmployeeID: row.EmployeeID, WorkDate: row.WorkDate },
        UpdateExpression: `
          SET lastOutUtc = :utc,
              lastOutLocal = :local,
              workedMinutes = :worked,
              deltaMinutes = :delta,
              #s = :status,
              autoClosedAt = :ts,
              autoCloseSource = :acsrc,
              anomalies = :anom,
              #src = :src
        `,
        ExpressionAttributeNames: { "#s": "status", "#src": "source" },
        ExpressionAttributeValues: {
          ":utc": closedUtc,
          ":local": closedLocalIso,
          ":worked": worked,
          ":delta": delta,
          ":status": status,
          ":ts": nowIso,
          ":acsrc": usedOvertime ? "LAST_EVENT" : "SCHEDULE_END",
          ":anom": [...(row.anomalies || []), anomalyTag],
          ":src": "AUTO_CLOSE",
        },
      })
    );
  }

  // Build notifications (employee + admins)
  const notifs = [];
  const nowEpoch = Math.floor(Date.now() / 1000);
  const ttl30d = nowEpoch + 30 * 24 * 60 * 60;
  const titleSelf =
    policy === "strict"
      ? "Tu jornada de ayer fue marcada como ausencia"
      : "Cerramos tu jornada automáticamente";
  const messageSelf =
    policy === "strict"
      ? `No registraste salida el ${workDate}. Pide a tu admin que regularice el día.`
      : usedOvertime
        ? `No marcaste salida el ${workDate}. La cerramos al horario de tu último evento registrado. Si trabajaste más, regularízalo desde tu dashboard.`
        : `No marcaste salida el ${workDate}. La cerramos a la hora planificada. Si trabajaste más, regularízalo desde tu dashboard.`;
  if (employee?.EmployeeID) {
    notifs.push({
      recipientId: employee.EmployeeID,
      createdAt: nowIso,
      notificationId: `NOTIF#AUTOCLOSE#${workDate}#${employee.EmployeeID}`,
      type: "SHIFT_AUTO_CLOSED",
      title: titleSelf,
      message: messageSelf,
      referenceId: workDate,
      readAt: null,
      ttl: ttl30d,
    });
  }
  for (const admin of admins) {
    notifs.push({
      recipientId: admin.EmployeeID,
      createdAt: nowIso,
      notificationId: `NOTIF#AUTOCLOSE#${workDate}#${employee?.EmployeeID || "?"}#TO#${admin.EmployeeID}`,
      type: "SHIFT_AUTO_CLOSED_ADMIN",
      title: `Auto-cierre: ${employee?.FullName ?? "Empleado"}`,
      message:
        policy === "strict"
          ? `Jornada del ${workDate} marcada como MISSING (strict).`
          : usedOvertime
            ? `Jornada del ${workDate} cerrada al último evento registrado (incluye overtime).`
            : `Jornada del ${workDate} cerrada a la hora planificada.`,
      referenceId: workDate,
      readAt: null,
      ttl: ttl30d,
    });
  }
  return notifs;
}

/* ───────────────────────────── handler ────────────────────────────── */

exports.handler = async () => {
  const workDate = todayLima();
  const nowIso = new Date().toISOString();
  let totalClosed = 0;
  let totalNotifs = 0;

  const tenants = await listActiveTenants();
  console.log(
    `[shift-closer] processing ${tenants.length} tenants for workDate=${workDate}`
  );

  for (const tenant of tenants) {
    try {
      const rows = await listOpenDaysForTenant(tenant.TenantID, workDate);
      if (rows.length === 0) continue;

      const admins = await getAdmins(tenant.TenantID);
      const notifs = [];

      for (const row of rows) {
        const employee = await getEmployee(row.EmployeeID);
        const made = await autoCloseOne({
          row,
          employee,
          admins,
          tenantSettings: tenant.settings || {},
          workDate,
          nowIso,
        });
        notifs.push(...made);
        totalClosed++;
      }

      if (notifs.length > 0) {
        await writeNotifications(notifs);
        totalNotifs += notifs.length;
      }
      console.log(
        `[shift-closer] tenant=${tenant.TenantID} closed=${rows.length} notifs=${notifs.length}`
      );
    } catch (err) {
      console.error(
        `[shift-closer] tenant=${tenant.TenantID} failed:`,
        err?.message || err
      );
      // continue with the rest
    }
  }

  console.log(
    `[shift-closer] DONE — closed ${totalClosed} shift(s), wrote ${totalNotifs} notification(s)`
  );
  return { ok: true, closed: totalClosed, notifications: totalNotifs };
};
