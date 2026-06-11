import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getPostById, updatePost, deletePost } from "@/lib/db/posts";
import { canViewPost } from "@/lib/utils/post-visibility";

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;
    const post = await getPostById(id);
    if (!post || !canViewPost(post, user)) {
      return NextResponse.json({ error: "Publicacion no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ post });
  }
);

export const PUT = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;
    const body = await req.json();

    const post = await getPostById(id);
    // Same tenant/visibility gate as GET: a cross-tenant caller who guesses a
    // post id must get 404 here, not fall through to the author check below
    // (whose 403 would confirm the post exists).
    if (!post || !canViewPost(post, user)) {
      return NextResponse.json({ error: "Publicacion no encontrada" }, { status: 404 });
    }
    if (post.AuthorID !== user.employeeId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await updatePost(id, body);
    return NextResponse.json({ ok: true });
  }
);

export const DELETE = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;

    const post = await getPostById(id);
    if (!post) return NextResponse.json({ error: "Publicacion no encontrada" }, { status: 404 });
    if (post.AuthorID !== user.employeeId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await deletePost(id);
    return NextResponse.json({ ok: true });
  }
);
