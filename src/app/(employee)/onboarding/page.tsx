"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMyProfile } from "@/hooks/use-employee";
import { useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera,
  Loader2,
  ArrowRight,
  User,
  CheckCircle,
} from "lucide-react";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { data } = useMyProfile();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const employee = data?.employee;

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Personal info
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [area, setArea] = useState("");
  const [position, setPosition] = useState("");

  // Step 2: Work config
  const [workMode, setWorkMode] = useState("ONSITE");
  const [scheduleType, setScheduleType] = useState("FULL_TIME");

  // Step 3: Avatar (optional)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  async function saveStep1() {
    setLoading(true);
    setError(null);
    try {
      const updates: Record<string, string> = {};
      if (dni) updates.DNI = dni;
      if (birthDate) updates.BirthDate = birthDate;
      if (phone) updates.Phone = phone;
      if (area) updates.Area = area;
      if (position) updates.Position = position;

      if (Object.keys(updates).length === 0) {
        setStep(2);
        return;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      qc.invalidateQueries({ queryKey: ["profile"] });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function saveStep2() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ WorkMode: workMode, ScheduleType: scheduleType }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al guardar");
      }
      qc.invalidateQueries({ queryKey: ["profile"] });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Imagen demasiado grande (max 2MB)");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function finish() {
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      {/* Progress steps */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-8 transition-colors ${
                  step > s ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Card className="w-full max-w-lg">
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Datos Personales</CardTitle>
              <CardDescription>
                Completa tu informacion para usar el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-dni">DNI</Label>
                  <Input
                    id="ob-dni"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="12345678"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-bday">Fecha de Nacimiento</Label>
                  <Input
                    id="ob-bday"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-phone">Telefono</Label>
                <Input
                  id="ob-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+51 999 999 999"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-area">Area</Label>
                  <Input
                    id="ob-area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Desarrollo, Marketing..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-position">Cargo</Label>
                  <Input
                    id="ob-position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Desarrollador, Analista..."
                  />
                </div>
              </div>
              <Button onClick={saveStep1} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Siguiente
              </Button>
            </CardContent>
          </>
        )}

        {/* Step 2: Work Config */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>Configuracion Laboral</CardTitle>
              <CardDescription>
                Define tu modalidad y tipo de jornada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="space-y-2">
                <Label>Modalidad de Trabajo</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { value: "ONSITE", label: "Presencial", desc: "En oficina" },
                    { value: "REMOTE", label: "Remoto", desc: "Desde casa" },
                    { value: "HYBRID", label: "Hibrido", desc: "Mixto" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setWorkMode(opt.value)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        workMode === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Jornada</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      value: "FULL_TIME",
                      label: "Full-Time",
                      desc: "8 horas (09:00 - 18:00)",
                    },
                    {
                      value: "PART_TIME",
                      label: "Part-Time",
                      desc: "4 horas (09:00 - 13:00)",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setScheduleType(opt.value)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        scheduleType === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={saveStep2} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Siguiente
              </Button>
            </CardContent>
          </>
        )}

        {/* Step 3: Avatar */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Foto de Perfil</CardTitle>
              <CardDescription>
                Sube tu foto de perfil (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {avatarPreview || employee?.avatarUrl ? (
                    <img
                      src={avatarPreview || employee?.avatarUrl}
                      alt="Avatar"
                      className="h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Haz clic para subir. JPG, PNG o WebP, max 2MB.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={finish}
                  className="flex-1"
                >
                  Omitir
                </Button>
                <Button onClick={finish} className="flex-1">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Finalizar
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
