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
 * Migrated to design CSS (.panel / .form-input / .btn primary / .stat-mini).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { StepProgress } from "@/components/auth/StepProgress";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaDatePicker } from "@/components/nova/date-picker";
import { useQueryClient } from "@tanstack/react-query";

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

const COLOR_PRESETS = ["#3FBEFF", "#0A1628", "#10B981", "#8B5CF6", "#F59E0B", "#F43F5E"];

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
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // Branding
  const [primaryColor, setPrimaryColor] = useState("#3FBEFF");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Schedule
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [timezone, setTimezone] = useState("America/Lima");
  const [scheduleType, setScheduleType] = useState<"FULL_TIME" | "PART_TIME">("FULL_TIME");

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
  const [inviteResult, setInviteResult] = useState<{ sent: number; failed: number } | null>(null);

  // ── Guards ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (sessionStatus === "unauthenticated") {
      router.replace("/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/tenant/settings");
        const body = await res.json();
        if (body?.tenant?.settings?.onboardingCompleted === true) {
          router.replace("/admin/dashboard");
          return;
        }
        const t = body?.tenant;
        if (t?.branding?.primaryColor) setPrimaryColor(t.branding.primaryColor);
        if (t?.branding?.logoUrl) setLogoUrl(t.branding.logoUrl);
        if (t?.settings?.defaultSchedule) {
          setStartTime(t.settings.defaultSchedule.startTime ?? "09:00");
          setEndTime(t.settings.defaultSchedule.endTime ?? "18:00");
          setBreakMinutes(t.settings.defaultSchedule.breakMinutes ?? 60);
        }
        if (t?.settings?.timezone) setTimezone(t.settings.timezone);
        if (t?.settings?.defaultScheduleType) setScheduleType(t.settings.defaultScheduleType);
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
        body: JSON.stringify({ settings: { onboardingCompleted: true } }),
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Imagen demasiado grande (máx. 2MB)");
      return;
    }
    setUploadingLogo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/admin/tenant/logo", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir logo");
      setLogoUrl(json.logoUrl ?? "");
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploadingLogo(false);
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
    setHolidays((h) => [...h, { date: newHolidayDate, name: newHolidayName.trim() }]);
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
    setInviteRows((rows) => [...rows, { email: "", fullName: "", area: "", position: "" }]);
  }

  function removeInviteRow(i: number) {
    setInviteRows((rows) => rows.filter((_, j) => j !== i));
  }

  if (sessionStatus === "loading" || tenantLoading) {
    return (
      <div
        className="nva-app"
        data-theme="light"
        data-density="comfortable"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
        }}
      >
        Preparando tu onboarding…
      </div>
    );
  }

  return (
    <div
      className="nva-app"
      data-theme="light"
      data-density="comfortable"
      style={{ minHeight: "100vh", padding: "40px 24px" }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: "var(--accent-soft)",
              color: "var(--accent-strong)",
              margin: "0 auto 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconSvg d={Icons.sparkles ?? Icons.heart} size={28} />
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Bienvenido a Novaassistance
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 0" }}>
            En 5 pasos cortos dejamos tu empresa lista para usar.
            {session?.user?.name && (
              <>
                {" "}
                Hola,{" "}
                <strong style={{ color: "var(--text-primary)" }}>{session.user.name}</strong>.
              </>
            )}
          </p>
        </div>

        {/* Progress */}
        <StepProgress steps={STEPS} currentIndex={stepIndex} />

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r)",
              border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              color: "var(--danger)",
              fontSize: 13,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <IconSvg d={Icons.alert} size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 1: Branding ── */}
        {stepIndex === 0 && (
          <div className="panel">
            <div style={{ marginBottom: 16 }}>
              <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconSvg d={Icons.heart} size={16} /> Personaliza tu marca
              </div>
              <div className="panel-sub" style={{ marginTop: 2 }}>
                Elige un color principal. Puedes cambiarlo más tarde en Configuración.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Color principal</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPrimaryColor(c)}
                    aria-label={`Color ${c}`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: c,
                      border:
                        c.toLowerCase() === primaryColor.toLowerCase()
                          ? `3px solid var(--accent)`
                          : "2px solid var(--border)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: 56, height: 40, padding: 4, borderRadius: 6, border: "1px solid var(--border)" }}
                />
                <input
                  className="form-input"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: 120, fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Logo (opcional)</label>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    border: "2px dashed var(--border)",
                    borderRadius: "var(--r)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--bg-subtle)",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt="Logo"
                      style={{ maxWidth: "85%", maxHeight: "85%", objectFit: "contain" }}
                    />
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin logo</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleLogoUpload}
                  />
                  <button
                    type="button"
                    className="btn outline btn-md"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <IconSvg d={Icons.upload} size={14} />
                    {uploadingLogo ? "Subiendo…" : "Subir logo"}
                  </button>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                    PNG o SVG, mínimo 256×256px, máximo 2MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div
              style={{
                marginTop: 6,
                padding: 16,
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
              }}
            >
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Previsualización
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: primaryColor,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" style={{ width: "85%", height: "85%", objectFit: "contain" }} />
                  ) : (
                    "N"
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                    Tu empresa
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    Botones y enlaces usarán este color
                  </p>
                  <button
                    type="button"
                    style={{
                      marginTop: 8,
                      background: primaryColor,
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Botón ejemplo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Schedule ── */}
        {stepIndex === 1 && (
          <div className="panel">
            <div style={{ marginBottom: 16 }}>
              <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconSvg d={Icons.clock} size={16} /> Horario laboral por defecto
              </div>
              <div className="panel-sub" style={{ marginTop: 2 }}>
                Será el horario base para todos los empleados nuevos.
              </div>
            </div>

            <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="startTime">Hora de entrada</label>
                <input
                  id="startTime"
                  className="form-input"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="endTime">Hora de salida</label>
                <input
                  id="endTime"
                  className="form-input"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="breakMinutes">Break (min)</label>
                <input
                  id="breakMinutes"
                  className="form-input"
                  type="number"
                  min={0}
                  max={480}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="timezone">Zona horaria</label>
                <select
                  id="timezone"
                  className="form-select"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="scheduleType">Tipo de jornada</label>
                <select
                  id="scheduleType"
                  className="form-select"
                  value={scheduleType}
                  onChange={(e) =>
                    setScheduleType(e.target.value as "FULL_TIME" | "PART_TIME")
                  }
                >
                  <option value="FULL_TIME">Tiempo completo</option>
                  <option value="PART_TIME">Medio tiempo</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Holidays ── */}
        {stepIndex === 2 && (
          <div className="panel">
            <div
              style={{
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconSvg d={Icons.calendar} size={16} /> Feriados del año
                </div>
                <div className="panel-sub" style={{ marginTop: 2 }}>
                  Los feriados quedan bloqueados y no se pueden regularizar.
                </div>
              </div>
              <button type="button" className="btn outline btn-sm" onClick={loadPeruTemplate}>
                Cargar plantilla Perú
              </button>
            </div>

            <div
              style={{
                maxHeight: 320,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: 4,
                marginBottom: 12,
              }}
            >
              {holidays.length === 0 ? (
                <p
                  style={{
                    padding: 24,
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    margin: 0,
                  }}
                >
                  No hay feriados configurados.
                </p>
              ) : (
                holidays.map((h, i) => (
                  <div
                    key={`${h.date}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 12px",
                      borderRadius: 6,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      {h.date}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{h.name}</span>
                    <button
                      type="button"
                      onClick={() => removeHoliday(i)}
                      className="btn ghost btn-sm"
                      aria-label="Eliminar"
                    >
                      <IconSvg d={Icons.trash} size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr auto",
                gap: 8,
              }}
            >
              <NovaDatePicker value={newHolidayDate} onChange={setNewHolidayDate} />
              <input
                className="form-input"
                type="text"
                placeholder="Nombre del feriado"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
              />
              <button
                type="button"
                className="btn outline btn-md"
                onClick={addHoliday}
                disabled={!newHolidayDate || !newHolidayName.trim()}
              >
                <IconSvg d={Icons.plus} size={14} /> Agregar
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Invite ── */}
        {stepIndex === 3 && (
          <div className="panel">
            <div style={{ marginBottom: 14 }}>
              <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconSvg d={Icons.users} size={16} /> Invita a tus primeros empleados
              </div>
              <div className="panel-sub" style={{ marginTop: 2 }}>
                Recibirán un email con el link para crear su cuenta. Puedes saltar este paso y hacerlo después.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {inviteRows.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
                    gap: 8,
                    padding: 10,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <input
                    className="form-input"
                    type="email"
                    placeholder="email@empresa.com"
                    value={row.email}
                    onChange={(e) => updateInviteRow(i, "email", e.target.value)}
                  />
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Nombre completo"
                    value={row.fullName}
                    onChange={(e) => updateInviteRow(i, "fullName", e.target.value)}
                  />
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Área"
                    value={row.area}
                    onChange={(e) => updateInviteRow(i, "area", e.target.value)}
                  />
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Cargo"
                    value={row.position}
                    onChange={(e) => updateInviteRow(i, "position", e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn ghost btn-sm"
                    onClick={() => removeInviteRow(i)}
                    disabled={inviteRows.length <= 1}
                    aria-label="Eliminar fila"
                  >
                    <IconSvg d={Icons.trash} size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 12,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <button type="button" className="btn outline btn-sm" onClick={addInviteRow}>
                <IconSvg d={Icons.plus} size={14} /> Agregar fila
              </button>
              {inviteResult && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  Enviadas: <strong style={{ color: "var(--text-primary)" }}>{inviteResult.sent}</strong>
                  {inviteResult.failed > 0 && (
                    <>
                      {" "}
                      · Fallidas:{" "}
                      <strong style={{ color: "var(--text-primary)" }}>{inviteResult.failed}</strong>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 5: Done ── */}
        {stepIndex === 4 && (
          <div className="panel" style={{ textAlign: "center", padding: 32 }}>
            <div
              style={{
                width: 72,
                height: 72,
                margin: "0 auto 18px",
                borderRadius: "50%",
                background: "color-mix(in srgb, var(--success) 14%, transparent)",
                color: "var(--success)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSvg d={Icons.check} size={32} />
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              ¡Todo listo!
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 22px" }}>
              Tu empresa está configurada y lista para operar.
            </p>

            <div
              style={{
                maxWidth: 400,
                margin: "0 auto 22px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: 16,
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <ChecklistItem label="Marca personalizada" done />
              <ChecklistItem label={`Horario ${startTime} – ${endTime} (${timezone})`} done />
              <ChecklistItem label={`${holidays.length} feriado(s) configurado(s)`} done />
              <ChecklistItem
                label={
                  inviteResult && inviteResult.sent > 0
                    ? `${inviteResult.sent} empleado(s) invitado(s)`
                    : "Empleados (puedes invitarlos luego)"
                }
                done={!!inviteResult && inviteResult.sent > 0}
              />
            </div>

            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="btn primary btn-lg"
              style={{ minWidth: 220, justifyContent: "center" }}
            >
              {saving ? "Finalizando…" : "Ir al dashboard"}
            </button>
          </div>
        )}

        {/* ── Footer navigation ── */}
        {stepIndex < 4 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn ghost"
              onClick={handleBack}
              disabled={stepIndex === 0 || saving}
            >
              <IconSvg d={Icons.arrowLeft} size={14} /> Atrás
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {stepIndex === 3 && (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setInviteResult({ sent: 0, failed: 0 });
                    setStepIndex(4);
                  }}
                  disabled={saving}
                >
                  Saltar
                </button>
              )}
              <button
                type="button"
                className="btn primary"
                onClick={handleNext}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Continuar"} <IconSvg d={Icons.arrow} size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: done ? "var(--success)" : "var(--bg-elevated)",
          border: done ? "none" : "1px solid var(--border)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {done && <IconSvg d={Icons.check} size={11} />}
      </span>
      <span
        style={{
          fontSize: 13,
          color: done ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
