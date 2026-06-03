/**
 * One-time data cleanup: normalize the `Area` field on Employee records so
 * accent/spacing/casing variants (e.g. "Consultoria" vs "Consultoría") collapse
 * to a single canonical spelling (the accented one is preferred).
 *
 * Usage:
 *   node scripts/fix-employee-areas.mjs              # dry-run (no changes)
 *   node scripts/fix-employee-areas.mjs --execute    # apply changes
 *
 * Reads .env.local for the same DB config the app uses. Safe to re-run
 * (each update is guarded by a ConditionExpression on the old value).
 * Delete this script after a successful run.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
  ...(process.env.CUSTOM_ACCESS_KEY_ID && process.env.CUSTOM_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
          secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

const prefix = process.env.TABLE_PREFIX || "NovasysV2_";
const TABLE_EMPLOYEES = process.env.TABLE_EMPLOYEES || `${prefix}Employees`;
const dryRun = !process.argv.includes("--execute");

const norm = (raw) => (raw ?? "").trim().replace(/\s+/g, " ");
const areaKey = (raw) =>
  norm(raw).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const hasDiacritics = (s) => s !== s.normalize("NFD").replace(/\p{M}/gu, "");

async function scanEmployees() {
  const out = [];
  let lastKey;
  do {
    const r = await docClient.send(
      new ScanCommand({
        TableName: TABLE_EMPLOYEES,
        ProjectionExpression: "EmployeeID, Area, FullName, TenantID",
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      })
    );
    for (const it of r.Items ?? []) out.push(it);
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  return out;
}

async function main() {
  console.log(`\n=== Normalización de Area en Empleados ===`);
  console.log(`Modo:  ${dryRun ? "DRY-RUN (sin cambios)" : "EJECUCIÓN"}`);
  console.log(`Tabla: ${TABLE_EMPLOYEES}\n`);

  const emps = await scanEmployees();
  console.log(`${emps.length} empleados escaneados.\n`);

  // Group raw Area variants by normalized key, counting occurrences.
  const groups = new Map(); // key -> Map<variant, count>
  for (const e of emps) {
    const raw = norm(e.Area);
    if (!raw) continue;
    const key = areaKey(raw);
    if (!groups.has(key)) groups.set(key, new Map());
    const m = groups.get(key);
    m.set(raw, (m.get(raw) ?? 0) + 1);
  }

  // Canonical per group: prefer the variant with diacritics, then the most common.
  const canonical = new Map(); // key -> canonical label
  for (const [key, variants] of groups) {
    const arr = [...variants.entries()].sort((a, b) => {
      const da = hasDiacritics(a[0]) ? 1 : 0;
      const db = hasDiacritics(b[0]) ? 1 : 0;
      if (da !== db) return db - da;
      return b[1] - a[1];
    });
    canonical.set(key, arr[0][0]);
  }

  console.log("Áreas detectadas:");
  for (const [key, variants] of groups) {
    const canon = canonical.get(key);
    const variantStr = [...variants.entries()]
      .map(([v, c]) => `"${v}"×${c}`)
      .join(", ");
    const needsFix = [...variants.keys()].some((v) => v !== canon);
    console.log(`  ${needsFix ? "FIX→" : "ok  "} ${variantStr}  ⇒  "${canon}"`);
  }
  console.log();

  const toUpdate = [];
  for (const e of emps) {
    const raw = norm(e.Area);
    if (!raw) continue;
    const canon = canonical.get(areaKey(raw));
    if (canon && raw !== canon) {
      toUpdate.push({
        EmployeeID: e.EmployeeID,
        FullName: e.FullName ?? e.EmployeeID,
        TenantID: e.TenantID ?? "—",
        from: raw,
        to: canon,
      });
    }
  }

  console.log(`${toUpdate.length} empleados a actualizar:`);
  for (const u of toUpdate) {
    console.log(`  [${u.TenantID}] ${u.FullName}: "${u.from}" → "${u.to}"`);
  }
  console.log();

  if (toUpdate.length === 0) {
    console.log("Nada que corregir. ✓\n");
    return;
  }
  if (dryRun) {
    console.log("DRY-RUN completado. Ejecuta con --execute para aplicar:");
    console.log("  node scripts/fix-employee-areas.mjs --execute\n");
    return;
  }

  console.log("Aplicando actualizaciones...");
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  for (const u of toUpdate) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_EMPLOYEES,
          Key: { EmployeeID: u.EmployeeID },
          UpdateExpression: "SET Area = :new",
          ConditionExpression: "Area = :old",
          ExpressionAttributeValues: { ":new": u.to, ":old": u.from },
        })
      );
      updated++;
    } catch (err) {
      if (err && err.name === "ConditionalCheckFailedException") {
        skipped++;
        continue;
      }
      errors++;
      console.error(`  ERROR ${u.EmployeeID}:`, err?.message ?? err);
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`  Actualizados: ${updated}`);
  console.log(`  Omitidos (ya cambiados): ${skipped}`);
  console.log(`  Errores: ${errors}\n`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
