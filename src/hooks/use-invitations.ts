"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Invitation } from "@/lib/types/invitation";

interface InvitationsResponse {
  invitations: Invitation[];
}

interface CreateInviteResponse {
  ok: boolean;
  invitation: Invitation;
  inviteLink: string;
}

export function useInvitations() {
  return useQuery<InvitationsResponse>({
    queryKey: ["invitations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/invitations");
      if (!res.ok) throw new Error("Error al cargar invitaciones");
      return res.json();
    },
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateInviteResponse,
    Error,
    {
      email: string;
      fullName?: string;
      area?: string;
      position?: string;
      role?: "EMPLOYEE" | "ADMIN";
    }
  >({
    mutationFn: async (data) => {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear invitacion");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/admin/invitations/${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al revocar invitacion");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}
