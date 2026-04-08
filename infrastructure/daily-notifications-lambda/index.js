/**
 * novasys-daily-notifications Lambda
 * ----------------------------------
 * Triggered daily by EventBridge at 08:00 America/Lima (13:00 UTC).
 *
 * For each active tenant, scans employees to find:
 *   1. Birthdays today → celebrate every employee in the tenant
 *   2. Upcoming birthdays (in 3 days) → warn admins so they can prepare
 *   3. Work anniversaries today → celebrate every employee in the tenant
 *   4. Pending approval requests older than 24h → remind admins
 *
 * Notifications are idempotent per-day per-employee-per-recipient, so if
 * EventBridge fires the Lambda twice we don't duplicate rows.
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const REGION = process.env.AWS_REGION || "us-east-1";
const PREFIX = process.env.TABLE_PREFIX || "NovasysV2_";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const TABLES = {
  TENANTS: `${PREFIX}Tenants`,
  EMPLOYEES: `${PREFIX}Employees`,
  APPROVAL_REQUESTS: `${PREFIX}ApprovalRequests`,
  USER_NOTIFICATIONS: `${PREFIX}UserNotifications`,
};

/* ───────────────────────────── helpers ────────────────────────────── */

function todayLima() {
  // 08:00 local (-05:00) = 13:00 UTC; we format today's date in Lima timezone.
  const now = new Date();
  // Shift UTC → Lima by subtracting 5 hours
  const limaMs = now.getTime() - 5 * 60 * 60 * 1000;
  const d = new Date(limaMs);
  return {
    ymd: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
    mmdd: `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`,
    year: d.getUTCFullYear(),
  };
}

function addDays(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return {
    ymd: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
    mmdd: `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
  };
}

/**
 * Deterministic notification id derived from the type + date + participants.
 * Lets DynamoDB overwrite silently (same PK+SK) instead of creating dupes.
 */
function makeNotifId(type, day, subjectId) {
  return `NOTIF#DAILY#${type}#${day}#${subjectId}`;
}

async function writeBatch(notifs) {
  // DynamoDB BatchWriteItem has a hard cap of 25 items per request.
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

async function listEmployees(tenantId) {
  const out = [];
  let lastKey;
  do {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: TABLES.EMPLOYEES,
        IndexName: "Tenant-index",
        KeyConditionExpression: "TenantID = :tid",
        FilterExpression: "EmploymentStatus = :active",
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":active": "ACTIVE",
        },
        ExclusiveStartKey: lastKey,
      })
    );
    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

