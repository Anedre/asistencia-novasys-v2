"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pin,
  Trash2,
  MessageCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale/es";
import type { Post, ReactionType } from "@/lib/types/post";
import {
  useAddComment,
  useToggleReaction,
  useDeletePost,
} from "@/hooks/use-feed";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "\uD83D\uDC4D",
  love: "\u2764\uFE0F",
  celebrate: "\uD83C\uDF89",
  support: "\uD83E\uDD1D",
  insightful: "\uD83D\uDCA1",
};

const REACTION_LABELS: Record<ReactionType, string> = {
  like: "Me gusta",
  love: "Me encanta",
  celebrate: "Celebrar",
  support: "Apoyar",
  insightful: "Interesante",
};

const VISIBILITY_LABELS: Record<string, string> = {
  company: "Empresa",
  area: "Area",
  private: "Privado",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string;
  name: string;
  size?: "sm" | "md";
}) {
  const sizeClasses = size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-sm";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover shrink-0", sizeClasses)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold shrink-0",
        sizeClasses,
      )}
    >
      {getInitials(name)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PostCard                                                           */
/* ------------------------------------------------------------------ */

interface PostCardProps {
  post: Post;
  currentUserId: string;
  isAdmin: boolean;
}

export function PostCard({ post, currentUserId, isAdmin }: PostCardProps) {
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);

  const addComment = useAddComment(post.PostID);
  const toggleReaction = useToggleReaction(post.PostID);
  const deletePost = useDeletePost();

  const canDelete = post.AuthorID === currentUserId || isAdmin;

  const timeAgo = formatDistanceToNow(new Date(post.CreatedAt), {
    addSuffix: true,
    locale: es,
  });

  /* ---------- Reactions ---------- */
  const reactionCounts: Partial<Record<ReactionType, number>> = {};
  for (const r of post.Reactions ?? []) {
    reactionCounts[r.Type] = (reactionCounts[r.Type] || 0) + 1;
  }

  const myReaction = (post.Reactions ?? []).find(
    (r) => r.EmployeeID === currentUserId,
  );

  const totalReactions = (post.Reactions ?? []).length;

  const handleReaction = (type: ReactionType) => {
    toggleReaction.mutate({ type });
  };

  /* ---------- Comments ---------- */
  const comments = post.Comments ?? [];
  const PREVIEW_COUNT = 2;
  const hasMoreComments = comments.length > PREVIEW_COUNT;
  const visibleComments = showAllComments
    ? comments
    : comments.slice(-PREVIEW_COUNT);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await addComment.mutateAsync({ content: commentText.trim() });
      setCommentText("");
    } catch {
      toast.error("Error al agregar comentario");
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta publicacion?")) return;
    try {
      await deletePost.mutateAsync(post.PostID);
      toast.success("Publicacion eliminada");
    } catch {
      toast.error("Error al eliminar publicacion");
    }
  };

  /* ---------- Render ---------- */
  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow hover:shadow-md",
        post.IsPinned && "border-amber-300/60 bg-amber-50/30 dark:border-amber-700/40 dark:bg-amber-950/20",
      )}
    >
      {/* Pinned indicator banner */}
      {post.IsPinned && (
        <div className="flex items-center gap-1.5 border-b border-amber-200/60 bg-amber-100/50 px-4 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
          <Pin className="h-3 w-3" />
          Publicacion fijada
        </div>
      )}

      <CardContent className={cn("pt-5", post.IsPinned && "pt-4")}>
        {/* ===== Author header ===== */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar src={post.AuthorAvatar} name={post.AuthorName} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{post.AuthorName}</p>
              <div className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                {post.AuthorPosition && (
                  <span className="truncate">{post.AuthorPosition}</span>
                )}
                {post.AuthorPosition && post.AuthorArea && (
                  <span className="text-muted-foreground/50">|</span>
                )}
                {post.AuthorArea && (
                  <span className="truncate">{post.AuthorArea}</span>
                )}
                <span className="text-muted-foreground/50">·</span>
                <time className="whitespace-nowrap">{timeAgo}</time>
                {post.Visibility !== "company" && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                      {VISIBILITY_LABELS[post.Visibility] ?? post.Visibility}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deletePost.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* ===== Content ===== */}
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
          {post.Content}
        </div>

        {/* ===== Image ===== */}
        {post.ImageUrl && (
          <div className="mt-3 overflow-hidden rounded-lg">
            <img
              src={post.ImageUrl}
              alt="Imagen adjunta"
              className="max-h-96 w-full object-cover"
            />
          </div>
        )}

        {/* ===== Reaction summary ===== */}
        {totalReactions > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex -space-x-0.5">
              {(Object.keys(reactionCounts) as ReactionType[])
                .slice(0, 3)
                .map((type) => (
                  <span key={type} className="text-sm">
                    {REACTION_EMOJI[type]}
                  </span>
                ))}
            </span>
            <span>
              {totalReactions} reacci{totalReactions === 1 ? "on" : "ones"}
            </span>
            {comments.length > 0 && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>
                  {comments.length} comentario{comments.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        )}

        {/* ===== Reaction bar ===== */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
          {(Object.keys(REACTION_EMOJI) as ReactionType[]).map((type) => {
            const count = reactionCounts[type] || 0;
            const isActive = myReaction?.Type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleReaction(type)}
                disabled={toggleReaction.isPending}
                title={REACTION_LABELS[type]}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  "hover:bg-muted disabled:opacity-50",
                  isActive
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                <span className="text-sm leading-none">{REACTION_EMOJI[type]}</span>
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowCommentInput((p) => !p)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Comentar
          </button>
        </div>

        {/* ===== Comments section ===== */}
        {(showCommentInput || comments.length > 0) && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {/* "Ver mas" / "Ver menos" */}
            {hasMoreComments && !showAllComments && (
              <button
                type="button"
                onClick={() => setShowAllComments(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ChevronDown className="h-3 w-3" />
                Ver {comments.length - PREVIEW_COUNT} comentario
                {comments.length - PREVIEW_COUNT !== 1 ? "s" : ""} mas
              </button>
            )}

            {showAllComments && hasMoreComments && (
              <button
                type="button"
                onClick={() => setShowAllComments(false)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <ChevronUp className="h-3 w-3" />
                Ocultar comentarios
              </button>
            )}

            {/* Comments list */}
            {visibleComments.map((comment) => {
              const commentTime = formatDistanceToNow(
                new Date(comment.CreatedAt),
                { addSuffix: true, locale: es },
              );
              return (
                <div
                  key={comment.CommentID}
                  className="flex items-start gap-2.5"
                >
                  <Avatar
                    src={comment.AuthorAvatar}
                    name={comment.AuthorName}
                    size="sm"
                  />
                  <div className="flex-1 rounded-xl bg-muted/50 px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold">
                        {comment.AuthorName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {commentTime}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm leading-snug">
                      {comment.Content}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* New comment input */}
            {showCommentInput && (
              <form
                onSubmit={handleComment}
                className="flex items-center gap-2"
              >
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="h-9 rounded-full text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  disabled={!commentText.trim() || addComment.isPending}
                >
                  {addComment.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
