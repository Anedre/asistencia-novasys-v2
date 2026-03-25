import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { updateEmployeeProfile } from "@/lib/db/employees";
import { withErrorHandler } from "@/lib/utils/errors";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.CUSTOM_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  ...((process.env.CUSTOM_ACCESS_KEY_ID && process.env.CUSTOM_SECRET_ACCESS_KEY) && {
    credentials: {
      accessKeyId: process.env.CUSTOM_ACCESS_KEY_ID,
      secretAccessKey: process.env.CUSTOM_SECRET_ACCESS_KEY,
    },
  }),
});

const BUCKET = process.env.REPORT_BUCKET || "novasys-v2-reports";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export const POST = withErrorHandler(async (req: Request) => {
  const session = await requireSession();

  const formData = await req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return NextResponse.json({ ok: false, error: "No se envió archivo" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "Imagen demasiado grande (max 2MB)" }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "Formato no soportado. Usa JPG, PNG o WebP" }, { status: 400 });
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `avatars/${session.employeeId.replace("EMP#", "")}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
    CacheControl: "max-age=86400",
  }));

  const avatarUrl = `https://${BUCKET}.s3.amazonaws.com/${key}`;

  await updateEmployeeProfile(session.employeeId, { AvatarUrl: avatarUrl });

  return NextResponse.json({ ok: true, avatarUrl });
});
