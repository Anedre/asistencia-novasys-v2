import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getAllHRDocuments } from "@/lib/db/hr-documents";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const docs = await getAllHRDocuments(user.tenantId);

  const documents = docs.map((d) => ({
    id: d.DocID,
    title: d.Title,
    category: d.Category,
    fileName: d.FileName,
    fileUrl: d.FileUrl,
    fileSize: d.FileSize,
    contentType: d.ContentType,
    uploadedBy: d.UploadedByName,
    createdAt: d.CreatedAt,
  }));

  return NextResponse.json(documents);
});
