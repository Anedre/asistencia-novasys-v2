import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-helpers";
import { withErrorHandler } from "@/lib/utils/errors";
import { getPostById, addReaction, removeReaction } from "@/lib/db/posts";
import type { ReactionType } from "@/lib/types/post";

const VALID_REACTIONS: ReactionType[] = ["like", "love", "celebrate", "support", "insightful"];

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await params;
    const body = await req.json();

    const { type } = body as { type: ReactionType };
    if (!type || !VALID_REACTIONS.includes(type)) {
      return NextResponse.json({ error: "Tipo de reaccion invalido" }, { status: 400 });
    }

    const post = await getPostById(id);
    if (!post) return NextResponse.json({ error: "Publicacion no encontrada" }, { status: 404 });

    const existingReaction = (post.Reactions ?? []).find(
      (r) => r.EmployeeID === user.employeeId
    );

    if (existingReaction) {
      // Remove existing reaction first
      await removeReaction(id, user.employeeId);

      // If same type, just remove (toggle off)
      if (existingReaction.Type === type) {
        return NextResponse.json({ ok: true, action: "removed" });
      }
    }

    // Add new reaction
    await addReaction(id, {
      EmployeeID: user.employeeId,
      EmployeeName: user.name,
      Type: type,
    });

    return NextResponse.json({ ok: true, action: existingReaction ? "replaced" : "added" });
  }
);
