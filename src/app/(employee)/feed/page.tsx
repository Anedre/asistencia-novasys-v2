"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Newspaper,
  Globe,
  Users,
  Lock,
  Megaphone,
  Send,
} from "lucide-react";
import { useFeed, useCreatePost } from "@/hooks/use-feed";
import { PostCard } from "@/components/feed/post-card";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PostVisibility } from "@/lib/types/post";

/* ------------------------------------------------------------------ */
/*  Visibility chip options                                            */
/* ------------------------------------------------------------------ */

const VISIBILITY_OPTIONS: {
  value: PostVisibility;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "company", label: "Empresa", icon: Globe },
  { value: "area", label: "Mi Area", icon: Users },
  { value: "private", label: "Solo yo", icon: Lock },
];

/* ------------------------------------------------------------------ */
/*  Helper: avatar                                                     */
/* ------------------------------------------------------------------ */

function ComposerAvatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-10 w-10 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function FeedPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useFeed();
  const createPost = useCreatePost();

  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("company");

  const posts = data?.posts ?? [];
  const currentUserId =
    (session?.user as { employeeId?: string })?.employeeId ?? "";
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";
  const userName =
    (session?.user as { name?: string })?.name ?? "Usuario";
  const userAvatar =
    (session?.user as { image?: string })?.image ?? undefined;

  /* Separate pinned vs regular for ordering */
  const pinnedPosts = posts.filter((p) => p.IsPinned);
  const regularPosts = posts.filter((p) => !p.IsPinned);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await createPost.mutateAsync({
        content: content.trim(),
        visibility,
      });
      setContent("");
      setVisibility("company");
      toast.success("Publicacion creada");
    } catch {
      toast.error("Error al crear publicacion");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Social</h1>
        <p className="text-sm text-muted-foreground">
          Comparte novedades con tu equipo
        </p>
      </div>

      {/* ===== Post composer ===== */}
      <Card className="overflow-hidden">
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <ComposerAvatar name={userName} src={userAvatar} />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="¿Que esta pasando? Comparte con tu equipo..."
                className={cn(
                  "flex-1 min-h-[80px] resize-none rounded-xl border-0 bg-muted/50 px-4 py-3 text-sm",
                  "placeholder:text-muted-foreground/60",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background",
                  "transition-colors",
                )}
                rows={3}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {/* Visibility pills */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">
                  Visible para:
                </span>
                {VISIBILITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = visibility === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVisibility(opt.value)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={!content.trim() || createPost.isPending}
                className="rounded-full px-6 gap-2"
              >
                {createPost.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publicar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ===== Feed ===== */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-7 w-14 rounded-full" />
                  <Skeleton className="h-7 w-14 rounded-full" />
                  <Skeleton className="h-7 w-14 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        /* Empty state */
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Megaphone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">
              Aun no hay publicaciones
            </h3>
            <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
              Se el primero en compartir una novedad, reconocimiento o idea con
              tu equipo. Tu voz importa.
            </p>
            <Button
              variant="outline"
              className="mt-5 rounded-full gap-2"
              onClick={() => {
                const textarea = document.querySelector("textarea");
                textarea?.focus();
              }}
            >
              <Newspaper className="h-4 w-4" />
              Escribir publicacion
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Pinned posts first */}
          {pinnedPosts.map((post) => (
            <PostCard
              key={post.PostID}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
          {/* Regular posts */}
          {regularPosts.map((post) => (
            <PostCard
              key={post.PostID}
              post={post}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
