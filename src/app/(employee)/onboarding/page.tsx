"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMyProfile } from "@/hooks/use-employee";
import { useTenant } from "@/lib/contexts/tenant-context";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaLogo } from "@/components/nova/logo";

const STEPS = ["Bienvenida", "Tu perfil", "Cómo marcar", "Permisos", "Listo"];

/* ── Orbital art (SMIL animations gated on prefers-reduced-motion) ── */
function OrbitWelcome({ animate }: { animate: boolean }) {
  return (
    <svg width="200" height="160" viewBox="0 0 200 160" fill="none" aria-hidden>
      <ellipse cx="100" cy="90" rx="80" ry="28" stroke="var(--border)" strokeDasharray="2 5">
        {animate && (
          <animateTransform attributeName="transform" type="rotate" from="0 100 90" to="360 100 90" dur="50s" repeatCount="indefinite" />
        )}
      </ellipse>
      <circle cx="100" cy="70" r="30" fill="var(--accent-soft)" />
      <circle cx="100" cy="70" r="18" fill="var(--accent)" />
      <path d="M100 60 L103 67 L110 70 L103 73 L100 80 L97 73 L90 70 L97 67 Z" fill="#fff" />
      <circle r="5" fill="var(--success)">
        {animate && (
          <animateMotion dur="6s" repeatCount="indefinite" path="M180,90 a80,28 0 1,1 -160,0 a80,28 0 1,1 160,0" />
        )}
      </circle>
    </svg>
  );
}
function OrbitClock({ animate }: { animate: boolean }) {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" aria-hidden>
      <circle cx="80" cy="80" r="54" fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth="1.5" />
      <circle cx="80" cy="80" r="54" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray="180 340" transform="rotate(-90 80 80)" />
      <line x1="80" y1="80" x2="80" y2="46" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round">
        {animate && (
          <animateTransform attributeName="transform" type="rotate" from="0 80 80" to="360 80 80" dur="8s" repeatCount="indefinite" />
        )}
      </line>
      <line x1="80" y1="80" x2="104" y2="80" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="80" cy="80" r="4" fill="var(--accent)" />
    </svg>
  );
}
function OrbitDoc() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" aria-hidden>
      <rect x="52" y="36" width="56" height="76" rx="6" fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth="1.5" />
      <rect x="62" y="50" width="28" height="4" rx="2" fill="var(--accent)" />
      <rect x="62" y="62" width="36" height="3" rx="1.5" fill="var(--border)" />
      <rect x="62" y="71" width="30" height="3" rx="1.5" fill="var(--border)" />
      <circle cx="104" cy="100" r="18" fill="var(--success)" />
      <path d="M97 100 l5 5 9-9" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { data } = useMyProfile();
  const { tenantName } = useTenant();
  const employee = data?.employee;
  const fullName: string = session?.user?.name ?? employee?.fullName ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (employee && !hydrated) {
      if (employee.phone) setPhone(employee.phone);
      if (employee.dni && !employee.dni.startsWith("PENDING")) setDni(employee.dni);
      if (employee.birthDate) setBirthDate(employee.birthDate);
      setHydrated(true);
    }
  }, [employee, hydrated]);

  const firstName = fullName.split(" ")[0] || "";
  const initials =
    (fullName || "Yo")
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  const dniIsValid = /^\d{8}$/.test(dni);
  const animate = !reduceMotion;

  async function saveProfileThenNext() {
    setError(null);
    if (!dniIsValid) {
      setError("Ingresa un DNI válido (8 dígitos numéricos).");
      return;
    }
    setLoading(true);
    try {
      const updates: Record<string, string> = { DNI: dni };
      if (phone) updates.Phone = phone;
      if (birthDate) updates.BirthDate = birthDate;
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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Imagen demasiado grande (máx. 2MB)");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error al subir");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  }

  const finish = () => router.push("/dashboard");
  const back = () => setStep((s) => Math.max(0, s - 1));
  // Step 1 saves the profile (and validates DNI) before advancing; others just advance.
  const next = () => {
    if (step === 1) return void saveProfileThenNext();
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const vacationTotal = employee?.vacationTotal ?? 22;
  const vacationBalance = employee?.vacationBalance ?? vacationTotal;
  const avatarUrl = avatarPreview || employee?.avatarUrl;

  return (
    <div className="ob-shell">
      <div className="ob-card">
        <div className="ob-progress">
          <NovaLogo size={26} />
          <div className="ob-dots">
            {STEPS.map((s, i) => (
              <div key={s} className={`ob-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`} />
            ))}
          </div>
          <button type="button" className="ob-skip" onClick={finish}>
            Saltar
          </button>
        </div>

        <div className="ob-body">
          {step === 0 && (
            <div className="ob-step">
              <div className="ob-art"><OrbitWelcome animate={animate} /></div>
              <h1 className="ob-title">¡Bienvenido{firstName ? `, ${firstName}` : ""}! 👋</h1>
              <p className="ob-sub">
                Te damos la bienvenida a <strong>{tenantName ?? "Novaassistance"}</strong>. En 1 minuto te mostramos cómo marcar tu asistencia, pedir permisos y más.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="ob-step">
              <div className="ob-avatar-big">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" />
                ) : (
                  initials
                )}
                <button
                  type="button"
                  className="ob-avatar-edit"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Subir foto"
                  title="Subir foto"
                >
                  <IconSvg d={Icons.upload} size={13} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarUpload}
                  style={{ display: "none" }}
                />
              </div>
              <h1 className="ob-title">Confirma tu perfil</h1>
              <p className="ob-sub">Esto es lo que RRHH registró. Completa lo que falte.</p>

              <div className="ob-fields">
                <div className="ob-field"><span>Nombre</span><strong>{fullName || "—"}</strong></div>
                <div className="ob-field"><span>Cargo</span><strong>{employee?.position ?? "—"}</strong></div>
                <div className="ob-field"><span>Área</span><strong>{employee?.area ?? "—"}</strong></div>
              </div>

              <div className="form-row" style={{ marginTop: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">DNI<span className="req">*</span></label>
                  <input
                    className={`form-input ${dni.length > 0 && !dniIsValid ? "form-input-invalid" : ""}`}
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="12345678"
                    inputMode="numeric"
                    maxLength={8}
                  />
                  {dni.length > 0 && !dniIsValid && <span className="form-hint-error">8 dígitos</span>}
                  {dniIsValid && <span className="form-hint-success">DNI válido</span>}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+51 999 999 999" />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 12, marginBottom: 0, textAlign: "left" }}>
                <label className="form-label">Fecha de nacimiento</label>
                <input className="form-input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>

              {error && (
                <div className="form-hint-error" style={{ marginTop: 12, justifyContent: "center" }}>
                  <IconSvg d={Icons.alert} size={13} /> {error}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="ob-step">
              <div className="ob-art"><OrbitClock animate={animate} /></div>
              <h1 className="ob-title">Marca tu asistencia</h1>
              <p className="ob-sub">
                Cada día, pulsa el botón grande de tu inicio para marcar entrada y salida. Validamos tu ubicación por GPS.
              </p>
              <div className="ob-tips">
                <div className="ob-tip">
                  <div className="ob-tip-ic success"><IconSvg d={Icons.check} size={14} /></div>
                  Debes estar dentro del radio de tu sede (50m)
                </div>
                <div className="ob-tip">
                  <div className="ob-tip-ic accent"><IconSvg d={Icons.clock} size={14} /></div>
                  Tu turno empieza 09:00 (15 min de tolerancia)
                </div>
                <div className="ob-tip">
                  <div className="ob-tip-ic warn"><IconSvg d={Icons.coffee} size={14} /></div>
                  Registra tus breaks para un cálculo exacto
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="ob-step">
              <div className="ob-art"><OrbitDoc /></div>
              <h1 className="ob-title">Permisos y vacaciones</h1>
              <p className="ob-sub">
                Solicita desde &quot;Mis solicitudes&quot;. Tu supervisor recibe la petición y te avisamos cuando responda.
              </p>
              <div className="ob-balance">
                <div>
                  <div className="ob-balance-num">{vacationTotal}</div>
                  <div className="ob-balance-lbl">días de vacaciones al año</div>
                </div>
                <div className="ob-balance-div" />
                <div>
                  <div className="ob-balance-num">{vacationBalance}</div>
                  <div className="ob-balance-lbl">disponibles ahora</div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="ob-step">
              <div className="ob-check-big"><IconSvg d={Icons.check} size={40} stroke={2.5} /></div>
              <h1 className="ob-title">¡Todo listo! 🚀</h1>
              <p className="ob-sub">Tu cuenta está configurada. Marca tu primera entrada cuando llegues a la oficina.</p>
              <div className="ob-checklist">
                <div className="ob-cl-item done"><IconSvg d={Icons.check} size={14} /> Perfil confirmado</div>
                <div className="ob-cl-item done"><IconSvg d={Icons.check} size={14} /> Aprendiste a marcar</div>
                <div className="ob-cl-item done"><IconSvg d={Icons.check} size={14} /> Conoces permisos y vacaciones</div>
              </div>
            </div>
          )}
        </div>

        <div className="ob-foot">
          {step > 0 && step < STEPS.length - 1 && (
            <button type="button" className="btn ghost" onClick={back} disabled={loading || uploading}>
              <IconSvg d={Icons.arrowLeft} size={14} /> Atrás
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn primary btn-lg" onClick={next} disabled={loading || uploading}>
              {loading ? "Guardando…" : step === 0 ? "Empezar" : "Continuar"} <IconSvg d={Icons.arrow} size={14} />
            </button>
          ) : (
            <button type="button" className="btn primary btn-lg" onClick={finish}>
              Ir a mi inicio <IconSvg d={Icons.arrow} size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
