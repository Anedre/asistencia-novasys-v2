"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChatSession, AIChatMessage } from "@/lib/types/chat";

export function useChatSessions() {
  return useQuery<{ sessions: ChatSession[] }>({
    queryKey: ["chat-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/chat/sessions");
      if (!res.ok) throw new Error("Error al cargar sesiones de chat");
      return res.json();
    },
  });
}

export function useCreateChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al crear sesión");
      }
      return res.json() as Promise<{ ok: boolean; session: ChatSession }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-sessions"] }),
  });
}

export function useDeleteChatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al eliminar sesión");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-sessions"] }),
  });
}

export function useSendMessage(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Error al enviar mensaje");
      }
      return res.json() as Promise<{ message: AIChatMessage }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });
}
