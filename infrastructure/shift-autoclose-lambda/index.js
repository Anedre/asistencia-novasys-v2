/**
 * novasys-shift-autoclose Lambda
 * ------------------------------
 * Runs every ~10 minutes (EventBridge rate(10 minutes)).
 *
 * Closes a shift once the employee has completed their laborable hours — but
 * ONLY when they asked for it. The trigger is `autoCloseRequested === true` on
 * the day's own row, set from the optional toggle offered at check-in.
 *
 * That per-shift flag replaced the old tenant-wide
 * `settings.workSchedule.autoCloseAtGoal` gate. The gate was invisible to the
 * person it affected, and an admin could leave it on for a year without a
 * single shift ever closing and nothing anywhere saying why. A flag written on
 * the row at check-in is explicit: the employee chose it, on this day, and the
 * condition this job looks for is the same thing the UI showed them.
 *
 *   1. Find today's (Lima TZ) rows with status "OPEN", autoCloseRequested true
 *      and no autoClosedAt.
 *   2. closeMin = firstIn + plannedMinutes + breakTaken
 *      (worked excludes break, so the break actually taken is added back).
 *   3. Once Lima "now" reaches it, mark END at exactly that minute: worked =
 *      plannedMinutes, status OK, autoClosedAt + autoCloseSource
 *      "GOAL_REACHED", anomaly tag, source AUTO_CLOSE. Guarded by a
 *      ConditionExpression so a manual END landing first always wins.
 *   4. Notify the employee and the tenant admins.
 *
 * Employees who are on break right now are left alone until they come back.
 *
 * Idempotent: rows already carrying autoClosedAt are filtered out.
 * Distinct from `novasys-shift-closer` (nightly, closes whatever is left open).
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
  USER_NOTIFICATIONS: `${PREFIX}UserNotifications`,
};

const INDEXES = {
  DAILY_BY_TENANT: "Tenant-WorkDate-index",
};

/* ───────────────────────────── helpers ────────────────────────────── */

/** Current Lima calendar date (UTC-5, no DST). */
function todayLima() {
  const limaMs = Date.now() - 5 * 60 * 60 * 1000;
  const d = new Date(limaMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Minutes since Lima midnight, right now. */
function nowMinutesLima() {
  const d = new Date(Date.now() - 5 * 60 * 60 * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function parseClockToMin(clock) {
  if (!clock) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(clock));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Lima local ISO from YYYY-MM-DD + minutes-of-day. */
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
    new GetCommand({ TableName: TABLES.EMPLOYEES, Key: { EmployeeID: employeeId } })
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
        FilterExpression:
          "#s = :open AND autoCloseRequested = :yes AND attribute_not_exists(autoClosedAt)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":wd": `DATE#${workDate}`,
          ":open": "OPEN",
          ":yes": true,
        },
        ExclusiveStartKey: lastKey,
      })
    );
    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return out;
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
        FilterExpression: "EmploymentStatus = :active AND (#r = :admin OR #r = :super)",
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
          [TABLES.USER_NOTIFICATIONS]: chunk.map((n) => ({ PutRequest: { Item: n } })),
        },
      })
    );
  }
}

/* ───────────────────────────── policy ────────────────────────────── */

/** Laborable goal in minutes: explicit plannedMinutes, else shift span − break. */
function goalMinutes(row, employee, tenantSettings) {
  const planned = Number(row.plannedMinutes);
  if (Number.isFinite(planned) && planned > 0) return planned;
  const ws = tenantSettings?.workSchedule || {};
  const start =
    parseClockToMin(employee?.Schedule?.startTime || ws.startTime || "09:00") ?? 540;
  const end =
    parseClockToMin(employee?.Schedule?.endTime || ws.endTime || "18:00") ?? 1080;
  const brk = Number(
    employee?.Schedule?.breakMinutes ?? ws.breakMinutes ?? 60
  );
  return Math.max(60, end - start - brk);
}

/**
 * Close one open shift if the employee has reached their laborable hours.
 * Returns notifications to enqueue, or [] if not yet due / skipped.
 */
