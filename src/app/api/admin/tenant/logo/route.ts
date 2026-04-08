/**
 * POST /api/admin/tenant/logo
 *
 * Multipart upload of a tenant logo to S3. Only admins of the tenant can
 * upload. Each upload overwrites the previous file for the same tenant.
 * The resulting public URL is stored in tenant.branding.logoUrl via the
 * existing updateTenantBranding db helper, wrapped with withAudit so the
 * change is reversible from /admin/audit.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler, ValidationError } from "@/lib/utils/errors";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { updateTenantBranding } from "@/lib/db/tenants";
import { withAudit } from "@/lib/services/audit.service";

const s3 = new S3Client({
  region:
    process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...((process.env.CUSTOM_ACCESS_KEY_ID &&
    process.env.CUSTOM_SECRET_ACCESS_KEY) && {
    credentials: {
      accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
      secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
    },
  }),
});

const BUCKET = process.env.REPORT_BUCKET || "novasys-v2-reports";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    throw new ValidationError(
      "El cuerpo debe ser multipart/form-data con un campo 'logo'"
    );
  }
  const file = formData.get("logo") as File | null;

  if (!file) {
    throw new ValidationError("No se envió archivo");
  }
  if (file.size > MAX_SIZE) {
    throw new ValidationError("Imagen demasiado grande (máximo 2MB)");
  }
  if (!ALLOWED.includes(file.type)) {
    throw new ValidationError(
      "Formato no soportado. Usa JPG, PNG, WebP o SVG"
    );
  }

  // Pick an extension matching the mime type.
  const ext =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/svg+xml"
      ? "svg"
      : file.type.split("/")[1];

  // Normalize the slug so the S3 key is predictable and stable per tenant.
  const slug = user.tenantSlug || user.tenantId.replace(/^TENANT#/, "");
  // Append a cache-busting timestamp so CDNs / browsers refresh.
  const key = `tenant-logos/${slug}-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "max-age=86400",
    })
  );

  const logoUrl = `https://${BUCKET}.s3.amazonaws.com/${key}`;

  await withAudit(
    {
      actor: user,
      entityType: "TENANT_SETTINGS",
      entityKey: { TenantID: user.tenantId },
      action: "UPDATE",
      reason: "Upload de logo",
    },
    async () => updateTenantBranding(user.tenantId, { logoUrl })
  );

  return NextResponse.json({ ok: true, logoUrl });
});
