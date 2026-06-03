"use client";

import { Suspense, useCallback, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { CompanyPreviewPanel } from "@/components/auth/BrandPanel";
import { StepProgress } from "@/components/auth/StepProgress";
import { IconSvg, Icons } from "@/components/nova/icons";
import { Spinner } from "@/components/nova/spinner";

/* ============================================================
   /register-company — multi-step tenant + admin signup.
   Migrated to design CSS (AuthLayout + auth-shell + .form-input + .btn primary).
   ============================================================ */

type Step = "company" | "admin" | "confirm" | "success";

const STEPS = [
  { id: "company", label: "Empresa" },
  { id: "admin", label: "Admin" },
  { id: "confirm", label: "Código" },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function RegisterCompanyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStep = (searchParams.get("step") as Step) || "company";
  const [step, setStep] = useState<Step>(initialStep);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [cognitoUsername, setCognitoUsername] = useState("");
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleCompanyNameChange = useCallback(
    (value: string) => {
      setCompanyName(value);
      if (!slugTouched) setCompanySlug(slugify(value));
    },
    [slugTouched]
  );

  function handleNextToAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!companyName.trim() || !companySlug.trim()) {
      setError("Nombre y slug de empresa son requeridos");
      return;
    }
    if (companySlug.length < 3) {
      setError("El slug debe tener al menos 3 caracteres");
      return;
    }
    setStep("admin");
  }

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
      const res = await fetch("/api/auth/register-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companySlug: companySlug.trim(),
          fullName: fullName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          password,
          nickname: companySlug.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al registrar la empresa");
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

      const signInResult = await signIn("cognito-credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push("/welcome");
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

  const currentStepIndex =
    step === "success" ? STEPS.length - 1 : STEPS.findIndex((s) => s.id === step);

  const brandPanel = (
    <CompanyPreviewPanel
      companyName={companyName}
      companySlug={companySlug}
    />
  );

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
              <IconSvg d={Icons.arrowLeft} size={14} /> Volver al login
            </Link>

            {step !== "success" && (
              <div style={{ marginBottom: 22 }}>
                <StepProgress steps={STEPS} currentIndex={currentStepIndex} />
              </div>
            )}

            <h2 className="auth-heading">
              {step === "company" && "Registra tu empresa"}
              {step === "admin" && "Crea tu cuenta de admin"}
              {step === "confirm" && "Verifica tu correo"}
              {step === "success" && "¡Empresa creada!"}
            </h2>
            <p className="auth-sub">
              {step === "company" && "Empieza por el nombre y el slug público."}
              {step === "admin" &&
                "Serás el administrador principal de la empresa."}
              {step === "confirm" && (
                <>
                  Enviamos un código a{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
                </>
              )}
              {step === "success" && "Todo listo. Inicia sesión para continuar."}
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

            {/* ── STEP: Company ── */}
            {step === "company" && (
              <form onSubmit={handleNextToAdmin}>
                <div className="form-group">
                  <label className="form-label" htmlFor="companyName">
                    Nombre de la empresa<span className="req">*</span>
                  </label>
                  <input
                    id="companyName"
                    className="form-input"
                    type="text"
                    placeholder="Mi Empresa SAC"
                    value={companyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="companySlug">
                    Identificador público (slug)<span className="req">*</span>
                  </label>
                  <input
                    id="companySlug"
                    className="form-input"
                    type="text"
                    placeholder="mi-empresa"
                    value={companySlug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setCompanySlug(slugify(e.target.value));
                    }}
                    required
                    disabled={isLoading}
                    style={{ fontFamily: "var(--font-mono)" }}
                  />
                  <span className="form-hint">
                    Solo letras, números y guiones. Se usa en la URL pública.
                  </span>
                </div>

                <button
                  type="submit"
                  className="btn primary btn-lg"
                  disabled={isLoading}
                  style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
                >
                  Continuar <IconSvg d={Icons.arrow} size={14} />
                </button>
              </form>
            )}

            {/* ── STEP: Admin ── */}
            {step === "admin" && (
              <form onSubmit={handleRegister}>
                <div
                  style={{
                    padding: 12,
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r)",
                    marginBottom: 14,
                    fontSize: 12,
                  }}
                >
                  <p style={{ color: "var(--text-muted)", margin: 0 }}>
                    Estás creando
                  </p>
                  <p
                    style={{
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      margin: "2px 0 0",
                    }}
                  >
                    {companyName}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-muted)",
                      margin: "2px 0 0",
                    }}
                  >
                    novasys.pe/{companySlug}
                  </p>
                </div>

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

                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Correo electrónico<span className="req">*</span>
                  </label>
                  <input
                    id="email"
                    className="form-input"
                    type="email"
                    placeholder="admin@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="email"
                  />
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
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="password">
                    Contraseña<span className="req">*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="password"
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

                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn outline btn-lg"
                    onClick={() => setStep("company")}
                    disabled={isLoading}
                  >
                    <IconSvg d={Icons.arrowLeft} size={14} /> Atrás
                  </button>
                  <button
                    type="submit"
                    className="btn primary btn-lg"
                    disabled={isLoading}
                    style={{ flex: 1, justifyContent: "center", gap: 8 }}
                  >
                    {isLoading ? (
                      <>
                        <Spinner size={14} /> Creando empresa…
                      </>
                    ) : (
                      "Crear empresa"
                    )}
                  </button>
                </div>
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
                    <IconSvg d={Icons.mail} size={32} />
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
                    "Confirmar y continuar"
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

            {/* ── STEP: Success fallback ── */}
            {step === "success" && (
              <>
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
                  Tu empresa y cuenta de admin fueron creadas. Inicia sesión para
                  continuar con el onboarding.
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

export default function RegisterCompanyPage() {
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
      <RegisterCompanyContent />
    </Suspense>
  );
}
