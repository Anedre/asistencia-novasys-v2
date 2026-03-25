"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAdminEmployees() {
  return useQuery({
    queryKey: ["admin", "employees"],
    queryFn: async () => {
      const res = await fetch("/api/admin/employees");
      if (!res.ok) throw new Error("Error fetching employees");
      return res.json() as Promise<{
        ok: boolean;
        employees: Array<{
          employeeId: string;
          email: string;
          fullName: string;
          area: string;
          position: string;
          role: string;
          workMode: string;
          status: string;
        }>;
      }>;
    },
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) throw new Error("Error fetching dashboard");
      return res.json();
    },
    refetchInterval: 60000,
  });
}

export function useAdminAttendance(date?: string) {
  return useQuery({
    queryKey: ["admin", "attendance", date],
    queryFn: async () => {
      const url = date
        ? `/api/admin/attendance?date=${date}`
        : "/api/admin/attendance";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error fetching attendance");
      return res.json();
    },
  });
}

export function useEmployeeDetail(id: string) {
  return useQuery({
    queryKey: ["admin", "employee", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${id}`);
      if (!res.ok) throw new Error("Error fetching employee");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Error fetching profile");
      return res.json();
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { Phone?: string; AvatarUrl?: string }) => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error updating profile");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
