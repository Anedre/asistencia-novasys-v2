"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Post } from "@/lib/types/post";

export function useFeed() {
  return useQuery<{ posts: Post[] }>({
    queryKey: ["feed"],
    queryFn: async () => {
      const res = await fetch("/api/feed");
      if (!res.ok) throw new Error("Error al cargar el feed");
      return res.json();
    },
    refetchInterval: 15000,
  });
}

export function usePost(postId: string) {
  return useQuery<{ post: Post }>({
    queryKey: ["feed", postId],
    queryFn: async () => {
      const res = await fetch(`/api/feed/${encodeURIComponent(postId)}`);
      if (!res.ok) throw new Error("Error al cargar la publicacion");
      return res.json();
    },
    enabled: !!postId,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      content: string;
      visibility: string;
      targetArea?: string;
      imageUrl?: string;
    }) => {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al crear publicacion");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/feed/${encodeURIComponent(postId)}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al eliminar publicacion");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed"] }),
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { content: string }) => {
      const res = await fetch(`/api/feed/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al comentar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["feed", postId] });
    },
  });
}

export function useToggleReaction(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: string }) => {
      const res = await fetch(`/api/feed/${encodeURIComponent(postId)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al reaccionar");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["feed", postId] });
    },
  });
}