async function listPendingRequests(tenantId) {
  const out = [];
  let lastKey;
  do {
    const resp = await ddb.send(
      new QueryCommand({
        TableName: TABLES.APPROVAL_REQUESTS,
        IndexName: "Tenant-Status-index",
        KeyConditionExpression: "TenantID = :tid AND #s = :pending",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":tid": tenantId,
          ":pending": "PENDING",
        },
        ExclusiveStartKey: lastKey,
      })
    );
    out.push(...(resp.Items || []));
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

/* ───────────────────────────── handler ────────────────────────────── */

exports.handler = async () => {
  const today = todayLima();
  const in3 = addDays(today.ymd, 3);
  const nowIso = new Date().toISOString();
  const nowEpoch = Math.floor(Date.now() / 1000);
  const ttl30d = nowEpoch + 30 * 24 * 60 * 60;

  let totalWritten = 0;
  const tenants = await listActiveTenants();
  console.log(`[daily-notifications] processing ${tenants.length} tenants`);

  for (const tenant of tenants) {
    try {
      const employees = await listEmployees(tenant.TenantID);
      if (employees.length === 0) continue;

      const admins = employees.filter(
        (e) => e.Role === "ADMIN" || e.Role === "SUPER_ADMIN"
      );
      const allEmployeeIds = employees.map((e) => e.EmployeeID);
      const notifs = [];

      /* 1 — Birthdays today */
      const birthdayPeople = employees.filter(
        (e) =>
          e.BirthDate &&
          typeof e.BirthDate === "string" &&
          e.BirthDate.slice(5, 10) === today.mmdd
      );
      for (const birthdayPerson of birthdayPeople) {
        for (const recipientId of allEmployeeIds) {
          const isSelf = recipientId === birthdayPerson.EmployeeID;
          notifs.push({
            recipientId,
            createdAt: nowIso,
            notificationId: makeNotifId(
              "BDAY",
              today.ymd,
              birthdayPerson.EmployeeID + "@" + recipientId
            ),
            type: "BIRTHDAY_TODAY",
            title: isSelf
              ? "¡Feliz cumpleaños!"
              : `Hoy cumple ${birthdayPerson.FullName}`,
            message: isSelf
              ? "Todo el equipo te desea un feliz día."
              : `Envíale un saludo a ${birthdayPerson.FullName}.`,
            referenceId: birthdayPerson.EmployeeID,
            referenceType: "EMPLOYEE",
            read: false,
            soundType: "celebrate",
            TenantID: tenant.TenantID,
            ttl: ttl30d,
          });
        }
      }

      /* 2 — Upcoming birthdays (3 days) — admin only */
      const upcomingPeople = employees.filter(
        (e) => e.BirthDate && e.BirthDate.slice(5, 10) === in3.mmdd
      );
      for (const person of upcomingPeople) {
        for (const admin of admins) {
          notifs.push({
            recipientId: admin.EmployeeID,
            createdAt: nowIso,
            notificationId: makeNotifId(
              "BDAY_SOON",
              today.ymd,
              person.EmployeeID + "@" + admin.EmployeeID
            ),
            type: "BIRTHDAY_UPCOMING",
            title: `${person.FullName} cumple en 3 días`,
            message: `Recuerda preparar algo para el cumpleaños de ${person.FullName} (${in3.ymd}).`,
            referenceId: person.EmployeeID,
            referenceType: "EMPLOYEE",
            read: false,
            soundType: "system",
            TenantID: tenant.TenantID,
            ttl: ttl30d,
          });
        }
      }

      /* 3 — Work anniversaries today */
      const anniversaryPeople = employees.filter((e) => {
        if (!e.HireDate || typeof e.HireDate !== "string") return false;
        if (e.HireDate.slice(5, 10) !== today.mmdd) return false;
        const hireYear = Number(e.HireDate.slice(0, 4));
        return Number.isFinite(hireYear) && hireYear < today.year;
      });
      for (const person of anniversaryPeople) {
        const years = today.year - Number(person.HireDate.slice(0, 4));
        for (const recipientId of allEmployeeIds) {
          const isSelf = recipientId === person.EmployeeID;
          notifs.push({
            recipientId,
            createdAt: nowIso,
            notificationId: makeNotifId(
              "ANNI",
              today.ymd,
              person.EmployeeID + "@" + recipientId
            ),
            type: "WORK_ANNIVERSARY",
            title: isSelf
              ? `¡${years} año${years === 1 ? "" : "s"} en la empresa!`
              : `${person.FullName} cumple ${years} año${years === 1 ? "" : "s"}`,
            message: isSelf
              ? "Gracias por todo tu trabajo y compromiso."
              : `Hoy celebramos ${years} año${years === 1 ? "" : "s"} de ${person.FullName} en el equipo.`,
            referenceId: person.EmployeeID,
            referenceType: "EMPLOYEE",
            read: false,
            soundType: "celebrate",
            TenantID: tenant.TenantID,
            ttl: ttl30d,
          });
        }
      }

      /* 4 — Pending requests reminder for admins */
      const pending = await listPendingRequests(tenant.TenantID);
      const stalePending = pending.filter((r) => {
        if (!r.createdAt) return false;
        const createdMs = new Date(r.createdAt).getTime();
        return Date.now() - createdMs > 24 * 60 * 60 * 1000;
      });
      if (stalePending.length > 0) {
        for (const admin of admins) {
          notifs.push({
            recipientId: admin.EmployeeID,
            createdAt: nowIso,
            notificationId: makeNotifId(
              "PENDING",
              today.ymd,
              admin.EmployeeID
            ),
            type: "PENDING_REMINDER",
            title: `${stalePending.length} solicitud${stalePending.length === 1 ? "" : "es"} pendiente${stalePending.length === 1 ? "" : "s"}`,
            message: `Tienes ${stalePending.length} solicitud${stalePending.length === 1 ? "" : "es"} esperando revisión desde hace más de 24h.`,
            referenceId: "/admin/approvals",
            referenceType: "APPROVAL",
            read: false,
            soundType: "system",
            TenantID: tenant.TenantID,
            ttl: ttl30d,
          });
        }
      }

      if (notifs.length > 0) {
        await writeBatch(notifs);
        totalWritten += notifs.length;
        console.log(
          `[daily-notifications] tenant=${tenant.TenantID} wrote=${notifs.length}`
        );
      }
    } catch (err) {
      console.error(
        `[daily-notifications] tenant ${tenant.TenantID} failed`,
        err
      );
    }
  }

  console.log(
    `[daily-notifications] done — total notifications written: ${totalWritten}`
  );
  return { statusCode: 200, written: totalWritten };
};
