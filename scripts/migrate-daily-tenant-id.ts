/**
 * One-time migration: backfill TenantID on DailySummary records.
 *
 * Usage:
 *   npx tsx scripts/migrate-daily-tenant-id.ts            # dry-run
 *   npx tsx scripts/migrate-daily-tenant-id.ts --execute   # apply changes
 *
 * Requires .env.local to be loaded (uses same DB config as the app).
 * Delete this script after successful migration.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
  ...((process.env.CUSTOM_ACCESS_KEY_ID && process.env.CUSTOM_SECRET_ACCESS_KEY) && {
    credentials: {
      accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
      secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
    },
  }),
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

const prefix = process.env.TABLE_PREFIX || "NovasysV2_";
const TABLE_EMPLOYEES = process.env.TABLE_EMPLOYEES || `${prefix}Employees`;
const TABLE_DAILY = process.env.TABLE_DAILY || `${prefix}DailySummary`;

const dryRun = !process.argv.includes("--execute");

async function getEmployeeTenantMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_EMPLOYEES,
        ProjectionExpression: "EmployeeID, TenantID",
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      })
    );
    for (const item of result.Items ?? []) {
      if (item.TenantID && item.EmployeeID) {
        map.set(item.EmployeeID as string, item.TenantID as string);
      }
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return map;
}

async function findRecordsMissingTenantId(): Promise<Array<{ EmployeeID: string; WorkDate: string }>> {
  const records: Array<{ EmployeeID: string; WorkDate: string }> = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_DAILY,
        FilterExpression: "attribute_not_exists(TenantID)",
        ProjectionExpression: "EmployeeID, WorkDate",
        ...(lastKey && { ExclusiveStartKey: lastKey }),
      })
    );
    for (const item of result.Items ?? []) {
      records.push({
        EmployeeID: item.EmployeeID as string,
        WorkDate: item.WorkDate as string,
      });
    }
    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return records;
}

async function main() {
  console.log(`\n=== Migracion TenantID en DailySummary ===`);
  console.log(`Modo: ${dryRun ? "DRY-RUN (sin cambios)" : "EJECUCION"}`);
  console.log(`Tabla: ${TABLE_DAILY}\n`);

  // 1) Build employee -> tenant mapping
  console.log("Cargando mapa empleado -> tenant...");
  const empTenantMap = await getEmployeeTenantMap();
  console.log(`  ${empTenantMap.size} empleados con TenantID encontrados.\n`);

  // 2) Find DailySummary records without TenantID
  console.log("Escaneando DailySummary sin TenantID...");
  const missing = await findRecordsMissingTenantId();
  console.log(`  ${missing.length} registros sin TenantID.\n`);

  if (missing.length === 0) {
    console.log("No hay registros que migrar. Todo esta en orden!");
    return;
  }

  // 3) Match each record to its tenant
  let matchable = 0;
  let noTenant = 0;
  const toUpdate: Array<{ EmployeeID: string; WorkDate: string; TenantID: string }> = [];

  for (const record of missing) {
    const tenantId = empTenantMap.get(record.EmployeeID);
    if (tenantId) {
      toUpdate.push({ ...record, TenantID: tenantId });
      matchable++;
    } else {
      noTenant++;
    }
  }

  console.log(`  ${matchable} registros tienen tenant identificado.`);
  if (noTenant > 0) {
    console.log(`  ${noTenant} registros de empleados sin TenantID (se omiten).`);
  }
  console.log();

  if (dryRun) {
    console.log("DRY-RUN completado. Ejecuta con --execute para aplicar cambios:");
    console.log("  npx tsx scripts/migrate-daily-tenant-id.ts --execute\n");
    return;
  }

  // 4) Apply updates
  console.log("Aplicando actualizaciones...");
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of toUpdate) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_DAILY,
          Key: {
            EmployeeID: record.EmployeeID,
            WorkDate: record.WorkDate,
          },
          UpdateExpression: "SET TenantID = :tid",
          ConditionExpression: "attribute_not_exists(TenantID)",
          ExpressionAttributeValues: { ":tid": record.TenantID },
        })
      );
      updated++;
      if (updated % 50 === 0) {
        console.log(`  ... ${updated}/${toUpdate.length} actualizados`);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
        skipped++;
        continue;
      }
      errors++;
      console.error(`  ERROR en ${record.EmployeeID}/${record.WorkDate}:`, err);
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`  Actualizados: ${updated}`);
  console.log(`  Omitidos (ya tenian TenantID): ${skipped}`);
  console.log(`  Errores: ${errors}`);
  console.log(`\nMigracion completada. Puedes eliminar este script.\n`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
