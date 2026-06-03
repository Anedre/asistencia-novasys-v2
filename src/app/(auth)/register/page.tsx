"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import {
  DefaultBrandPanel,
  TenantBrandPanel,
} from "@/components/auth/BrandPanel";
import { StepProgress } from "@/components/auth/StepProgress";
import { IconSvg, Icons } from "@/components/nova/icons";
import { Spinner } from "@/components/nova/spinner";

/* ============================================================
   /register — invite signup + email verification
   Migrated to design CSS: AuthLayout + auth-shell + .form-input + .btn primary.
   ============================================================ */

type Step = "register" | "confirm" | "success";

const STEPS = [
  { id: "register", label: "Datos" },
  { id: "confirm", label: "Código" },
  { id: "success", label: "Listo" },
];

interface InviteData {
  email: string;
  fullName: string;
  role?: string;
  area?: string;
  tenantName: string;
  tenantSlug: string;
  tenantLogoUrl: string | null;
  inviterName?: string;
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStep = (searchParams.get("step") as Step) || "register";
  const initialEmail = searchParams.get("email") || "";
  const inviteToken = searchParams.get("invite") || null;

  const [step, setStep] = useState<Step>(initialStep);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cognitoUsername, setCognitoUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/auth/validate-invite?token=${inviteToken}`
        );
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || "Invitación inválida o expirada");
          setInviteLoading(false);
          return;
        }

        setInviteData({
          email: data.invitation.email,
          fullName: data.invitation.fullName,
          role: data.invitation.role,
          area: data.invitation.area,
          tenantName: data.tenant.name,
          tenantSlug: data.tenant.slug,
          tenantLogoUrl: data.tenant.logoUrl,
          inviterName: data.invitation.invitedByName,
        });
        setEmail(data.invitation.email);
        if (data.invitation.fullName) {
          setFullName(data.invitation.fullName);
        }
      } catch {
        if (!cancelled) setError("Error al validar la invitación");
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          nickname: nickname.trim() || email.split("@")[0],
          ...(inviteToken ? { inviteToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al registrar la cuenta");
        return;
      }
      setCognitoUsername(data.username);
      setStep("confirm");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("El código debe tener 6 dígitos");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cognitoUsername,
          code: code.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al confirmar la cuenta");
        return;
      }
      setStep("success");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cognitoUsername }),
      });
      if (res.ok) {
        setResendCooldown(60);
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        const data = await res.json();
        setError(data.error || "Error al reenviar el código");
      }
    } catch {
      setError("Error de conexión");
    }
  }

  const brandPanel = inviteData ? (
    <TenantBrandPanel
      tenantName={inviteData.tenantName}
      tenantLogoUrl={inviteData.tenantLogoUrl}
      role={inviteData.role}
      area={inviteData.area}
      inviterName={inviteData.inviterName}
    />
  ) : (
    <DefaultBrandPanel />
  );

  if (inviteLoading) {
    return (
      <AuthLayout brandPanel={brandPanel}>
        <div className="auth-shell">
          {brandPanel}
          <div className="auth-pane">
            <div
              className="auth-form-wrap"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                minHeight: 200,
              }}
            >
              Validando invitación…
            </div>
          </div>
        </div>
      </AuthLayout>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <AuthLayout brandPanel={brandPanel}>
      <div className="auth-shell">
        {brandPanel}
        <div className="auth-pane">
          <div className="auth-form-wrap">
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--text-secondary)",
                textDecoration: "none",
                marginBottom: 20,
              }}
            >
              <IconSvg d={Icons.arrowLeft ?? Icons.arrow} size={14} /> Volver al login
            </Link>

            <div style={{ marginBottom: 22 }}>
              <StepProgress steps={STEPS} currentIndex={currentStepIndex} />
            </div>

            <h2 className="auth-heading">
              {step === "register" && (inviteData ? "Crea tu cuenta" : "Crear cuenta")}
              {step === "confirm" && "Verifica tu correo"}
              {step === "success" && "¡Todo listo!"}
            </h2>
            <p className="auth-sub">
              {step === "register" && inviteData && (
                <>
                  Únete a{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {inviteData.tenantName}
                  </strong>{" "}
                  completando el formulario.
                </>
              )}
              {step === "register" && !inviteData &&
                "Completa tus datos para registrarte."}
              {step === "confirm" && (
                <>
                  Enviamos un código de 6 dígitos a{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
                </>
              )}
              {step === "success" &&
                "Tu cuenta fue verificada correctamente. Ya puedes iniciar sesión."}
            </p>

            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--r)",
                  border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                  background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                  color: "var(--danger)",
                  fontSize: 13,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}
              >
                <IconSvg d={Icons.alert} size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* ── STEP: Register ── */}
            {step === "register" && (
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">
                    Nombre completo<span className="req">*</span>
                  </label>
                  <input
                    id="fullName"
                    className="form-input"
                    type="text"
                    placeholder="Juan Pérez"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="name"
                  />
                </div>

                {!inviteData && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="nickname">
                      Nickname<span className="req">*</span>
                    </label>
                    <input
                      id="nickname"
                      className="form-input"
                      type="text"
                      placeholder="juanp"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="username"
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-email">
                    Correo electrónico<span className="req">*</span>
                  </label>
                  <input
                    id="reg-email"
                    className="form-input"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading || !!inviteData}
                    readOnly={!!inviteData}
                    autoComplete="email"
                    style={inviteData ? { background: "var(--bg-subtle)" } : undefined}
                  />
                  {inviteData && (
                    <span className="form-hint">
                      El correo está vinculado a tu invitación
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="phoneNumber">
                    Teléfono<span className="req">*</span>
                  </label>
                  <input
                    id="phoneNumber"
                    className="form-input"
                    type="tel"
                    placeholder="+51999999999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="tel"
                  />
                  <span className="form-hint">
                    Formato internacional: +51 seguido del número
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-password">
                    Contraseña<span className="req">*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="reg-password"
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mín. 8 chars, mayúscula, número, símbolo"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="new-password"
                      style={{ paddingRight: 38 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                      }}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={showPassword}
                    >
                      <IconSvg d={showPassword ? Icons.eyeOff : Icons.eye} size={16} />
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">
                    Confirmar contraseña<span className="req">*</span>
                  </label>
                  <input
                    id="confirmPassword"
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  className="btn primary btn-lg"
                  disabled={isLoading}
                  style={{ width: "100%", justifyContent: "center", gap: 8, marginTop: 6 }}
                >
                  {isLoading ? (
                    <>
                      <Spinner size={14} /> Creando cuenta…
                    </>
                  ) : (
                    "Crear cuenta"
                  )}
                </button>
              </form>
            )}

            {/* ── STEP: Confirm ── */}
            {step === "confirm" && (
              <form onSubmit={handleConfirm}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      background: "var(--accent-soft)",
                      color: "var(--accent-strong)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconSvg d={Icons.mail ?? Icons.bell} size={32} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="code">
                    Código de verificación
                  </label>
                  <input
                    id="code"
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                    disabled={isLoading}
                    autoComplete="one-time-code"
                    maxLength={6}
                    style={{
                      textAlign: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 22,
                      letterSpacing: "0.4em",
                      height: 56,
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn primary btn-lg"
                  disabled={isLoading || code.length !== 6}
                  style={{ width: "100%", justifyContent: "center", gap: 8 }}
                >
                  {isLoading ? (
                    <>
                      <Spinner size={14} /> Verificando…
                    </>
                  ) : (
                    "Verificar cuenta"
                  )}
                </button>

                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0}
                    className="btn ghost"
                    style={{ fontSize: 12 }}
                  >
                    {resendCooldown > 0
                      ? `Reenviar código en ${resendCooldown}s`
                      : "Reenviar código"}
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP: Success ── */}
            {step === "success" && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
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
                </div>

                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    textAlign: "center",
                    marginBottom: 22,
                  }}
                >
                  Ya puedes iniciar sesión y empezar a usar el sistema.
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="btn primary btn-lg"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Ir al login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
            }}
          >
            Cargando…
          </div>
        </AuthLayout>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
