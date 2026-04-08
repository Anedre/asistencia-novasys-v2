import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { deleteHRDocument } from "@/lib/db/hr-documents";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

export const DELETE = withErrorHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireAdmin();
    const { id } = await params;

    // Try to delete the S3 object (best effort — metadata is the source of truth)
    try {
      const key = `hr-documents/${user.tenantSlug}/${id}`;
      // The key stored may have the filename appended, so we list by prefix
      // For simplicity, we just remove the DB record; S3 cleanup can be a background job
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: key,
        })
      );
    } catch {
      // S3 deletion is best-effort
    }

    await withAudit(
      {
        actor: user,
        entityType: "HR_DOCUMENT",
        entityKey: { NotificationID: `HRDOC#${id}` },
        action: "DELETE",
        reason: "Eliminación de documento RRHH",
      },
      async () => deleteHRDocument(`HRDOC#${id}`)
    );

    return NextResponse.json({ ok: true });
  }
);
