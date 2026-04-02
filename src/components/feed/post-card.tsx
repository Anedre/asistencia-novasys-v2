"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Heart,
  MessageCircle,
  Share2,
  Pin,
  Trash2,
  MoreHorizontal,
  Globe,
  Users,
  Lock,
  Send,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale/es";
import type { Post, PostComment, ReactionType } from "@/lib/types/post";
import {
  useAddComment,
  useToggleReaction,
  useDeletePost,
} from "@/hooks/use-feed";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FeedEmbed } from "@/components/feed/feed-embed";

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

const VISIBILITY_CONFIG: Record<
  string,
  { label: string; icon: typeof Globe }
> = {
  company: { label: "Empresa", icon: Globe },
  area: { label: "Area", icon: Users },
  private: { label: "Privado", icon: Lock },
};

const PREVIEW_COUNT = 2;

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

/* ------------------------------------------------------------------ */
/*  PostCard                                                           */
/* ------------------------------------------------------------------ */

interface PostCardProps {
  post: Post;
  currentUserId: string;
  isAdmin: boolean;
  onDelete?: (postId: string) => void;
  onReaction?: (postId: string, type: ReactionType) => void;
  onComment?: (postId: string, content: string) => void;
  onDeleteComment?: (postId: string, commentIndex: number) => void;
}

