"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserX,
  Loader2,
} from "lucide-react";
import {
  useAdminEmployees,
  useUpdateEmployeeRole,
  useDeactivateEmployee,
} from "@/hooks/use-employee";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { InviteEmployeeDialog } from "@/components/admin/invite-employee-dialog";

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

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  variant = "default",
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeesPage() {
  const { data, isLoading, isError } = useAdminEmployees(false);
  const updateRole = useUpdateEmployeeRole();
  const deactivate = useDeactivateEmployee();

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    empId: string;
    empName: string;
    newRole: "ADMIN" | "EMPLOYEE";
  }>({ open: false, empId: "", empName: "", newRole: "ADMIN" });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    empId: string;
    empName: string;
  }>({ open: false, empId: "", empName: "" });

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const allEmployees = data?.employees ?? [];

  const employees = useMemo(() => {
    let list = allEmployees;
    if (!showInactive) {
      list = list.filter((e) => e.status === "ACTIVE");
    }
    return list;
  }, [allEmployees, showInactive]);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.area.toLowerCase().includes(q) ||
        e.dni?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const activeCount = allEmployees.filter((e) => e.status === "ACTIVE").length;
  const inactiveCount = allEmployees.filter(
    (e) => e.status === "INACTIVE"
  ).length;

  async function handleRoleChange() {
    setFeedback(null);
    try {
      await updateRole.mutateAsync({
        id: roleDialog.empId,
        role: roleDialog.newRole,
      });
      setFeedback({
        type: "success",
        text: `${roleDialog.empName} ahora es ${roleDialog.newRole}`,
      });
      setRoleDialog((d) => ({ ...d, open: false }));
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error al cambiar rol",
      });
    }
  }

  async function handleDeactivate() {
    setFeedback(null);
    try {
      await deactivate.mutateAsync(deleteDialog.empId);
      setFeedback({
        type: "success",
        text: `${deleteDialog.empName} ha sido desactivado`,
      });
      setDeleteDialog((d) => ({ ...d, open: false }));
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error al desactivar",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Directorio de Empleados
          </h1>
          <p className="text-muted-foreground">
            Gestiona los empleados registrados
          </p>
        </div>
        <InviteEmployeeDialog />
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-md p-3 text-sm ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Empleados ({filtered.length})
              <span className="text-xs font-normal text-muted-foreground">
                ({activeCount} activos{inactiveCount > 0 && `, ${inactiveCount} inactivos`})
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded"
                />
                Mostrar inactivos
              </label>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, email, DNI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Modalidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-24">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((emp) => (
                    <TableRow key={emp.employeeId}>
                      <TableCell className="font-medium">
                        {emp.fullName}
                      </TableCell>
                      <TableCell className="text-xs">{emp.email}</TableCell>
                      <TableCell>{emp.dni || "—"}</TableCell>
                      <TableCell>{emp.area}</TableCell>
                      <TableCell>{emp.position}</TableCell>
                      <TableCell>{roleBadge(emp.role)}</TableCell>
                      <TableCell>{workModeBadge(emp.workMode)}</TableCell>
                      <TableCell>{statusBadge(emp.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/admin/employees/${encodeURIComponent(emp.employeeId)}`}
                            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
                          >
                            Ver
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="sm" />}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {emp.role === "EMPLOYEE" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRoleDialog({
                                      open: true,
                                      empId: emp.employeeId,
                                      empName: emp.fullName,
                                      newRole: "ADMIN",
                                    })
                                  }
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Hacer Administrador
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setRoleDialog({
                                      open: true,
                                      empId: emp.employeeId,
                                      empName: emp.fullName,
                                      newRole: "EMPLOYEE",
                                    })
                                  }
                                >
                                  <ShieldOff className="mr-2 h-4 w-4" />
                                  Quitar Admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {emp.status === "ACTIVE" && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    setDeleteDialog({
                                      open: true,
                                      empId: emp.employeeId,
                                      empName: emp.fullName,
                                    })
                                  }
                                >
                                  <UserX className="mr-2 h-4 w-4" />
                                  Desactivar Cuenta
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role change dialog */}
      <ConfirmDialog
        open={roleDialog.open}
        onOpenChange={(open) => setRoleDialog((d) => ({ ...d, open }))}
        title="Cambiar Rol"
        description={`¿Estas seguro de que deseas cambiar el rol de ${roleDialog.empName} a ${roleDialog.newRole}?`}
        confirmText={
          roleDialog.newRole === "ADMIN"
            ? "Hacer Administrador"
            : "Quitar Admin"
        }
        loading={updateRole.isPending}
        onConfirm={handleRoleChange}
      />

      {/* Deactivate dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((d) => ({ ...d, open }))}
        title="Desactivar Empleado"
        description={`¿Estas seguro de que deseas desactivar la cuenta de ${deleteDialog.empName}? El empleado no podra acceder al sistema.`}
        confirmText="Desactivar"
        variant="destructive"
        loading={deactivate.isPending}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}