async function autoCloseAtGoalOne({ row, employee, admins, tenantSettings, workDate, nowIso, nowMin }) {
  // Don't close someone who is on break RIGHT NOW.
  //
  // `breakStartUtc` is never cleared when the break ends — `lastBreakEndUtc` is
  // written alongside it — so testing `breakStartUtc` alone skipped, forever,
  // everyone who had ever taken a lunch break. Compare the two instead.
  const brkStart = row.breakStartUtc || null;
  const brkEnd = row.lastBreakEndUtc || null;
  const onBreakNow = Boolean(brkStart) && (!brkEnd || brkEnd < brkStart);
  if (onBreakNow) return [];

  const firstInMin = parseClockToMin(row.firstInLocal);
  if (firstInMin == null || !row.firstInUtc) return []; // no check-in to measure from

  const goal = goalMinutes(row, employee, tenantSettings);
  const breakTaken = Number(row.breakMinutes || 0);
  const closeMin = firstInMin + goal + breakTaken;

  // Not due yet — laborable hours not reached.
  if (nowMin < closeMin) return [];

  const closedLocalIso = buildLimaIso(workDate, closeMin);
  const closedUtc = limaIsoToUtcIso(closedLocalIso);
  const worked = goal; // closed exactly at the goal
  const planned = Number(row.plannedMinutes || goal);
  const delta = worked - planned;
  const status = worked >= planned ? "OK" : "SHORT";

  // Guard with a ConditionExpression so a manual END landing between the query
  // and this write doesn't get clobbered (ConditionalCheckFailed → skipped).
  await ddb.send(
    new UpdateCommand({
      TableName: TABLES.DAILY_SUMMARY,
      Key: { EmployeeID: row.EmployeeID, WorkDate: row.WorkDate },
      UpdateExpression: `
        SET lastOutUtc = :utc, lastOutLocal = :local, workedMinutes = :worked,
            deltaMinutes = :delta, #s = :status, autoClosedAt = :ts,
            autoCloseSource = :acsrc, anomalies = :anom, #src = :src
      `,
      ConditionExpression: "#s = :openGuard AND attribute_not_exists(autoClosedAt)",
      ExpressionAttributeNames: { "#s": "status", "#src": "source" },
      ExpressionAttributeValues: {
        ":utc": closedUtc,
        ":local": closedLocalIso,
        ":worked": worked,
        ":delta": delta,
        ":status": status,
        ":ts": nowIso,
        ":acsrc": "GOAL_REACHED",
        ":anom": [...(row.anomalies || []), "Auto-cerrado al cumplir horas laborables"],
        ":src": "AUTO_CLOSE",
        ":openGuard": "OPEN",
      },
    })
  );

  // Notifications
  const notifs = [];
  const ttl30d = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const closeHHMM = closedLocalIso.substring(11, 16);
  if (employee?.EmployeeID) {
    notifs.push({
      recipientId: employee.EmployeeID,
      createdAt: nowIso,
      notificationId: `NOTIF#AUTOCLOSEGOAL#${workDate}#${employee.EmployeeID}`,
      type: "SHIFT_AUTO_CLOSED",
      title: "Cerramos tu jornada al cumplir tus horas",
      message: `Completaste tus horas laborables el ${workDate}; como pediste el cierre automático al marcar entrada, registramos tu salida a las ${closeHHMM}. Si seguiste trabajando, regularízalo desde tu dashboard.`,
      referenceId: workDate,
      readAt: null,
      ttl: ttl30d,
    });
  }
  for (const admin of admins) {
    notifs.push({
      recipientId: admin.EmployeeID,
      createdAt: nowIso,
      notificationId: `NOTIF#AUTOCLOSEGOAL#${workDate}#${employee?.EmployeeID || "?"}#TO#${admin.EmployeeID}`,
      type: "SHIFT_AUTO_CLOSED_ADMIN",
      title: `Auto-cierre por horas: ${employee?.FullName ?? "Empleado"}`,
      message: `Jornada del ${workDate} cerrada a las ${closeHHMM} al cumplir las horas laborables.`,
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
  const nowMin = nowMinutesLima();
  let totalClosed = 0;
  let totalNotifs = 0;

  // Every active tenant is swept: whether a given day closes is decided per
  // row by the employee's own opt-in, not by a company-wide switch.
  const enabled = await listActiveTenants();
  console.log(
    `[shift-autoclose] ${enabled.length} tenants · workDate=${workDate} nowMin=${nowMin}`
  );

  for (const tenant of enabled) {
    try {
      const rows = await listOpenDaysForTenant(tenant.TenantID, workDate);
      if (rows.length === 0) continue;

      const admins = await getAdmins(tenant.TenantID);
      const notifs = [];

      for (const row of rows) {
        const employee = await getEmployee(row.EmployeeID);
        let made = [];
        try {
          made = await autoCloseAtGoalOne({
            row,
            employee,
            admins,
            tenantSettings: tenant.settings || {},
            workDate,
            nowIso,
            nowMin,
          });
        } catch (err) {
          // ConditionalCheckFailed = someone closed it already; ignore.
          if (err?.name !== "ConditionalCheckFailedException") {
            console.error(`[shift-autoclose] ${row.EmployeeID} failed:`, err?.message || err);
          }
          continue;
        }
        if (made.length > 0) {
          notifs.push(...made);
          totalClosed++;
        }
      }

      if (notifs.length > 0) {
        await writeNotifications(notifs);
        totalNotifs += notifs.length;
      }
      if (rows.length > 0) {
        console.log(`[shift-autoclose] tenant=${tenant.TenantID} open=${rows.length} closed-now=${notifs.length ? "yes" : "no"}`);
      }
    } catch (err) {
      console.error(`[shift-autoclose] tenant=${tenant.TenantID} failed:`, err?.message || err);
    }
  }

  console.log(`[shift-autoclose] DONE — closed ${totalClosed}, wrote ${totalNotifs} notifs`);
  return { ok: true, closed: totalClosed, notifications: totalNotifs };
};
