"use client";

import { useState, useEffect } from "react";
import { useMyProfile, useUpdateProfile } from "@/hooks/use-employee";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "-"}</span>
    </div>
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

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { data, isLoading, isError } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const employee = data?.employee;

  useEffect(() => {
    if (employee) {
      setPhone(employee.phone ?? "");
      setAvatarUrl(employee.avatarUrl ?? "");
    }
  }, [employee]);

  const handleSave = async () => {
    setFeedback(null);
    try {
      await updateProfile.mutateAsync({
        Phone: phone || undefined,
        AvatarUrl: avatarUrl || undefined,
      });
      setFeedback({ type: "success", message: "Perfil actualizado correctamente." });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Error al actualizar el perfil.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Visualiza y edita tu informacion personal
        </p>
      </div>

      {isError && (
        <p className="text-sm text-destructive">
          Error al cargar tu perfil. Intenta de nuevo.
        </p>
      )}

      {isLoading ? (
        <ProfileSkeleton />
      ) : employee ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Informacion Personal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                {employee.avatarUrl ? (
                  <img
                    src={employee.avatarUrl}
                    alt={employee.fullName}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
                    {employee.firstName?.[0] ?? ""}
                    {employee.lastName?.[0] ?? ""}
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold">{employee.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {employee.position}
                  </p>
                </div>
              </div>
              <InfoRow label="Email" value={employee.email} />
              <InfoRow label="DNI" value={employee.dni} />
              <InfoRow label="Area" value={employee.area} />
              <InfoRow label="Cargo" value={employee.position} />
              <InfoRow
                label="Rol"
                value={
                  <Badge
                    variant={
                      employee.role === "ADMIN" ? "default" : "outline"
                    }
                  >
                    {employee.role}
                  </Badge>
                }
              />
              <InfoRow
                label="Modalidad"
                value={workModeBadge(employee.workMode)}
              />
              <InfoRow label="Fecha de Ingreso" value={employee.hireDate} />
              <InfoRow
                label="Horario"
                value={
                  employee.schedule
                    ? `${employee.schedule.startTime} - ${employee.schedule.endTime}`
                    : "-"
                }
              />
            </CardContent>
          </Card>

          {/* Edit Card */}
          <Card>
            <CardHeader>
              <CardTitle>Editar Datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+51 999 999 999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatarUrl">URL de Avatar</Label>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://ejemplo.com/avatar.jpg"
                />
              </div>

              {feedback && (
                <p
                  className={`text-sm ${
                    feedback.type === "success"
                      ? "text-green-600 dark:text-green-400"
                      : "text-destructive"
                  }`}
                >
                  {feedback.message}
                </p>
              )}

              <Button
                onClick={handleSave}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
