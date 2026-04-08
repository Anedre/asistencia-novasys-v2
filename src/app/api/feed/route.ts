import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getPostsByTenant, createPost } from "@/lib/db/posts";
import { getAllActiveEmployees } from "@/lib/db/employees";
import { putNotification } from "@/lib/db/notifications";
import type { Post } from "@/lib/types/post";

export const GET = withErrorHandler(async () => {
  const user = await requireSession();
  const posts = await getPostsByTenant(user.tenantId);

  // Filter by visibility
  const filtered = posts.filter((p) => {
    if (p.Visibility === "company") return true;
    if (p.Visibility === "area" && p.TargetArea === user.area) return true;
    if (p.Visibility === "private" && p.AuthorID === user.employeeId) return true;
    return false;
  });

  // Sort: pinned first, then by date (already sorted by date from query)
  const sorted = filtered.sort((a, b) => {
    if (a.IsPinned && !b.IsPinned) return -1;
    if (!a.IsPinned && b.IsPinned) return 1;
    return 0; // preserve date order from query
  });

  return NextResponse.json({ posts: sorted });
});

export const POST = withErrorHandler(async (req: Request) => {
  const user = await requireSession();
  const body = await req.json();

  const { content, visibility, targetArea, imageUrl, embed } = body;

  if (!content || !visibility) {
    return NextResponse.json(
      { error: "Contenido y visibilidad son requeridos" },
      { status: 400 }
    );
  }

  if (visibility === "area" && !targetArea && !user.area) {
    return NextResponse.json(
      { error: "Se requiere un area para esta visibilidad" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const post: Post = {
    PostID: `POST#${crypto.randomUUID()}`,
    TenantID: user.tenantId,
    AuthorID: user.employeeId,
    AuthorName: user.name,
    AuthorArea: user.area || undefined,
    Content: content,
    ImageUrl: imageUrl || undefined,
    Visibility: visibility,
    TargetArea: visibility === "area" ? (targetArea || user.area) : undefined,
    Comments: [],
    Reactions: [],
    IsPinned: false,
    ...(embed && { Embed: embed }),
    CreatedAt: now,
    UpdatedAt: now,
  };

  await createPost(post);

  // Fan out notifications to everyone who should see the post. Respect
  // visibility rules — same filter the GET handler applies when reading.
  try {
    const employees = await getAllActiveEmployees(user.tenantId);
    const recipients = employees
      .filter((e) => e.EmployeeID !== user.employeeId)
      .filter((e) => {
        if (post.Visibility === "company") return true;
        if (post.Visibility === "area")
          return e.Area === (post.TargetArea ?? user.area);
        return false; // private → only author sees it
      });

    const preview = content.slice(0, 140);
    await Promise.allSettled(
      recipients.map((e) =>
        putNotification({
          recipientId: e.EmployeeID,
          createdAt: now,
          notificationId: `NOTIF#${Date.now()}#${crypto.randomUUID().slice(0, 8)}`,
          type: "NEW_POST",
          title: `${user.name} publicó un post`,
          message: preview,
          referenceId: post.PostID,
          referenceType: "POST",
          read: false,
          soundType: "post",
          ttl: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
        })
      )
    );
  } catch (err) {
    console.error("[feed] Failed to fan out notifications", err);
  }

  return NextResponse.json({ ok: true, post });
});
