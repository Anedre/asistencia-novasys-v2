"use client";

/**
 * Post-registration onboarding wizard for new tenant admins.
 *
 * 5 steps:
 *   1. Branding   — primary color, optional logo URL
 *   2. Schedule   — default work hours + timezone + scheduleType
 *   3. Holidays   — preloaded Peru template, editable
 *   4. Invite     — bulk invite first employees (creates invitations + emails)
 *   5. Done       — marks settings.onboardingCompleted=true and goes to dashboard
 *
 * Guard: if the session is missing, redirects to /login.
 *        If settings.onboardingCompleted is already true, redirects to /admin/dashboard.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  CheckCircle2,
  Sparkles,
  Palette,
  Clock,
  CalendarDays,
  Users,
  AlertTriangle,
  Building2,
  Plus,
  Trash2,
} from "lucide-react";
import { StepProgress } from "@/components/auth/StepProgress";
import { LogoUploader } from "@/components/admin/settings/LogoUploader";
import { ColorPicker } from "@/components/admin/settings/ColorPicker";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "branding", label: "Marca" },
  { id: "schedule", label: "Horario" },
  { id: "holidays", label: "Feriados" },
  { id: "invite", label: "Equipo" },
  { id: "done", label: "Listo" },
];

const TIMEZONES = [
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/Caracas",
  "America/La_Paz",
  "America/Montevideo",
];

const PERU_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "Año Nuevo" },
  { date: "2026-04-02", name: "Jueves Santo" },
  { date: "2026-04-03", name: "Viernes Santo" },
  { date: "2026-05-01", name: "Día del Trabajo" },
  { date: "2026-06-29", name: "San Pedro y San Pablo" },
  { date: "2026-07-28", name: "Fiestas Patrias" },
  { date: "2026-07-29", name: "Fiestas Patrias" },
  { date: "2026-08-30", name: "Santa Rosa de Lima" },
  { date: "2026-10-08", name: "Combate de Angamos" },
  { date: "2026-11-01", name: "Todos los Santos" },
  { date: "2026-12-08", name: "Inmaculada Concepción" },
  { date: "2026-12-25", name: "Navidad" },
];

interface InviteRow {
  email: string;
  fullName: string;
  area: string;
  position: string;
}

export default function OnboardingPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // Branding
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [logoUrl, setLogoUrl] = useState("");

  // Schedule
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [timezone, setTimezone] = useState("America/Lima");
  const [scheduleType, setScheduleType] = useState<"FULL_TIME" | "PART_TIME">(
    "FULL_TIME"
  );

  // Holidays
  const [holidays, setHolidays] = useState(PERU_HOLIDAYS_2026);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  // Invites
  const [inviteRows, setInviteRows] = useState<InviteRow[]>([
    { email: "", fullName: "", area: "", position: "" },
    { email: "", fullName: "", area: "", position: "" },
    { email: "", fullName: "", area: "", position: "" },
  ]);
  const [inviteResult, setInviteResult] = useState<{
    sent: number;
    failed: number;
  } | null>(null);

  // ── Guards ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (sessionStatus === "unauthenticated") {
      router.replace("/login");
      return;
    }
    // Check if onboarding is already done
    (async () => {
      try {
        const res = await fetch("/api/tenant/settings");
        const body = await res.json();
        if (body?.tenant?.settings?.onboardingCompleted === true) {
          router.replace("/admin/dashboard");
          return;
        }
        // Pre-fill from existing tenant settings if any
        const t = body?.tenant;
        if (t?.branding?.primaryColor) setPrimaryColor(t.branding.primaryColor);
        if (t?.branding?.logoUrl) setLogoUrl(t.branding.logoUrl);
        if (t?.settings?.defaultSchedule) {
          setStartTime(t.settings.defaultSchedule.startTime ?? "09:00");
          setEndTime(t.settings.defaultSchedule.endTime ?? "18:00");
          setBreakMinutes(t.settings.defaultSchedule.breakMinutes ?? 60);
        }
        if (t?.settings?.timezone) setTimezone(t.settings.timezone);
        if (t?.settings?.defaultScheduleType)
          setScheduleType(t.settings.defaultScheduleType);
        if (Array.isArray(t?.settings?.holidays) && t.settings.holidays.length > 0) {
          setHolidays(t.settings.holidays);
        }
      } catch {
        /* ignore — defaults stay */
      } finally {
        setTenantLoading(false);
      }
    })();
  }, [sessionStatus, router]);

  // ── Save helpers ───────────────────────────────────────────────────────

  async function saveBranding(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branding: {
            primaryColor,
            secondaryColor: primaryColor,
            accentColor: primaryColor,
            ...(logoUrl ? { logoUrl } : {}),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al guardar branding");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            defaultSchedule: { startTime, endTime, breakMinutes },
            timezone,
            defaultScheduleType: scheduleType,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al guardar horario");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveHolidays(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { holidays } }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al guardar feriados");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveInvites(): Promise<boolean> {
    const valid = inviteRows.filter((r) => r.email.trim() && r.email.includes("@"));
    if (valid.length === 0) {
      // Allow skipping
      setInviteResult({ sent: 0, failed: 0 });
      return true;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invitations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitations: valid.map((r) => ({
            email: r.email.trim(),
            fullName: r.fullName.trim() || undefined,
            area: r.area.trim() || undefined,
            position: r.position.trim() || undefined,
            role: "EMPLOYEE",
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Error al invitar empleados");
      }
      setInviteResult({
        sent: body.created?.length ?? 0,
        failed: body.failed?.length ?? 0,
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function finishOnboarding(): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { onboardingCompleted: true },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Error al finalizar el onboarding");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  async function handleNext() {
    let ok = true;
    if (stepIndex === 0) ok = await saveBranding();
    else if (stepIndex === 1) ok = await saveSchedule();
    else if (stepIndex === 2) ok = await saveHolidays();
    else if (stepIndex === 3) ok = await saveInvites();
    if (!ok) return;
    setStepIndex((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStepIndex((s) => Math.max(s - 1, 0));
  }

  async function handleFinish() {
    const ok = await finishOnboarding();
    if (ok) router.push("/admin/dashboard");
  }

  function addHoliday() {
    if (!newHolidayDate || !newHolidayName.trim()) return;
    setHolidays((h) => [
      ...h,
      { date: newHolidayDate, name: newHolidayName.trim() },
    ]);
    setNewHolidayDate("");
    setNewHolidayName("");
  }

  function removeHoliday(idx: number) {
    setHolidays((h) => h.filter((_, i) => i !== idx));
  }

  function loadPeruTemplate() {
    setHolidays(PERU_HOLIDAYS_2026);
  }

  function updateInviteRow(i: number, field: keyof InviteRow, value: string) {
    setInviteRows((rows) => {
      const next = [...rows];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  function addInviteRow() {
    setInviteRows((rows) => [
      ...rows,
      { email: "", fullName: "", area: "", position: "" },
    ]);
  }

  function removeInviteRow(i: number) {
    setInviteRows((rows) => rows.filter((_, j) => j !== i));
  }

  if (sessionStatus === "loading" || tenantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Bienvenido a Novasys
          </h1>
          <p className="text-sm text-muted-foreground">
            En 5 pasos cortos dejamos tu empresa lista para usar.
            {session?.user?.name && (
              <> Hola, <strong className="text-foreground">{session.user.name}</strong>.</>
            )}
          </p>
        </div>

        {/* Progress */}
        <StepProgress steps={STEPS} currentIndex={stepIndex} />

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 1: Branding ── */}
        {stepIndex === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="h-5 w-5" />
                Personaliza tu marca
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Elige un color principal. Puedes cambiarlo más tarde en
                Configuración.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Color principal</Label>
                <ColorPicker value={primaryColor} onChange={setPrimaryColor} />
              </div>

              <div className="space-y-2">
                <Label>Logo (opcional)</Label>
                <LogoUploader
                  value={logoUrl || null}
                  onChange={(v) => setLogoUrl(v ?? "")}
                />
              </div>

              {/* Live preview */}
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Previsualización
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white"
                    style={{ background: primaryColor }}
                  >
                    {logoUrl ? (
                      // Use a plain img tag so external hosts don't need to be configured.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logoUrl}
                        alt="logo"
                        className="h-10 w-10 rounded-lg object-contain"
                      />
                    ) : (
                      "N"
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Tu empresa</p>
                    <p className="text-xs text-muted-foreground">
                      Botones y enlaces usarán este color
                    </p>
                    <button
                      type="button"
                      className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium text-white"
                      style={{ background: primaryColor }}
                    >
                      Botón ejemplo
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 2: Schedule ── */}
        {stepIndex === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5" />
                Horario laboral por defecto
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Será el horario base para todos los empleados nuevos.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startTime">Hora de entrada</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endTime">Hora de salida</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="breakMinutes">Break (min)</Label>
                  <Input
                    id="breakMinutes"
                    type="number"
                    min={0}
                    max={480}
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="timezone">Zona horaria</Label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scheduleType">Tipo de jornada</Label>
                  <select
                    id="scheduleType"
                    value={scheduleType}
                    onChange={(e) =>
                      setScheduleType(
                        e.target.value as "FULL_TIME" | "PART_TIME"
                      )
                    }
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="FULL_TIME">Tiempo completo</option>
                    <option value="PART_TIME">Medio tiempo</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 3: Holidays ── */}
        {stepIndex === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-5 w-5" />
                    Feriados del año
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Los feriados quedan bloqueados y no se pueden regularizar.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadPeruTemplate}
                >
                  Cargar plantilla Perú
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-1">
                {holidays.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No hay feriados configurados.
                  </p>
                ) : (
                  holidays.map((h, i) => (
                    <div
                      key={`${h.date}-${i}`}
                      className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/40"
                    >
                      <div className="font-mono text-xs text-muted-foreground">
                        {h.date}
                      </div>
                      <div className="flex-1 text-sm">{h.name}</div>
                      <button
                        type="button"
                        onClick={() => removeHoliday(i)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                <Input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                />
                <Input
                  type="text"
                  placeholder="Nombre del feriado"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addHoliday}
                  disabled={!newHolidayDate || !newHolidayName.trim()}
                >
                  <Plus className="mr-1 h-4 w-4" /> Agregar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 4: Invite ── */}
        {stepIndex === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                Invita a tus primeros empleados
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Recibirán un email con el link para crear su cuenta. Puedes
                saltar este paso y hacerlo después.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {inviteRows.map((row, i) => (
                  <div
                    key={i}
                    className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
                  >
                    <Input
                      type="email"
                      placeholder="email@empresa.com"
                      value={row.email}
                      onChange={(e) =>
                        updateInviteRow(i, "email", e.target.value)
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Nombre completo"
                      value={row.fullName}
                      onChange={(e) =>
                        updateInviteRow(i, "fullName", e.target.value)
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Área"
                      value={row.area}
                      onChange={(e) =>
                        updateInviteRow(i, "area", e.target.value)
                      }
                    />
                    <Input
                      type="text"
                      placeholder="Cargo"
                      value={row.position}
                      onChange={(e) =>
                        updateInviteRow(i, "position", e.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeInviteRow(i)}
                      disabled={inviteRows.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addInviteRow}
                >
                  <Plus className="mr-1 h-4 w-4" /> Agregar fila
                </Button>
                {inviteResult && (
                  <p className="text-xs text-muted-foreground">
                    Enviadas: <strong>{inviteResult.sent}</strong>
                    {inviteResult.failed > 0 && (
                      <> · Fallidas: <strong>{inviteResult.failed}</strong></>
                    )}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── STEP 5: Done ── */}
        {stepIndex === 4 && (
          <Card>
            <CardContent className="space-y-6 p-8 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">¡Todo listo!</h2>
                <p className="text-sm text-muted-foreground">
                  Tu empresa está configurada y lista para operar.
                </p>
              </div>

              <div className="mx-auto max-w-md space-y-2 rounded-xl border bg-muted/20 p-4 text-left text-sm">
                <ChecklistItem label="Marca personalizada" done />
                <ChecklistItem
                  label={`Horario ${startTime} – ${endTime} (${timezone})`}
                  done
                />
                <ChecklistItem
                  label={`${holidays.length} feriado(s) configurado(s)`}
                  done
                />
                <ChecklistItem
                  label={
                    inviteResult && inviteResult.sent > 0
                      ? `${inviteResult.sent} empleado(s) invitado(s)`
                      : "Empleados (puedes invitarlos luego)"
                  }
                  done={!!inviteResult && inviteResult.sent > 0}
                />
              </div>

              <Button
                onClick={handleFinish}
                disabled={saving}
                className="h-12 w-full text-base font-medium sm:w-auto sm:px-8"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Building2 className="mr-2 h-5 w-5" />
                )}
                Ir al dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Footer navigation ── */}
        {stepIndex < 4 && (
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={stepIndex === 0 || saving}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Atrás
            </Button>

            <div className="flex items-center gap-2">
              {stepIndex === 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setInviteResult({ sent: 0, failed: 0 });
                    setStepIndex(4);
                  }}
                  disabled={saving}
                >
                  Saltar
                </Button>
              )}
              <Button type="button" onClick={handleNext} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Continuar
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          done ? "bg-emerald-500 text-white" : "bg-muted"
        )}
      >
        {done && <Check className="h-3 w-3" />}
      </div>
      <span className={cn(!done && "text-muted-foreground")}>{label}</span>
    </div>
  );
}
