import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { createHRDocument, getAllHRDocuments } from "@/lib/db/hr-documents";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

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
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const CATEGORIES = ["Politicas", "Manuales", "Formatos", "Otros"];

export const GET = withErrorHandler(async () => {
  const user = await requireAdmin();
  const docs = await getAllHRDocuments(user.tenantId);
  return NextResponse.json({ ok: true, documents: docs });
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireAdmin();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string)?.trim();
  const category = (formData.get("category") as string)?.trim();

  if (!file) {
    return NextResponse.json(
      { ok: false, error: "No se envió archivo" },
      { status: 400 }
    );
  }

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "El título es obligatorio" },
      { status: 400 }
    );
  }

  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json(
      { ok: false, error: "Categoría inválida" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { ok: false, error: "Archivo demasiado grande (max 10MB)" },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Formato no soportado. Usa PDF, DOCX, XLSX, PPTX, JPG, PNG o WebP",
      },
      { status: 400 }
    );
  }

  const docId = randomUUID();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `hr-documents/${user.tenantSlug}/${docId}-${safeFileName}`;

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

  const fileUrl = `https://${BUCKET}.s3.amazonaws.com/${key}`;

  await createHRDocument({
    NotificationID: `HRDOC#${docId}`,
    TenantID: user.tenantId,
    EventMonth: "DOC",
    Type: "DOCUMENT",
    Status: "ACTIVE",
    DocID: docId,
    Title: title,
    Category: category,
    FileName: file.name,
    FileUrl: fileUrl,
    FileSize: file.size,
    ContentType: file.type,
    UploadedBy: user.email,
    UploadedByName: user.name,
    CreatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, docId, fileUrl }, { status: 201 });
});
