"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Default cadence for admin dashboards / detail views.
 *
 * `refetchInterval: 30s` keeps "active employees, presence, hourly chart,
 * pending requests, recent activity" feeling near-realtime without paying
 * a request every render. Mutations (approve, regularize, manual mark)
 * also invalidate these keys so they refresh immediately on actions.
 *
 * `refetchOnWindowFocus` makes the page snap to fresh data when an admin
 * comes back from another tab/app — the most common "I missed something"
 * moment.
 */
const ADMIN_REALTIME = {
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
} as const;

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
    ...ADMIN_REALTIME,
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
    ...ADMIN_REALTIME,
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
    ...ADMIN_REALTIME,
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
    ...ADMIN_REALTIME,
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

export function useUpdateEmployeeProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Record<string, string>;
    }) => {
      const res = await fetch(`/api/admin/employees/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al actualizar empleado");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin", "employees"] });
      qc.invalidateQueries({ queryKey: ["admin", "employee", variables.id] });
    },
  });
}

export function useUpdateEmployeeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await fetch(`/api/admin/employees/${encodeURIComponent(id)}`, {
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
      const res = await fetch(`/api/admin/employees/${encodeURIComponent(id)}`, {
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
