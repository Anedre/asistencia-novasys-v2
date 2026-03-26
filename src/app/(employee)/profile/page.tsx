"use client";

import { useState, useEffect, useRef } from "react";
import { useMyProfile, useUpdateProfile } from "@/hooks/use-employee";
import { useQueryClient } from "@tanstack/react-query";
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
import dynamic from "next/dynamic";
import { Camera, Loader2, MapPin } from "lucide-react";
import type { EmployeeLocation } from "@/lib/types/employee";

const LocationPicker = dynamic(
  () => import("@/components/shared/location-picker").then((m) => ({ default: m.LocationPicker })),
  { ssr: false }
);
const LocationDisplay = dynamic(
  () => import("@/components/shared/location-display").then((m) => ({ default: m.LocationDisplay })),
  { ssr: false }
);

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "-"}</span>
    </div>
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
  const [dni, setDni] = useState("");
  const [area, setArea] = useState("");
  const [position, setPosition] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [location, setLocation] = useState<EmployeeLocation | null>(null);
  const [locationDirty, setLocationDirty] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const employee = data?.employee;

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ type: "error", message: "Imagen demasiado grande (max 2MB)" });
      return;
    }

    setUploading(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir imagen");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setFeedback({ type: "success", message: "Foto de perfil actualizada" });
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Error al subir" });
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (employee) {
      setPhone(employee.phone ?? "");
      setAvatarUrl(employee.avatarUrl ?? "");
      setDni(employee.dni ?? "");
      setArea(employee.area ?? "");
      setPosition(employee.position ?? "");
      setWorkMode(employee.workMode ?? "ONSITE");
      setBirthDate(employee.birthDate ?? "");
      setLocation(employee.location ?? null);
      setLocationDirty(false);
    }
  }, [employee]);

  const handleSave = async () => {
    setFeedback(null);
    try {
      const updates: Record<string, string | undefined> = {};
      if (phone !== (employee?.phone ?? "")) updates.Phone = phone || undefined;
      if (avatarUrl !== (employee?.avatarUrl ?? ""))
        updates.AvatarUrl = avatarUrl || undefined;
      if (dni !== (employee?.dni ?? "")) updates.DNI = dni || undefined;
      if (area !== (employee?.area ?? "")) updates.Area = area || undefined;
      if (position !== (employee?.position ?? ""))
        updates.Position = position || undefined;
      if (workMode !== (employee?.workMode ?? ""))
        updates.WorkMode = workMode || undefined;
      if (birthDate !== (employee?.birthDate ?? ""))
        updates.BirthDate = birthDate || undefined;

      if (Object.keys(updates).length === 0) {
        setFeedback({ type: "success", message: "No hay cambios por guardar." });
        return;
      }

      await updateProfile.mutateAsync(updates);
      setFeedback({
        type: "success",
        message: "Perfil actualizado correctamente.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Error al actualizar el perfil.",
      });
    }
  };

  const workModeLabels: Record<string, string> = {
    REMOTE: "Remoto",
    ONSITE: "Presencial",
    HYBRID: "Hibrido",
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
        <>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Informacion Personal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative group">
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
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="text-lg font-semibold">{employee.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {employee.position}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {employee.schedule?.type === "PART_TIME" ? "Part-Time (4h)" : "Full-Time (8h)"}
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
                value={workModeLabels[employee.workMode] ?? employee.workMode}
              />
              <InfoRow label="Fecha de Nacimiento" value={employee.birthDate} />
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
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="12345678"
                />
              </div>

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
                <Label htmlFor="area">Area</Label>
                <Input
                  id="area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Tecnologia"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Cargo</Label>
                <Input
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Desarrollador Senior"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workMode">Modalidad</Label>
                <select
                  id="workMode"
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ONSITE">Presencial</option>
                  <option value="REMOTE">Remoto</option>
                  <option value="HYBRID">Hibrido</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>

              <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                <p className="text-sm font-medium">Foto de Perfil</p>
                <p className="text-xs text-muted-foreground">
                  Pasa el mouse sobre tu foto arriba para cambiarla. Formatos: JPG, PNG, WebP. Max 2MB.
                </p>
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

        {/* Location Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Ubicacion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {employee.location && !locationDirty ? (
              <>
                <LocationDisplay location={employee.location} />
                <Button
                  variant="outline"
                  onClick={() => setLocationDirty(true)}
                >
                  Cambiar ubicacion
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Haz clic en el mapa o busca una direccion para establecer tu ubicacion.
                </p>
                <LocationPicker
                  value={location}
                  onChange={(loc) => {
                    setLocation(loc);
                    setLocationDirty(true);
                  }}
                />
                {locationDirty && location && (
                  <Button
                    onClick={async () => {
                      setFeedback(null);
                      try {
                        await updateProfile.mutateAsync({ Location: location });
                        setLocationDirty(false);
                        setFeedback({
                          type: "success",
                          message: "Ubicacion guardada correctamente.",
                        });
                      } catch (err) {
                        setFeedback({
                          type: "error",
                          message:
                            err instanceof Error
                              ? err.message
                              : "Error al guardar la ubicacion.",
                        });
                      }
                    }}
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? "Guardando..." : "Guardar Ubicacion"}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </>
      ) : null}
    </div>
  );
}
