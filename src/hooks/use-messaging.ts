"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChatChannel, ChatMessage } from "@/lib/types/channel";

export function useChannels() {
  return useQuery<{ channels: ChatChannel[] }>({
    queryKey: ["messaging-channels"],
    queryFn: async () => {
      const res = await fetch("/api/messages/channels");
      if (!res.ok) throw new Error("Error al cargar canales");
      return res.json();
    },
    refetchInterval: 10000,
  });
}

export function useChannel(channelId: string | null) {
  return useQuery<{ channel: ChatChannel }>({
    queryKey: ["messaging-channels", channelId],
    queryFn: async () => {
      const res = await fetch(
        `/api/messages/channels/${encodeURIComponent(channelId!)}`
      );
      if (!res.ok) throw new Error("Error al cargar canal");
      return res.json();
    },
    enabled: !!channelId,
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name?: string;
      type: "direct" | "group" | "area";
      members: { id: string; name: string }[];
    }) => {
      const res = await fetch("/api/messages/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al crear canal");
      }
      return res.json() as Promise<{ ok: boolean; channel: ChatChannel }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messaging-channels"] }),
  });
}

export function useMessages(channelId: string | null) {
  return useQuery<{ messages: ChatMessage[] }>({
    queryKey: ["messaging-messages", channelId],
    queryFn: async () => {
      const res = await fetch(
        `/api/messages/channels/${encodeURIComponent(channelId!)}/messages`
      );
      if (!res.ok) throw new Error("Error al cargar mensajes");
      return res.json();
    },
    enabled: !!channelId,
    refetchInterval: 5000,
  });
}

export function useSendMessage(channelId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { content: string; type?: "text" | "image" | "file" }) => {
      if (!channelId) throw new Error("No hay canal seleccionado");
      const res = await fetch(
        `/api/messages/channels/${encodeURIComponent(channelId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al enviar mensaje");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messaging-messages", channelId] });
      qc.invalidateQueries({ queryKey: ["messaging-channels"] });
    },
  });
}
