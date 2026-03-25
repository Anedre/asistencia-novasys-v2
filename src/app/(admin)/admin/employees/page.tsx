"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Users, Search } from "lucide-react";
import { useAdminEmployees } from "@/hooks/use-employee";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";

function roleBadge(role: string) {
  return (
    <Badge variant={role === "ADMIN" ? "default" : "outline"}>{role}</Badge>
  );
}

function workModeBadge(mode: string) {
  const styles: Record<string, string> = {
    REMOTE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    ONSITE:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    HYBRID:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  };
  const labels: Record<string, string> = {
    REMOTE: "Remoto",
    ONSITE: "Presencial",
    HYBRID: "Hibrido",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[mode] ?? ""}`}
    >
      {labels[mode] ?? mode}
    </span>
  );
}

function statusBadge(status: string) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
        Activo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
      Inactivo
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export default function EmployeesPage() {
  const { data, isLoading, isError } = useAdminEmployees();
  const [search, setSearch] = useState("");

  const employees = data?.employees ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.area.toLowerCase().includes(q)
    );
  }, [employees, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Directorio de Empleados
        </h1>
        <p className="text-muted-foreground">
          Gestiona los empleados registrados
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Empleados ({filtered.length})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o area..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isError && (
            <p className="text-sm text-destructive">
              Error al cargar los empleados. Intenta de nuevo.
            </p>
          )}

          {isLoading ? (
            <TableSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin resultados"
              description="No se encontraron empleados con los criterios de busqueda."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => (
                  <TableRow key={emp.employeeId}>
                    <TableCell className="font-medium">
                      {emp.fullName}
                    </TableCell>
                    <TableCell>{emp.email}</TableCell>
                    <TableCell>{emp.area}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell>{roleBadge(emp.role)}</TableCell>
                    <TableCell>{workModeBadge(emp.workMode)}</TableCell>
                    <TableCell>{statusBadge(emp.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <Link
                            href={`/admin/employees/${encodeURIComponent(emp.employeeId)}`}
                          />
                        }
                      >
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