export function PostCard({
  post,
  currentUserId,
  isAdmin,
  onDelete,
  onReaction,
  onComment,
  onDeleteComment,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showReactionSummary, setShowReactionSummary] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const reactionPickerTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const reactionSummaryTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const addComment = useAddComment(post.PostID);
  const toggleReaction = useToggleReaction(post.PostID);
  const deletePost = useDeletePost();

  const canDelete = post.AuthorID === currentUserId || isAdmin;

  const timeAgo = formatDistanceToNow(new Date(post.CreatedAt), {
    addSuffix: false,
    locale: es,
  });

  /* ---------- Close more menu on outside click ---------- */
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  /* ---------- Reactions ---------- */
  const reactionCounts: Partial<Record<ReactionType, number>> = {};
  const reactionUsers: Partial<Record<ReactionType, string[]>> = {};
  for (const r of post.Reactions ?? []) {
    reactionCounts[r.Type] = (reactionCounts[r.Type] || 0) + 1;
    if (!reactionUsers[r.Type]) reactionUsers[r.Type] = [];
    reactionUsers[r.Type]!.push(r.EmployeeName);
  }

  const myReaction = (post.Reactions ?? []).find(
    (r) => r.EmployeeID === currentUserId
  );

  const totalReactions = (post.Reactions ?? []).length;
  const topReactionTypes = (Object.keys(reactionCounts) as ReactionType[])
    .sort((a, b) => (reactionCounts[b] || 0) - (reactionCounts[a] || 0))
    .slice(0, 3);

  const handleReaction = useCallback(
    (type: ReactionType) => {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 300);
      setShowReactionPicker(false);
      toggleReaction.mutate({ type });
      onReaction?.(post.PostID, type);
    },
    [toggleReaction, onReaction, post.PostID]
  );

  const handleLikeClick = useCallback(() => {
    handleReaction(myReaction ? myReaction.Type : "like");
  }, [handleReaction, myReaction]);

  /* ---------- Reaction picker hover ---------- */
  const openReactionPicker = useCallback(() => {
    if (reactionPickerTimeout.current)
      clearTimeout(reactionPickerTimeout.current);
    setShowReactionPicker(true);
  }, []);

  const closeReactionPicker = useCallback(() => {
    reactionPickerTimeout.current = setTimeout(
      () => setShowReactionPicker(false),
      300
    );
  }, []);

  /* ---------- Reaction summary hover ---------- */
  const openReactionSummary = useCallback(() => {
    if (reactionSummaryTimeout.current)
      clearTimeout(reactionSummaryTimeout.current);
    setShowReactionSummary(true);
  }, []);

  const closeReactionSummary = useCallback(() => {
    reactionSummaryTimeout.current = setTimeout(
      () => setShowReactionSummary(false),
      200
    );
  }, []);

  /* ---------- Comments ---------- */
  const comments = post.Comments ?? [];
  const hasMoreComments = comments.length > PREVIEW_COUNT;
  const visibleComments = showAllComments
    ? comments
    : comments.slice(-PREVIEW_COUNT);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await addComment.mutateAsync({ content: commentText.trim() });
      onComment?.(post.PostID, commentText.trim());
      setCommentText("");
    } catch {
      toast.error("Error al agregar comentario");
    }
  };

  /* ---------- Share ---------- */
  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/feed/${post.PostID}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Enlace copiado al portapapeles"),
      () => toast.error("No se pudo copiar el enlace")
    );
  }, [post.PostID]);

  /* ---------- Delete ---------- */
  const handleDelete = async () => {
    try {
      await deletePost.mutateAsync(post.PostID);
      onDelete?.(post.PostID);
      toast.success("Publicacion eliminada");
      setShowDeleteConfirm(false);
    } catch {
      toast.error("Error al eliminar publicacion");
    }
  };

  /* ---------- Visibility ---------- */
  const visConfig = VISIBILITY_CONFIG[post.Visibility] ?? VISIBILITY_CONFIG.company;
  const VisIcon = visConfig.icon;

  /* ================================================================== */
  /*  Render                                                             */
  /* ================================================================== */
  return (
    <>
      <article
        className={cn(
          "group/post relative rounded-xl border bg-card text-card-foreground",
          "transition-shadow duration-200 hover:shadow-md",
          post.IsPinned &&
            "border-amber-300/60 bg-amber-50/20 dark:border-amber-700/40 dark:bg-amber-950/10"
        )}
      >
        {/* ---------- Pinned banner ---------- */}
        {post.IsPinned && (
          <div className="flex items-center gap-1.5 border-b border-amber-200/60 bg-amber-100/40 px-4 py-1 text-xs font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
            <Pin className="h-3 w-3" />
            Publicacion fijada
          </div>
        )}

        <div className="px-4 pt-3 pb-1">
          {/* ===== Twitter-style layout: avatar left + content right ===== */}
          <div className="flex gap-3">
            {/* --- Avatar column --- */}
            <div className="shrink-0 pt-0.5">
              <Avatar size="lg" className="size-10">
                {post.AuthorAvatar ? (
                  <AvatarImage src={post.AuthorAvatar} alt={post.AuthorName} />
                ) : null}
                <AvatarFallback>{getInitials(post.AuthorName)}</AvatarFallback>
              </Avatar>
            </div>

            {/* --- Content column --- */}
            <div className="min-w-0 flex-1">
              {/* -- Header row -- */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-1 text-sm leading-5 min-w-0">
                  <span className="font-bold truncate">{post.AuthorName}</span>
                  {post.AuthorPosition && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {post.AuthorPosition}
                      </span>
                    </>
                  )}
                  {post.AuthorArea && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {post.AuthorArea}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground/40">·</span>
                  <time className="whitespace-nowrap text-xs text-muted-foreground">
                    hace {timeAgo}
                  </time>

                  {/* Visibility badge */}
                  {post.Visibility !== "company" && (
                    <Badge
                      variant="secondary"
                      className="ml-1 gap-1 px-1.5 py-0 text-[10px] font-medium"
                    >
                      <VisIcon className="h-2.5 w-2.5" />
                      {visConfig.label}
                    </Badge>
                  )}
                </div>

                {/* More menu */}
                {canDelete && (
                  <div className="relative shrink-0" ref={moreMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowMoreMenu((p) => !p)}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
                        "hover:bg-muted hover:text-foreground",
                        "opacity-0 group-hover/post:opacity-100 focus:opacity-100"
                      )}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {showMoreMenu && (
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMoreMenu(false);
                            setShowDeleteConfirm(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar publicacion
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* -- Content text -- */}
              <div className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                {post.Content}
              </div>

              {/* -- Embed (interactive data card) -- */}
              {post.Embed && <FeedEmbed embed={post.Embed} />}

              {/* -- Image attachment -- */}
              {post.ImageUrl && (
                <div className="mt-3 overflow-hidden rounded-xl border">
                  <img
                    src={post.ImageUrl}
                    alt="Imagen adjunta"
                    className="max-h-80 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  />
                </div>
              )}

              {/* -- Reaction summary (LinkedIn style) -- */}
              {totalReactions > 0 && (
                <div className="mt-2.5 relative">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
                    onMouseEnter={openReactionSummary}
                    onMouseLeave={closeReactionSummary}
                  >
                    <span className="flex -space-x-0.5">
                      {topReactionTypes.map((type) => (
                        <span
                          key={type}
                          className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-card text-xs ring-1 ring-card"
                        >
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
                          {comments.length} comentario
                          {comments.length !== 1 ? "s" : ""}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Reaction summary popover */}
                  {showReactionSummary && (
                    <div
                      className="absolute left-0 bottom-full z-30 mb-1.5 min-w-[200px] max-w-[280px] rounded-lg border bg-popover p-3 shadow-lg animate-in fade-in zoom-in-95 duration-150"
                      onMouseEnter={openReactionSummary}
                      onMouseLeave={closeReactionSummary}
                    >
                      <div className="space-y-2">
                        {(Object.keys(reactionUsers) as ReactionType[]).map(
                          (type) => (
                            <div key={type} className="flex items-start gap-2">
                              <span className="text-sm shrink-0">
                                {REACTION_EMOJI[type]}
                              </span>
                              <p className="text-xs text-muted-foreground leading-snug">
                                {reactionUsers[type]!.slice(0, 5).join(", ")}
                                {reactionUsers[type]!.length > 5 &&
                                  ` y ${reactionUsers[type]!.length - 5} mas`}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== Action bar (X-style) ===== */}
              <div className="mt-2 -mx-2 flex items-center justify-between border-t border-border/50 pt-1">
                {/* 1) Comment toggle */}
                <button
                  type="button"
                  onClick={() => setShowComments((p) => !p)}
                  className={cn(
                    "group/btn flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] transition-colors",
                    "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                    showComments && "text-primary"
                  )}
                >
                  <MessageCircle className="size-[18px] transition-transform group-hover/btn:scale-110" />
                  <span className="tabular-nums">{comments.length > 0 ? comments.length : ""}</span>
                  <span className="hidden sm:inline text-xs">Comentar</span>
                </button>

                {/* 2) Like / reaction picker */}
                <div
                  className="relative"
                  onMouseEnter={openReactionPicker}
                  onMouseLeave={closeReactionPicker}
                >
                  <button
                    type="button"
                    onClick={handleLikeClick}
                    disabled={toggleReaction.isPending}
                    className={cn(
                      "group/btn flex items-center gap-1.5 rounded-full px-3 py-2 text-xs transition-colors",
                      "hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50",
                      myReaction
                        ? "text-rose-500"
                        : "text-muted-foreground"
                    )}
                  >
                    <Heart
                      className={cn(
                        "size-[18px] transition-transform duration-200",
                        myReaction && "fill-current",
                        likeAnimating && "animate-ping",
                        "group-hover/btn:scale-110"
                      )}
                    />
                    <span className="tabular-nums">{totalReactions > 0 ? totalReactions : ""}</span>
                    <span className="hidden sm:inline text-xs">
                      {myReaction ? REACTION_LABELS[myReaction.Type] : "Me gusta"}
                    </span>
                  </button>

                  {/* Reaction picker popover */}
                  {showReactionPicker && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 bottom-full z-30 mb-2 animate-in fade-in zoom-in-95 duration-150"
                      onMouseEnter={openReactionPicker}
                      onMouseLeave={closeReactionPicker}
                    >
                      <div className="flex items-center gap-0.5 rounded-full border bg-popover px-1.5 py-1 shadow-lg">
                        {(Object.keys(REACTION_EMOJI) as ReactionType[]).map(
                          (type) => {
                            const isActive = myReaction?.Type === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                title={REACTION_LABELS[type]}
                                onClick={() => handleReaction(type)}
                                disabled={toggleReaction.isPending}
                                className={cn(
                                  "flex items-center justify-center rounded-full p-1.5 text-lg transition-transform duration-150",
                                  "hover:scale-125 hover:bg-muted",
                                  isActive && "bg-muted scale-110"
                                )}
                              >
                                {REACTION_EMOJI[type]}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3) Share */}
                <button
                  type="button"
                  onClick={handleShare}
                  className={cn(
                    "group/btn flex items-center gap-1.5 rounded-full px-3 py-2 text-xs transition-colors",
                    "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500"
                  )}
                >
                  <Share2 className="size-[18px] transition-transform group-hover/btn:scale-110" />
                  <span className="hidden sm:inline text-xs">Compartir</span>
                </button>

                {/* 4) Pin toggle (admin only) */}
                {isAdmin && (
                  <button
                    type="button"
                    className={cn(
                      "group/btn flex items-center gap-1.5 rounded-full px-3 py-2 text-xs transition-colors",
                      "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500",
                      post.IsPinned && "text-amber-500"
                    )}
                    title={
                      post.IsPinned ? "Desfijar publicacion" : "Fijar publicacion"
                    }
                  >
                    <Pin
                      className={cn(
                        "h-4 w-4 transition-transform group-hover/btn:scale-110",
                        post.IsPinned && "fill-current"
                      )}
                    />
                  </button>
                )}
              </div>

              {/* ===== Comments section ===== */}
              {showComments && (
                <div className="mt-1 space-y-3 border-t pt-3 animate-in slide-in-from-top-1 fade-in duration-200">
                  {/* Expand older comments */}
                  {hasMoreComments && !showAllComments && (
                    <button
                      type="button"
                      onClick={() => setShowAllComments(true)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline transition-colors"
                    >
                      <ChevronDown className="h-3 w-3" />
                      Ver {comments.length - PREVIEW_COUNT} comentario
                      {comments.length - PREVIEW_COUNT !== 1 ? "s" : ""}{" "}
                      anterior{comments.length - PREVIEW_COUNT !== 1 ? "es" : ""}
                    </button>
                  )}

                  {showAllComments && hasMoreComments && (
                    <button
                      type="button"
                      onClick={() => setShowAllComments(false)}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline transition-colors"
                    >
                      <ChevronDown className="h-3 w-3 rotate-180" />
                      Ocultar comentarios
                    </button>
                  )}

                  {/* Comment list */}
                  <div className="space-y-2.5">
                    {visibleComments.map((comment, idx) => {
                      const commentTime = formatDistanceToNow(
                        new Date(comment.CreatedAt),
                        { addSuffix: false, locale: es }
                      );
                      const commentIdx = showAllComments
                        ? idx
                        : comments.length - PREVIEW_COUNT + idx;
                      const canDeleteComment =
                        comment.AuthorID === currentUserId || isAdmin;

                      return (
                        <div
                          key={comment.CommentID}
                          className="group/comment flex items-start gap-2 animate-in fade-in duration-200"
                        >
                          <Avatar size="sm" className="size-7 shrink-0 mt-0.5">
                            {comment.AuthorAvatar ? (
                              <AvatarImage
                                src={comment.AuthorAvatar}
                                alt={comment.AuthorName}
                              />
                            ) : null}
                            <AvatarFallback className="text-[10px]">
                              {getInitials(comment.AuthorName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="inline-block rounded-2xl bg-muted/60 px-3 py-1.5 max-w-full">
                              <span className="text-xs font-semibold">
                                {comment.AuthorName}
                              </span>
                              <p className="text-sm leading-snug mt-0.5">
                                {comment.Content}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 px-1">
                              <span className="text-[10px] text-muted-foreground">
                                hace {commentTime}
                              </span>
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onDeleteComment?.(post.PostID, commentIdx)
                                  }
                                  className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Comment input (LinkedIn style) */}
                  <form
                    onSubmit={handleComment}
                    className="flex items-center gap-2"
                  >
                    <Avatar size="sm" className="size-7 shrink-0">
                      <AvatarFallback className="text-[10px]">Tu</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 items-center gap-1 rounded-full border bg-muted/30 px-3 py-1 focus-within:ring-1 focus-within:ring-primary/40 transition-shadow">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Escribe un comentario..."
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                      />
                      <button
                        type="submit"
                        disabled={!commentText.trim() || addComment.isPending}
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                          "text-muted-foreground hover:text-primary disabled:opacity-30"
                        )}
                      >
                        {addComment.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* ===== Delete confirmation dialog ===== */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar publicacion</DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer. ¿Estas seguro de que deseas
              eliminar esta publicacion?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePost.isPending}
            >
              {deletePost.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
