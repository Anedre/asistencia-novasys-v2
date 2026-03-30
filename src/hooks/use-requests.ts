"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApprovalRequest, CreateRequestInput, ReviewRequestInput } from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function useMyRequests() {
  return useQuery({
    queryKey: ["requests", "mine"],
    queryFn: () =>
      fetchJson<{ ok: boolean; requests: ApprovalRequest[] }>("/api/requests"),
  });
}

export function usePendingRequests() {
  return useQuery({
    queryKey: ["requests", "pending"],
    queryFn: () =>
      fetchJson<{ ok: boolean; requests: ApprovalRequest[] }>(
        "/api/admin/approvals"
      ),
    refetchInterval: 30000,
  });
}

export function useApprovalHistory(status: "APPROVED" | "REJECTED") {
  return useQuery({
    queryKey: ["requests", "history", status],
    queryFn: () =>
      fetchJson<{ ok: boolean; requests: ApprovalRequest[] }>(
        `/api/admin/approvals?status=${status}`
      ),
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRequestInput) => {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al crear solicitud");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

export function useReviewRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      ...data
    }: ReviewRequestInput & { requestId: string }) => {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al procesar solicitud");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cancelar");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}
