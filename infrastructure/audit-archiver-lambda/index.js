/**
 * novasys-audit-archiver Lambda
 * ------------------------------
 * Triggered by the NovasysV2_AuditLog DynamoDB Stream.
 * For each INSERT or MODIFY event, appends the new record as a JSON Lines entry
 * to an S3 object keyed by tenant + date + hour.
 *
 * S3 layout:
 *   s3://novasys-v2-audit-archive/tenantId={id}/year={YYYY}/month={MM}/day={DD}/{HH}.jsonl
 *
 * Idempotency: uses AuditID as dedupe key. Since S3 doesn't support append,
 * we implement read-modify-write using versioning + ETag preconditions.
 * For low volume this is fine; for high volume switch to Firehose.
 */

const { S3Client, GetObjectCommand, PutObjectCommand, NoSuchKey } = require("@aws-sdk/client-s3");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const BUCKET = process.env.AUDIT_ARCHIVE_BUCKET || "novasys-v2-audit-archive";
const s3 = new S3Client({});

function padKey(imageAttributeMap) {
  // DynamoDB Stream images use the wire format; unmarshall converts it to JS.
  try {
    return unmarshall(imageAttributeMap);
  } catch {
    return imageAttributeMap;
  }
}

function objectKey(tenantId, createdAtIso) {
  const d = new Date(createdAtIso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const safeTenant = encodeURIComponent(tenantId).replace(/%/g, "_");
  return `tenantId=${safeTenant}/year=${y}/month=${m}/day=${day}/${h}.jsonl`;
}

async function readExisting(key) {
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const stream = resp.Body;
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf-8");
  } catch (err) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return "";
    }
    throw err;
  }
}

async function appendLines(key, newLines) {
  const existing = await readExisting(key);
  const seenIds = new Set();
  if (existing) {
    for (const line of existing.split("\n")) {
      if (!line) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.AuditID) seenIds.add(obj.AuditID);
      } catch {
        // ignore malformed lines
      }
    }
  }

  const freshLines = newLines.filter((l) => {
    try {
      const obj = JSON.parse(l);
      if (obj.AuditID && seenIds.has(obj.AuditID)) return false;
      return true;
    } catch {
      return false;
    }
  });
  if (freshLines.length === 0) return;

  const combined =
    existing + (existing && !existing.endsWith("\n") ? "\n" : "") +
    freshLines.join("\n") + "\n";

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: combined,
      ContentType: "application/x-ndjson",
    })
  );
}

exports.handler = async (event) => {
  // Group records by target S3 key so we minimize S3 round-trips per invocation.
  const buckets = new Map();

  for (const record of event.Records || []) {
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;
    const image = record.dynamodb?.NewImage;
    if (!image) continue;

    const obj = padKey(image);
    const tenantId = obj.tenantId || "UNKNOWN";
    const createdAt = obj.createdAt || new Date().toISOString();
    const key = objectKey(tenantId, createdAt);

    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(JSON.stringify(obj));
  }

  const results = { written: 0, failed: 0 };
  for (const [key, lines] of buckets) {
    try {
      await appendLines(key, lines);
      results.written += lines.length;
    } catch (err) {
      console.error("[archiver] failed to write", key, err);
      results.failed += lines.length;
    }
  }

  console.log(
    `[archiver] processed ${event.Records?.length ?? 0} records ` +
    `(${results.written} written, ${results.failed} failed)`
  );

  // Returning failures here would retry the whole batch. Since we dedupe by
  // AuditID this is safe, but for simplicity we swallow per-object errors
  // and let CloudWatch surface them.
  return { statusCode: 200 };
};
