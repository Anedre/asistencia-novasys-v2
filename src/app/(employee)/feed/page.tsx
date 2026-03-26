"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Newspaper } from "lucide-react";
import { useFeed, useCreatePost } from "@/hooks/use-feed";
import { PostCard } from "@/components/shared/post-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

export default function FeedPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useFeed();
  const createPost = useCreatePost();

  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("company");

  const posts = data?.posts ?? [];
  const currentUserId = (session?.user as { employeeId?: string })?.employeeId ?? "";
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Social</h1>
        <p className="text-muted-foreground">
          Comparte novedades con tu equipo
        </p>
      </div>

      {/* Create Post Box */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="¿Que estas pensando?"
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
            />
            <div className="flex items-center justify-between">
              <Select value={visibility} onValueChange={(v) => v && setVisibility(v)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Empresa</SelectItem>
                  <SelectItem value="area">Mi Area</SelectItem>
                  <SelectItem value="private">Solo yo</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!content.trim() || createPost.isPending}>
                {createPost.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Publicar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Feed */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Aun no hay publicaciones"
          description="¡Se el primero en compartir algo!"
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
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
