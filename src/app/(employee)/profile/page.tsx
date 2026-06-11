"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { useMyProfile, useUpdateProfile } from "@/hooks/use-employee";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { PageHeader } from "@/components/nova/page-header";
import { NovaDatePicker } from "@/components/nova/date-picker";
import { NovaClock, CLOCK_STYLES, useClockStyle, setClockStyle } from "@/components/nova/clocks";

/* ============================================================
   Tabs
   ============================================================ */

type TabKey = "personal" | "work" | "security" | "preferences";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "personal", label: "Personal", icon: Icons.user },
  { key: "work", label: "Trabajo", icon: Icons.briefcase },
  { key: "security", label: "Seguridad", icon: Icons.shield },
  { key: "preferences", label: "Preferencias", icon: Icons.settings },
];

/* ============================================================
   Toggle component (matches design's .toggle)
   ============================================================ */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  // Use a real <button role="switch"> so keyboard / screen-reader users can
  // toggle the preference. The visual knob is the same `.toggle` element as
  // before but the activation surface now passes the WCAG keyboard test.
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`toggle ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

/* ============================================================
   Personal tab
   ============================================================ */

interface PersonalProps {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  email: string;
  phone: string; setPhone: (v: string) => void;
  dni: string; setDni: (v: string) => void;
  birthDate: string; setBirthDate: (v: string) => void;
  address: string; setAddress: (v: string) => void;
  emergencyName: string; setEmergencyName: (v: string) => void;
  emergencyRel: string; setEmergencyRel: (v: string) => void;
  emergencyPhone: string; setEmergencyPhone: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
  dirty: boolean;
}

function ProfilePersonal(p: PersonalProps) {
  return (
    <div style={{ padding: 4 }}>
      {/* Admin-managed fields — disabled to prevent silent data loss.
          The current /api/profile mutation only accepts Phone, DNI, BirthDate. */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Nombres <span className="form-label-locked">· admin</span>
          </label>
          <input className="form-input" value={p.firstName} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">
            Apellidos <span className="form-label-locked">· admin</span>
          </label>
          <input className="form-input" value={p.lastName} disabled />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">
            Correo <span className="form-label-locked">· admin</span>
          </label>
          <input className="form-input" type="email" value={p.email} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Teléfono</label>
          <input
            className="form-input"
            value={p.phone}
            onChange={(e) => p.setPhone(e.target.value)}
            placeholder="+51 999 999 999"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Documento de identidad</label>
          <input
            className="form-input"
            value={p.dni}
            onChange={(e) => p.setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="12345678"
            inputMode="numeric"
            maxLength={8}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Fecha de nacimiento</label>
          <NovaDatePicker value={p.birthDate} onChange={p.setBirthDate} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">
          Dirección <span className="form-label-locked">· admin</span>
        </label>
        <input
          className="form-input"
          value={p.address}
          disabled
          placeholder="—"
        />
      </div>

      <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <div className="panel-title" style={{ marginBottom: 6 }}>
          Contacto de emergencia
        </div>
        <div className="form-hint" style={{ marginBottom: 14, fontSize: 12, color: "var(--text-muted)" }}>
          Gestionado por RRHH — solicita actualización a tu administrador.
        </div>
        <div className="fill-grid min-240">
          <div className="form-group">
            <label className="form-label">
              Nombre <span className="form-label-locked">· admin</span>
            </label>
            <input className="form-input" value={p.emergencyName} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">
              Relación <span className="form-label-locked">· admin</span>
            </label>
            <input className="form-input" value={p.emergencyRel} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">
              Teléfono <span className="form-label-locked">· admin</span>
            </label>
            <input className="form-input" value={p.emergencyPhone} disabled />
          </div>
        </div>
      </div>

      <div
        style={{
          padding: 14,
          background: "var(--bg-subtle)",
          borderRadius: "var(--r)",
          display: "flex",
          gap: 10,
          marginTop: 16,
        }}
      >
        <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          <IconSvg d={Icons.helpCircle ?? Icons.bell} size={16} />
        </span>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Solo puedes editar tu teléfono, documento y fecha de nacimiento. Para cambiar
          datos personales, dirección o contacto de emergencia, contacta a tu administrador
          de RRHH.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button type="button" className="btn ghost" disabled={!p.dirty || p.saving} onClick={p.onReset}>
          Descartar
        </button>
        <button type="button" className="btn primary" onClick={p.onSave} disabled={!p.dirty || p.saving}>
          {p.saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Work tab — read-only (data managed by admin)
   ============================================================ */

function ProfileWork({
  position,
  area,
  workMode,
  joined,
  schedule,
}: {
  position: string;
  area: string;
  workMode: string;
  joined: string;
  schedule: string;
}) {
  return (
    <div style={{ padding: 4 }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Cargo</label>
          <input className="form-input" value={position} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Área</label>
          <input className="form-input" value={area} disabled />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Modalidad</label>
          <input className="form-input" value={workMode} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Supervisor</label>
          <input className="form-input" value="—" disabled />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Fecha de ingreso</label>
          <input className="form-input" value={joined} disabled />
        </div>
        <div className="form-group">
          <label className="form-label">Turno</label>
          <input className="form-input" value={schedule} disabled />
        </div>
      </div>
      <div
        style={{
          padding: 14,
          background: "var(--bg-subtle)",
          borderRadius: "var(--r)",
          display: "flex",
          gap: 10,
          marginTop: 8,
        }}
      >
        <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
          <IconSvg d={Icons.helpCircle} size={16} />
        </span>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Para cambiar tu información laboral, contacta a tu administrador de RRHH.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Security tab
   ============================================================ */

function ProfileSecurity({ userEmail }: { userEmail?: string }) {
  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e?: React.FormEvent) {
    e?.preventDefault();
    if (newPwd.length < 8) return toast.error("Mínimo 8 caracteres");
    if (newPwd !== confirm) return toast.error("Las contraseñas no coinciden");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: newPwd }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Error al cambiar contraseña");
      toast.success("Contraseña actualizada");
      setCurrent("");
      setNewPwd("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 4 }}>
      <form
        onSubmit={handleChangePassword}
        autoComplete="on"
        style={{ marginBottom: 24 }}
      >
        <div className="panel-title" style={{ marginBottom: 10 }}>
          Cambiar contraseña
        </div>
        {/* Hidden username so password managers (and Chrome autofill) bind to
            the right account and don't try to backfill nearby text inputs like
            the global search bar. */}
        <input
          type="email"
          name="username"
          value={userEmail ?? ""}
          autoComplete="username"
          readOnly
          tabIndex={-1}
          aria-hidden
          style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
        />
        <div className="form-group">
          <label className="form-label" htmlFor="profile-current-password">Contraseña actual</label>
          <input
            id="profile-current-password"
            type="password"
            className="form-input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="profile-new-password">Nueva contraseña</label>
            <input
              id="profile-new-password"
              type="password"
              className="form-input"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="profile-confirm-password">Confirmar</label>
            <input
              id="profile-confirm-password"
              type="password"
              className="form-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn primary btn-md"
          disabled={loading || !current || !newPwd}
        >
          {loading ? "Actualizando…" : "Actualizar contraseña"}
        </button>
      </form>

      <div style={{ paddingTop: 20, borderTop: "1px solid var(--border)" }}>
        <div className="panel-title" style={{ marginBottom: 10 }}>
          Autenticación de dos factores
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 14,
            background: "var(--bg-subtle)",
            borderRadius: "var(--r)",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
              2FA con app autenticadora
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Google Authenticator, Authy, 1Password
            </div>
          </div>
          <button
            type="button"
            className="btn outline btn-sm"
            disabled
            title="2FA llegará pronto"
            style={{ cursor: "not-allowed" }}
          >
            Próximamente
          </button>
        </div>
      </div>

      <div style={{ paddingTop: 20, borderTop: "1px solid var(--border)", marginTop: 20 }}>
        <div
          className="panel-title"
          style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>Sesiones activas</span>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ color: "var(--danger)" }}
          >
            <IconSvg d={Icons.logout} size={13} /> Cerrar sesión
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 12,
              background: "var(--bg-subtle)",
              borderRadius: "var(--r)",
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>
              <IconSvg d={Icons.phone} size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Sesión actual
                <span className="type-tag success" style={{ marginLeft: 6 }}>
                  Esta sesión
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Navegador · Ahora
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Preferences tab
   ============================================================ */

function ClockPicker() {
  const current = useClockStyle();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="panel-title" style={{ marginBottom: 4 }}>
        Estilo de reloj
      </div>
      <div className="panel-sub" style={{ marginBottom: 14 }}>
        Elige cómo se ve el reloj en tu inicio
      </div>
      <div className="clock-picker">
        {CLOCK_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`clock-card ${current === s.id ? "selected" : ""}`}
            onClick={() => {
              setClockStyle(s.id);
              toast.success(`Reloj: ${s.label}`);
            }}
            aria-pressed={current === s.id}
          >
            <div className="clock-card-check">
              <IconSvg d={Icons.check} size={13} />
            </div>
            <div className="clock-stage">
              <NovaClock variant={s.id} now={now} state="working" worked={6 * 3600} breakSec={600} mini />
            </div>
            <div className="clock-card-name">{s.label}</div>
            <div className="clock-card-desc">{s.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfilePreferences() {
  const [weekly, setWeekly] = useState(true);
  const [pushApprovals, setPushApprovals] = useState(true);
  const [showBirthday, setShowBirthday] = useState(false);
  const [visibleNew, setVisibleNew] = useState(true);

  function save() {
    toast.success("Preferencias guardadas");
  }

  return (
    <div style={{ padding: 4 }}>
      <ClockPicker />
      <Toggle
        label="Recibir resumen semanal por email"
        checked={weekly}
        onChange={setWeekly}
      />
      <Toggle
        label="Notificaciones push de aprobaciones"
        checked={pushApprovals}
        onChange={setPushApprovals}
      />
      <Toggle
        label="Mostrar mi cumpleaños en el feed"
        checked={showBirthday}
        onChange={setShowBirthday}
      />
      <Toggle
        label="Visible para nuevos compañeros"
        checked={visibleNew}
        onChange={setVisibleNew}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <button type="button" className="btn primary" onClick={save}>
          Guardar
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function ProfilePage() {
  const { data, isLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = data?.employee?.avatarUrl;

  // Reset broken-image fallback when the avatar URL changes (e.g. after upload).
  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  // URL-persisted tab state — supports deep-links & browser back/forward
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const VALID_TABS: TabKey[] = ["personal", "work", "security", "preferences"];
  const tabFromUrl = searchParams.get("tab") as TabKey | null;
  const initialTab: TabKey = VALID_TABS.includes(tabFromUrl as TabKey) ? (tabFromUrl as TabKey) : "personal";

  const [tab, setTabState] = useState<TabKey>(initialTab);

  // Keep state in sync if URL changes externally (e.g. back/forward)
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== tab && VALID_TABS.includes(tabFromUrl)) {
      setTabState(tabFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const setTab = useCallback((next: TabKey) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  // Personal state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dni, setDni] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRel, setEmergencyRel] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const employee = data?.employee;

  // Sync server → local
  useEffect(() => {
    if (!employee) return;
    setFirstName(employee.firstName ?? "");
    setLastName(employee.lastName ?? "");
    setPhone(employee.phone ?? "");
    setDni(employee.dni ?? "");
    setBirthDate(employee.birthDate ?? "");
    setAddress(employee.location?.address ?? "");
    setEmergencyName(employee.emergencyContact?.name ?? "");
    setEmergencyRel(employee.emergencyContact?.relationship ?? "");
    setEmergencyPhone(employee.emergencyContact?.phone ?? "");
  }, [employee]);

  function resetPersonal() {
    if (!employee) return;
    setFirstName(employee.firstName ?? "");
    setLastName(employee.lastName ?? "");
    setPhone(employee.phone ?? "");
    setDni(employee.dni ?? "");
    setBirthDate(employee.birthDate ?? "");
    setAddress(employee.location?.address ?? "");
    setEmergencyName(employee.emergencyContact?.name ?? "");
    setEmergencyRel(employee.emergencyContact?.relationship ?? "");
    setEmergencyPhone(employee.emergencyContact?.phone ?? "");
  }

  // Only count editable fields (phone, dni, birthDate) as dirty — the rest are
  // admin-managed and disabled, so they never change from the user's side.
  const isPersonalDirty =
    employee &&
    (phone !== (employee.phone ?? "") ||
      dni !== (employee.dni ?? "") ||
      birthDate !== (employee.birthDate ?? ""));

  async function handleSavePersonal() {
    if (!employee) return;
    try {
      await updateProfile.mutateAsync({
        Phone: phone || undefined,
        DNI: dni || undefined,
        BirthDate: birthDate || undefined,
      });
      toast.success("Perfil actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagen demasiado grande (máx. 2MB)");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir imagen");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  // Derived display values
  const fullName = employee
    ? `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim()
    : "Cargando…";
  const role = employee?.position ?? "—";
  const team = employee?.area
    ? `${employee.area}${employee.location?.address ? " · " + employee.location.address.split(",")[0] : ""}`
    : "—";
  const initials =
    employee && employee.firstName
      ? `${employee.firstName[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase()
      : "U";

  // Vacation fields not yet stored on the employee record. Show real values
  // only when populated; otherwise display an honest "—" instead of fake stats.
  const vacationTotal = employee?.vacationTotal ?? null;
  const vacationBalance = employee?.vacationBalance ?? null;
  const vacationUsed =
    vacationTotal != null && vacationBalance != null
      ? vacationTotal - vacationBalance
      : null;

  if (isLoading && !employee) {
    return (
      <div className="page-header">
        <h1 className="page-title">Mi perfil</h1>
        <p className="page-sub">Cargando…</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Mi perfil"
        subtitle="Información personal, seguridad y preferencias."
      />

      <div className="profile-layout">
        {/* Sidebar */}
        <div className="panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              {employee?.avatarUrl && !avatarFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={employee.avatarUrl}
                  alt={fullName}
                  onError={() => setAvatarFailed(true)}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid var(--bg-elevated)",
                    boxShadow: "var(--shadow-md)",
                    background: "var(--bg-subtle)",
                  }}
                />
              ) : (
                <div
                  className="avatar accent"
                  aria-label={fullName}
                  style={{ width: 120, height: 120, fontSize: 40, borderRadius: "50%" }}
                >
                  {initials}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                className="btn outline btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                aria-label="Cambiar foto"
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  padding: 6,
                  borderRadius: "50%",
                  background: "var(--bg-elevated)",
                }}
              >
                <IconSvg d={Icons.edit} size={12} />
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                {fullName || "Sin nombre"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{role}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{team}</div>
            </div>
          </div>

          {/* Vacation card */}
          <div
            style={{
              marginTop: 20,
              padding: 14,
              background: "var(--bg-subtle)",
              borderRadius: "var(--r)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Vacaciones
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>Disponibles</span>
              <strong style={{ color: "var(--text-primary)" }}>
                {vacationBalance != null ? `${vacationBalance} días` : "—"}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 6 }}>
              <span style={{ color: "var(--text-secondary)" }}>Usadas</span>
              <strong style={{ color: "var(--text-primary)" }}>
                {vacationUsed != null ? `${vacationUsed} días` : "—"}
              </strong>
            </div>
            <div
              style={{
                height: 6,
                background: "var(--bg-elevated)",
                borderRadius: 3,
                overflow: "hidden",
                marginTop: 10,
              }}
            >
              <div
                style={{
                  width:
                    vacationTotal && vacationTotal > 0 && vacationUsed != null
                      ? `${(vacationUsed / vacationTotal) * 100}%`
                      : "0%",
                  height: "100%",
                  background: "var(--accent)",
                  transition: "width 0.4s",
                }}
              />
            </div>
          </div>
        </div>

        {/* Tabs panel */}
        <div className="panel">
          <div className="tabs" role="tablist" aria-label="Secciones del perfil">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                id={`profile-tab-${t.key}`}
                aria-controls={`profile-panel-${t.key}`}
                className={`tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                <IconSvg d={t.icon} size={14} />
                {t.label}
              </button>
            ))}
          </div>

          {tab === "personal" && (
            <ProfilePersonal
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              email={employee?.email ?? ""}
              phone={phone}
              setPhone={setPhone}
              dni={dni}
              setDni={setDni}
              birthDate={birthDate}
              setBirthDate={setBirthDate}
              address={address}
              setAddress={setAddress}
              emergencyName={emergencyName}
              setEmergencyName={setEmergencyName}
              emergencyRel={emergencyRel}
              setEmergencyRel={setEmergencyRel}
              emergencyPhone={emergencyPhone}
              setEmergencyPhone={setEmergencyPhone}
              onSave={handleSavePersonal}
              onReset={resetPersonal}
              saving={updateProfile.isPending}
              dirty={!!isPersonalDirty}
            />
          )}

          {tab === "work" && (
            <ProfileWork
              position={employee?.position ?? "—"}
              area={employee?.area ?? "—"}
              workMode={
                employee?.workMode === "REMOTE"
                  ? "Remoto"
                  : employee?.workMode === "HYBRID"
                  ? "Híbrido"
                  : "Presencial"
              }
              joined={employee?.hireDate ?? "—"}
              schedule={
                employee?.schedule
                  ? `${employee.schedule.startTime} – ${employee.schedule.endTime} (${
                      employee.schedule.type === "FULL_TIME" ? "Tiempo completo" : "Medio tiempo"
                    })`
                  : "—"
              }
            />
          )}

          {tab === "security" && <ProfileSecurity userEmail={employee?.email} />}
          {tab === "preferences" && <ProfilePreferences />}
        </div>
      </div>

      <style jsx>{`
        .profile-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 20px;
        }
        @media (max-width: 880px) {
          .profile-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
