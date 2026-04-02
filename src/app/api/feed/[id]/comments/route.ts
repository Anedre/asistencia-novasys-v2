import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getPostById, addComment, removeComment } from "@/lib/db/posts";
import type { PostComment } from "@/lib/types/post";

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;
    const body = await req.json();

    const { content } = body;
    if (!content) {
      return NextResponse.json({ error: "Contenido requerido" }, { status: 400 });
    }

    const post = await getPostById(id);
    if (!post) return NextResponse.json({ error: "Publicacion no encontrada" }, { status: 404 });

    const comment: PostComment = {
      CommentID: `CMT#${crypto.randomUUID()}`,
      AuthorID: user.employeeId,
      AuthorName: user.name,
      Content: content,
      CreatedAt: new Date().toISOString(),
    };

    await addComment(id, comment);
    return NextResponse.json({ ok: true, comment });
  }
);

export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;

    const url = new URL(req.url);
    const commentId = url.searchParams.get("commentId");
    if (!commentId) {
      return NextResponse.json({ error: "Comentario no especificado" }, { status: 400 });
    }

    const post = await getPostById(id);
    if (!post) return NextResponse.json({ error: "Publicacion no encontrada" }, { status: 404 });

    const commentIndex = (post.Comments ?? []).findIndex((c) => c.CommentID === commentId);
    if (commentIndex === -1) {
      return NextResponse.json({ error: "Comentario no encontrado" }, { status: 404 });
    }

    const comment = post.Comments[commentIndex];
    // Allow comment author, post author, or admin to delete
    if (
      comment.AuthorID !== user.employeeId &&
      post.AuthorID !== user.employeeId &&
      user.role !== "ADMIN"
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await removeComment(id, commentIndex);
    return NextResponse.json({ ok: true });
  }
);
