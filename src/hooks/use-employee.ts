"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAdminEmployees(activeOnly = true) {
  return useQuery({
    queryKey: ["admin", "employees", activeOnly],
    queryFn: async () => {
      const url = activeOnly
        ? "/api/admin/employees"
        : "/api/admin/employees?active=false";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error fetching employees");
      return res.json() as Promise<{
        ok: boolean;
        employees: Array<{
          employeeId: string;
          email: string;
          fullName: string;
          firstName: string;
          lastName: string;
          dni: string;
          area: string;
          position: string;
          role: string;
          workMode: string;
          status: string;
          phone: string | null;
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
      const res = await fetch(`/api/admin/employees/${encodeURIComponent(id)}`);
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
    mutationFn: async (data: {
      Phone?: string;
      AvatarUrl?: string;
      DNI?: string;
      Area?: string;
      Position?: string;
      WorkMode?: string;
      BirthDate?: string;
      Location?: { lat: number; lng: number; address: string; formattedAddress: string };
      Schedule?: { startTime: string; endTime: string; breakMinutes: number; type: string };
      ScheduleType?: string;
    }) => {
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

export function useUpdateEmployeeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error updating role");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "employees"] }),
  });
}

export function useDeactivateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error deactivating employee");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "employees"] }),
  });
}
