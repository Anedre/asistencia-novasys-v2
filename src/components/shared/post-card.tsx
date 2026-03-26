"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pin, Trash2, MessageCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale/es";
import type { Post, ReactionType } from "@/lib/types/post";
import { useAddComment, useToggleReaction, useDeletePost } from "@/hooks/use-feed";
import { toast } from "sonner";

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

interface PostCardProps {
  post: Post;
  currentUserId: string;
  isAdmin: boolean;
}

export function PostCard({ post, currentUserId, isAdmin }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const addComment = useAddComment(post.PostID);
  const toggleReaction = useToggleReaction(post.PostID);
  const deletePost = useDeletePost();

  const canDelete = post.AuthorID === currentUserId || isAdmin;
  const initials = post.AuthorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const timeAgo = formatDistanceToNow(new Date(post.CreatedAt), {
    addSuffix: true,
    locale: es,
  });

  // Count reactions by type
  const reactionCounts: Partial<Record<ReactionType, number>> = {};
  for (const r of post.Reactions ?? []) {
    reactionCounts[r.Type] = (reactionCounts[r.Type] || 0) + 1;
  }

  const myReaction = (post.Reactions ?? []).find(
    (r) => r.EmployeeID === currentUserId
  );

  const handleReaction = (type: ReactionType) => {
    toggleReaction.mutate({ type });
  };

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

  const comments = post.Comments ?? [];

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Author header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {post.AuthorAvatar ? (
              <img
                src={post.AuthorAvatar}
                alt={post.AuthorName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{post.AuthorName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {post.AuthorPosition && <span>{post.AuthorPosition}</span>}
                {post.AuthorPosition && post.AuthorArea && <span>·</span>}
                {post.AuthorArea && <span>{post.AuthorArea}</span>}
                <span>·</span>
                <span>{timeAgo}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {post.IsPinned && (
              <div className="flex items-center gap-1 text-xs text-amber-600" title="Fijado">
                <Pin className="h-3 w-3" />
                <span>Fijado</span>
              </div>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={deletePost.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mt-3 whitespace-pre-wrap text-sm">{post.Content}</div>

        {/* Image */}
        {post.ImageUrl && (
          <div className="mt-3">
            <img
              src={post.ImageUrl}
              alt="Imagen adjunta"
              className="max-h-96 w-full rounded-lg object-cover"
            />
          </div>
        )}

        {/* Reaction bar */}
        <div className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3">
          {(Object.keys(REACTION_EMOJI) as ReactionType[]).map((type) => {
            const count = reactionCounts[type] || 0;
            const isActive = myReaction?.Type === type;
            return (
              <Button
                key={type}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => handleReaction(type)}
                disabled={toggleReaction.isPending}
                title={REACTION_LABELS[type]}
              >
                <span>{REACTION_EMOJI[type]}</span>
                {count > 0 && <span>{count}</span>}
              </Button>
            );
          })}

          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs text-muted-foreground"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageCircle className="h-4 w-4" />
              {comments.length > 0
                ? `${comments.length} comentario${comments.length !== 1 ? "s" : ""}`
                : "Comentar"}
            </Button>
          </div>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 space-y-3 border-t pt-3">
            {comments.map((comment) => {
              const commentInitials = comment.AuthorName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const commentTime = formatDistanceToNow(new Date(comment.CreatedAt), {
                addSuffix: true,
                locale: es,
              });

              return (
                <div key={comment.CommentID} className="flex items-start gap-2">
                  {comment.AuthorAvatar ? (
                    <img
                      src={comment.AuthorAvatar}
                      alt={comment.AuthorName}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {commentInitials}
                    </div>
                  )}
                  <div className="flex-1 rounded-lg bg-muted/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{comment.AuthorName}</span>
                      <span className="text-[10px] text-muted-foreground">{commentTime}</span>
                    </div>
                    <p className="text-sm">{comment.Content}</p>
                  </div>
                </div>
              );
            })}

            {/* New comment input */}
            <form onSubmit={handleComment} className="flex items-center gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Escribe un comentario..."
                className="text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!commentText.trim() || addComment.isPending}
              >
                {addComment.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Enviar"
                )}
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
