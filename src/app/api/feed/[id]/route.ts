import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getPostById, updatePost, deletePost } from "@/lib/db/posts";
import type { Post } from "@/lib/types/post";

type SessionUser = { employeeId: string; tenantId?: string; area?: string; role?: string };

/**
 * Mirrors the LIST endpoint's visibility filter so direct-by-id access can't
 * leak posts a user wouldn't otherwise see (private posts, area posts they
 * don't belong to, or posts in another tenant).
 */
function canViewPost(post: Post, user: SessionUser): boolean {
  if (user.tenantId && post.TenantID && post.TenantID !== user.tenantId) return false;
  if (post.AuthorID === user.employeeId) return true;
  if (post.Visibility === "company") return true;
  if (post.Visibility === "area" && post.TargetArea === user.area) return true;
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
  return false;
}

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = (await requireSession()) as SessionUser;
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
    if (!post) return NextResponse.json({ error: "Publicacion no encontrada" }, { status: 404 });
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
