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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import {
  Camera,
  Loader2,
  MapPin,
  User,
  Briefcase,
  Clock,
  Phone,
  Mail,
  Calendar,
  Building2,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Monitor,
  Coffee,
} from "lucide-react";
import type { EmployeeLocation } from "@/lib/types/employee";

const LocationPicker = dynamic(
  () =>
    import("@/components/shared/location-picker").then((m) => ({
      default: m.LocationPicker,
    })),
  { ssr: false }
);
const LocationDisplay = dynamic(
  () =>
    import("@/components/shared/location-display").then((m) => ({
      default: m.LocationDisplay,
    })),
  { ssr: false }
);

/* ------------------------------------------------------------------ */
/*  Skeleton                                                          */
/* ------------------------------------------------------------------ */
function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-28 w-28 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-[480px] w-full rounded-xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field row (read-only display)                                     */
/* ------------------------------------------------------------------ */
function FieldRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{value ?? "-"}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */
export default function ProfilePage() {
  const { data, isLoading, isError } = useMyProfile();
  const updateProfile = useUpdateProfile();

  /* -- editable state -- */
  const [phone, setPhone] = useState("");
  const [dni, setDni] = useState("");
  const [area, setArea] = useState("");
  const [position, setPosition] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [scheduleType, setScheduleType] = useState("FULL_TIME");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState("60");

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

  /* -- sync server -> local state -- */
  useEffect(() => {
    if (employee) {
      setPhone(employee.phone ?? "");
      setDni(employee.dni ?? "");
      setArea(employee.area ?? "");
      setPosition(employee.position ?? "");
      setWorkMode(employee.workMode ?? "ONSITE");
      setBirthDate(employee.birthDate ?? "");
      setScheduleType(employee.schedule?.type ?? "FULL_TIME");
      setStartTime(employee.schedule?.startTime ?? "09:00");
      setEndTime(employee.schedule?.endTime ?? "18:00");
      setBreakMinutes(String(employee.schedule?.breakMinutes ?? 60));
      setLocation(employee.location ?? null);
      setLocationDirty(false);
    }
  }, [employee]);

  /* -- avatar upload -- */
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
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir imagen");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setFeedback({ type: "success", message: "Foto de perfil actualizada" });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Error al subir",
      });
    } finally {
      setUploading(false);
    }
  }

  /* -- save handler -- */
  const handleSave = async () => {
    setFeedback(null);
    try {
      const updates: Record<string, unknown> = {};

      if (phone !== (employee?.phone ?? "")) updates.Phone = phone || undefined;
      if (dni !== (employee?.dni ?? "")) updates.DNI = dni || undefined;
      if (area !== (employee?.area ?? "")) updates.Area = area || undefined;
      if (position !== (employee?.position ?? ""))
        updates.Position = position || undefined;
      if (workMode !== (employee?.workMode ?? ""))
        updates.WorkMode = workMode || undefined;
      if (birthDate !== (employee?.birthDate ?? ""))
        updates.BirthDate = birthDate || undefined;

      /* Schedule changes */
      const scheduleChanged =
        startTime !== (employee?.schedule?.startTime ?? "09:00") ||
        endTime !== (employee?.schedule?.endTime ?? "18:00") ||
        Number(breakMinutes) !== (employee?.schedule?.breakMinutes ?? 60) ||
        scheduleType !== (employee?.schedule?.type ?? "FULL_TIME");

      if (scheduleChanged) {
        updates.Schedule = {
          startTime,
          endTime,
          breakMinutes: Number(breakMinutes),
          type: scheduleType,
        };
        updates.ScheduleType = scheduleType;
      }

      if (Object.keys(updates).length === 0) {
        setFeedback({ type: "success", message: "No hay cambios por guardar." });
        return;
      }

      await updateProfile.mutateAsync(updates as Parameters<typeof updateProfile.mutateAsync>[0]);
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

  /* -- save location -- */
  const handleSaveLocation = async () => {
    setFeedback(null);
    try {
      await updateProfile.mutateAsync({ Location: location as EmployeeLocation });
      setLocationDirty(false);
      setFeedback({ type: "success", message: "Ubicacion guardada correctamente." });
    } catch (err) {
      setFeedback({
        type: "error",
        message:
          err instanceof Error ? err.message : "Error al guardar la ubicacion.",
      });
    }
  };

  const workModeLabels: Record<string, string> = {
    REMOTE: "Remoto",
    ONSITE: "Presencial",
    HYBRID: "Hibrido",
  };

  const workModeBadgeClass: Record<string, string> = {
    REMOTE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    ONSITE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    HYBRID: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-muted-foreground">
          Visualiza y edita tu informacion personal
        </p>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Error al cargar tu perfil. Intenta de nuevo.
        </div>
      )}

      {isLoading ? (
        <ProfileSkeleton />
      ) : employee ? (
        <>
          {/* ======================================================= */}
          {/*  HERO — avatar + name                                   */}
          {/* ======================================================= */}
          <Card className="overflow-hidden">
            {/* Gradient band */}
            <div className="h-32 bg-gradient-to-r from-primary/80 via-primary/60 to-primary/30" />

            <div className="relative px-6 pb-6">
              {/* Avatar — overlapping the gradient */}
              <div className="relative -mt-16 mb-4 flex flex-col items-center gap-4 sm:flex-row sm:items-end">
                <div className="group relative">
                  {employee.avatarUrl ? (
                    <img
                      src={employee.avatarUrl}
                      alt={employee.fullName}
                      className="h-28 w-28 rounded-full border-4 border-background object-cover shadow-lg"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-background bg-primary text-3xl font-bold text-primary-foreground shadow-lg">
                      {employee.firstName?.[0] ?? ""}
                      {employee.lastName?.[0] ?? ""}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
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

                <div className="text-center sm:text-left">
                  <h2 className="text-2xl font-bold">{employee.fullName}</h2>
                  <p className="text-muted-foreground">{employee.position}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <Badge
                      variant={employee.role === "ADMIN" ? "default" : "outline"}
                      className="gap-1"
                    >
                      <Shield className="h-3 w-3" />
                      {employee.role}
                    </Badge>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        workModeBadgeClass[employee.workMode] ?? ""
                      }`}
                    >
                      <Monitor className="h-3 w-3" />
                      {workModeLabels[employee.workMode] ?? employee.workMode}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {employee.schedule?.type === "PART_TIME"
                        ? "Part-Time"
                        : "Full-Time"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick info row */}
              <Separator className="my-4" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">
                    {employee.email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {employee.area || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {employee.phone || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {employee.schedule
                      ? `${employee.schedule.startTime} - ${employee.schedule.endTime}`
                      : "-"}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* ======================================================= */}
          {/*  TABS                                                    */}
          {/* ======================================================= */}
          <Tabs defaultValue="personal">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="personal" className="gap-1.5">
                <User className="h-4 w-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="work" className="gap-1.5">
                <Briefcase className="h-4 w-4" />
                Trabajo
              </TabsTrigger>
              <TabsTrigger value="location" className="gap-1.5">
                <MapPin className="h-4 w-4" />
                Ubicacion
              </TabsTrigger>
            </TabsList>

            {/* ---------------------------------------------------- */}
            {/*  TAB: Personal Info                                   */}
            {/* ---------------------------------------------------- */}
            <TabsContent value="personal">
              <div className="grid gap-6 pt-4 md:grid-cols-2">
                {/* Read-only display */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-4 w-4 text-primary" />
                      Datos Personales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <FieldRow
                      icon={User}
                      label="Nombre completo"
                      value={employee.fullName}
                    />
                    <FieldRow icon={Mail} label="Email" value={employee.email} />
                    <FieldRow
                      icon={CreditCard}
                      label="DNI"
                      value={employee.dni}
                    />
                    <FieldRow
                      icon={Phone}
                      label="Telefono"
                      value={employee.phone}
                    />
                    <FieldRow
                      icon={Calendar}
                      label="Fecha de Nacimiento"
                      value={employee.birthDate}
                    />
                    <FieldRow
                      icon={Calendar}
                      label="Fecha de Ingreso"
                      value={employee.hireDate}
                    />
                  </CardContent>
                </Card>

                {/* Editable form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-4 w-4 text-primary" />
                      Editar Datos Personales
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="dni">DNI</Label>
                      <Input
                        id="dni"
                        value={dni}
                        onChange={(e) => setDni(e.target.value)}
                        placeholder="12345678"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Telefono</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+51 999 999 999"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
                      <Input
                        id="birthDate"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                      />
                    </div>
                    <div className="rounded-lg border border-dashed p-3 text-center">
                      <p className="text-xs text-muted-foreground">
                        Pasa el mouse sobre tu foto de perfil para cambiarla.
                        <br />
                        Formatos: JPG, PNG, WebP. Max 2 MB.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---------------------------------------------------- */}
            {/*  TAB: Work Info                                       */}
            {/* ---------------------------------------------------- */}
            <TabsContent value="work">
              <div className="grid gap-6 pt-4 md:grid-cols-2">
                {/* Work fields */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Briefcase className="h-4 w-4 text-primary" />
                      Informacion Laboral
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="area">Area</Label>
                      <Input
                        id="area"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="Tecnologia"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="position">Cargo</Label>
                      <Input
                        id="position"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="Desarrollador Senior"
                      />
                    </div>
                    <div className="space-y-1.5">
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
                    <div className="space-y-1.5">
                      <Label htmlFor="scheduleType">Tipo de Jornada</Label>
                      <select
                        id="scheduleType"
                        value={scheduleType}
                        onChange={(e) => setScheduleType(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="FULL_TIME">Full-Time (8h)</option>
                        <option value="PART_TIME">Part-Time (4h)</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>

                {/* Schedule editing */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-4 w-4 text-primary" />
                      Horario
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Horario Actual</p>
                          <p className="text-xs text-muted-foreground">
                            {employee.schedule
                              ? `${employee.schedule.startTime} - ${employee.schedule.endTime}`
                              : "Sin horario definido"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="startTime">Hora de Entrada</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="endTime">Hora de Salida</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="breakMinutes" className="flex items-center gap-1.5">
                        <Coffee className="h-3.5 w-3.5 text-muted-foreground" />
                        Minutos de Descanso
                      </Label>
                      <Input
                        id="breakMinutes"
                        type="number"
                        min="0"
                        max="120"
                        value={breakMinutes}
                        onChange={(e) => setBreakMinutes(e.target.value)}
                        placeholder="60"
                      />
                      <p className="text-xs text-muted-foreground">
                        Tiempo de descanso incluido en la jornada (almuerzo, break, etc.)
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ---------------------------------------------------- */}
            {/*  TAB: Location                                        */}
            {/* ---------------------------------------------------- */}
            <TabsContent value="location">
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4 text-primary" />
                    Mi Ubicacion
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {employee.location && !locationDirty ? (
                    <>
                      <LocationDisplay location={employee.location} />
                      <Button
                        variant="outline"
                        onClick={() => setLocationDirty(true)}
                        className="gap-2"
                      >
                        <MapPin className="h-4 w-4" />
                        Cambiar ubicacion
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Haz clic en el mapa o busca una direccion para establecer
                        tu ubicacion.
                      </p>
                      <LocationPicker
                        value={location}
                        onChange={(loc: EmployeeLocation) => {
                          setLocation(loc);
                          setLocationDirty(true);
                        }}
                      />
                      {locationDirty && location && (
                        <Button
                          onClick={handleSaveLocation}
                          disabled={updateProfile.isPending}
                          className="gap-2"
                        >
                          {updateProfile.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {updateProfile.isPending
                            ? "Guardando..."
                            : "Guardar Ubicacion"}
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* ======================================================= */}
          {/*  FEEDBACK + SAVE                                        */}
          {/* ======================================================= */}
          {feedback && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                feedback.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                  : "border-destructive/50 bg-destructive/10 text-destructive"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {feedback.message}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updateProfile.isPending}
              size="lg"
              className="gap-2"
            >
              {updateProfile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {updateProfile.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
