"use client";

/**
 * PostCard — the canonical "social feed article" component.
 *
 * Wraps the `.post-card / .post-card-head / .post-card-body / .post-card-foot
 * / .post-card-comments` CSS classes from `nova-design.css`. Use this on the
 * employee Feed and anywhere else a post is rendered.
 *
 * Replaces the previous inline ~225-line PostCard that lived inside
 * `feed/page.tsx`. Keeping the layout in CSS classes (not inline styles)
 * means a designer can iterate spacing/typography without touching JSX.
 */

import { useState } from "react";
import { toast } from "sonner";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { useAddComment, useToggleReaction } from "@/hooks/use-feed";
import type { Post } from "@/lib/types/post";

/* ---------------------------------------------------------------- helpers */

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "Justo ahora";
  if (min < 60) return `Hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ayer";
  if (d < 7) return `Hace ${d} días`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

type PostType = "announcement" | "recognition" | "event" | "post";

/** Derive a tag from heuristic markers in the author/content. */
function derivePostType(p: Post): PostType {
  const c = p.Content.toLowerCase();
  const isHR =
    (p.AuthorPosition ?? "").toLowerCase().includes("rrhh") ||
    (p.AuthorArea ?? "").toLowerCase().includes("rrhh");
  if (isHR && (c.includes("anuncio") || c.includes("bienvenida") || c.includes("comunicado")))
    return "announcement";
  if (
    c.includes("kudos") ||
    c.includes("reconocimiento") ||
    c.includes("felicitaciones") ||
    c.includes("🚀")
  )
    return "recognition";
  if (c.includes("aniversario") || c.includes("evento") || c.includes("cumple"))
    return "event";
  return "post";
}

const TYPE_LABEL: Record<PostType, { label: string; cls: string }> = {
  announcement: { label: "Anuncio", cls: "accent" },
  recognition: { label: "Reconocimiento", cls: "warn" },
  event: { label: "Evento", cls: "accent" },
  post: { label: "", cls: "" },
};

/* ---------------------------------------------------------------- sub-bits */

function PostCardHeader({ post, type }: { post: Post; type: PostType }) {
  const typeMeta = TYPE_LABEL[type];
  return (
    <div className="post-card-head">
      <NovaAvatar
        name={post.AuthorName}
        image={post.AuthorAvatar}
        size={40}
        variant={type === "announcement" ? "accent" : "plain"}
      />
      <div className="post-card-head-meta">
        <div className="post-card-head-top">
          <span className="post-card-author">{post.AuthorName}</span>
          {typeMeta.label && <span className={`type-tag ${typeMeta.cls}`}>{typeMeta.label}</span>}
          {post.IsPinned && <span className="type-tag accent">📌 Fijado</span>}
        </div>
        <div className="post-card-time">
          <span>{timeAgo(post.CreatedAt)}</span>
          {post.AuthorArea && <span className="area-chip">{post.AuthorArea}</span>}
        </div>
      </div>
      <button
        type="button"
        className="btn ghost btn-sm"
        aria-label="Más opciones (próximamente)"
        disabled
        title="Opciones de post próximamente"
        style={{ opacity: 0.4, cursor: "not-allowed" }}
      >
        <IconSvg d={Icons.more} size={14} />
      </button>
    </div>
  );
}

function PostCardBody({ post }: { post: Post }) {
  const lines = post.Content.split("\n");
  const title = lines[0].trim().slice(0, 120);
  const body = lines.slice(1).join("\n").trim();

  return (
    <div className="post-card-body">
      {body ? (
        <>
          <h3 className="post-card-title">{title}</h3>
          <p className="post-card-content">{body}</p>
        </>
      ) : (
        <p className="post-card-content no-title">{title}</p>
      )}

      {post.ImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.ImageUrl}
          alt=""
          className="post-card-image"
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}

function PostCardComments({ post }: { post: Post }) {
  const addComment = useAddComment(post.PostID);
  const [text, setText] = useState("");

  async function submit() {
    const t = text.trim();
    if (!t) return;
    try {
      await addComment.mutateAsync({ content: t });
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo comentar");
    }
  }

  return (
    <div className="post-card-comments">
      {post.Comments.length === 0 ? (
        <div className="post-card-comment-empty">Sé el primero en comentar.</div>
      ) : (
        post.Comments.map((c) => (
          <div key={c.CommentID} className="post-card-comment-row">
            <NovaAvatar name={c.AuthorName} size={28} variant="plain" />
            <div className="post-card-comment-body">
              <div className="post-card-comment-meta">
                <span className="post-card-comment-author">{c.AuthorName}</span>
                <span className="post-card-comment-time">{timeAgo(c.CreatedAt)}</span>
              </div>
              <div className="post-card-comment-content">{c.Content}</div>
            </div>
          </div>
        ))
      )}

      <div className="post-card-composer">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un comentario…"
          rows={1}
          aria-label="Escribir comentario"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="btn primary btn-sm"
          onClick={submit}
          disabled={!text.trim() || addComment.isPending}
        >
          {addComment.isPending ? "…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- main */

export interface PostCardProps {
  post: Post;
  /** EmployeeID of the viewer, used to color their own reaction. */
  currentUserId?: string;
}

export function PostCard({ post, currentUserId }: PostCardProps) {
  const toggle = useToggleReaction(post.PostID);
  const myReaction = post.Reactions.find((r) => r.EmployeeID === currentUserId);
  const type = derivePostType(post);
  const [commentsOpen, setCommentsOpen] = useState(false);

  async function react(t: string) {
    try {
      await toggle.mutateAsync({ type: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reaccionar");
    }
  }

  return (
    <article className="panel post-card">
      <PostCardHeader post={post} type={type} />
      <PostCardBody post={post} />

      <div className="post-card-foot">
        <button
          type="button"
          className={`btn ghost btn-sm${post.Reactions.length === 0 ? " zero-count" : ""}`}
          onClick={() => react("like")}
          disabled={toggle.isPending}
          style={myReaction ? { color: "var(--danger)" } : undefined}
          aria-pressed={!!myReaction}
          aria-label={`${post.Reactions.length} ${post.Reactions.length === 1 ? "reacción" : "reacciones"}`}
        >
          <IconSvg d={Icons.heart} size={14} />
          <span className="count-label">{post.Reactions.length}</span>
        </button>
        <button
          type="button"
          className={`btn ghost btn-sm${post.Comments.length === 0 ? " zero-count" : ""}`}
          onClick={() => setCommentsOpen((v) => !v)}
          style={commentsOpen ? { color: "var(--accent-strong)" } : undefined}
          aria-expanded={commentsOpen}
          title={commentsOpen ? "Ocultar comentarios" : "Ver comentarios"}
          aria-label={`${post.Comments.length} ${post.Comments.length === 1 ? "comentario" : "comentarios"}`}
        >
          <IconSvg d={Icons.chat} size={14} />
          <span className="count-label">{post.Comments.length}</span>
        </button>
        <button
          type="button"
          className="btn ghost btn-sm share-action"
          disabled
          title="Compartir próximamente"
          style={{ opacity: 0.5, cursor: "not-allowed" }}
          aria-label="Compartir (próximamente)"
        >
          <IconSvg d={Icons.share} size={14} />
        </button>
      </div>

      {commentsOpen && <PostCardComments post={post} />}
    </article>
  );
}
