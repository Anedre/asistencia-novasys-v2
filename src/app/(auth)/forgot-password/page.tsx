"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { DefaultBrandPanel, NovaDesignLogo } from "@/components/auth/BrandPanel";
import { IconSvg, Icons } from "@/components/nova/icons";
import { Spinner } from "@/components/nova/spinner";

type Step = "email" | "code" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Ingresa tu correo electrónico");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar el código");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Ingresa el código de verificación");
      return;
    }
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar la contraseña");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-shell">
        <DefaultBrandPanel />
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
                marginBottom: 28,
              }}
            >
              <IconSvg d={Icons.arrowLeft} size={14} /> Volver al inicio
            </Link>

            {step === "email" && (
              <>
                <NovaDesignLogo size={32} />
                <h2 className="auth-heading" style={{ marginTop: 28 }}>
                  Recuperar contraseña
                </h2>
                <p className="auth-sub">Te enviaremos un código para restablecerla.</p>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--r)",
                      border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                      background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                      color: "var(--danger)",
                      fontSize: 13,
                      marginBottom: 14,
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleRequestCode}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">
                      Correo corporativo<span className="req">*</span>
                    </label>
                    <input
                      id="email"
                      className="form-input"
                      type="email"
                      placeholder="tu@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      autoFocus
                      disabled={loading}
                    />
                    <span className="form-hint">
                      Usa el correo con el que iniciaste sesión por última vez.
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="btn primary btn-lg"
                    disabled={loading || !email.trim()}
                    style={{ width: "100%", justifyContent: "center", gap: 8 }}
                  >
                    {loading ? (
                      <>
                        <Spinner size={14} /> Enviando…
                      </>
                    ) : (
                      <>
                        Enviar código <IconSvg d={Icons.send} size={14} />
                      </>
                    )}
                  </button>
                </form>

                <div
                  style={{
                    marginTop: 28,
                    padding: 14,
                    background: "var(--bg-subtle)",
                    borderRadius: "var(--r)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                      <IconSvg d={Icons.helpCircle} size={18} />
                    </span>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      <strong style={{ color: "var(--text-primary)" }}>
                        ¿No tienes acceso a tu correo?
                      </strong>
                      <p style={{ margin: "4px 0 0" }}>
                        Contacta a tu administrador o escríbenos a{" "}
                        <a
                          href="mailto:soporte@novaassistance.com"
                          style={{ color: "var(--accent)" }}
                        >
                          soporte@novaassistance.com
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === "code" && (
              <>
                <h2 className="auth-heading">Ingresa el código</h2>
                <p className="auth-sub">
                  Enviamos un código a{" "}
                  <strong style={{ color: "var(--text-primary)" }}>{email}</strong>
                </p>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--r)",
                      border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                      background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                      color: "var(--danger)",
                      fontSize: 13,
                      marginBottom: 14,
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleResetPassword}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-code">Código de verificación</label>
                    <input
                      id="reset-code"
                      className="form-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="123456"
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      style={{
                        textAlign: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: 22,
                        letterSpacing: "0.4em",
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="new-password">Nueva contraseña</label>
                    <div style={{ position: "relative" }}>
                      <span
                        style={{
                          position: "absolute",
                          left: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                          pointerEvents: "none",
                        }}
                      >
                        <IconSvg d={Icons.lock} size={15} />
                      </span>
                      <input
                        id="new-password"
                        className="form-input"
                        type="password"
                        placeholder="Mínimo 8 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        style={{ paddingLeft: 38 }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="confirm-password">Confirmar contraseña</label>
                    <div style={{ position: "relative" }}>
                      <span
                        style={{
                          position: "absolute",
                          left: 12,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--text-muted)",
                          pointerEvents: "none",
                        }}
                      >
                        <IconSvg d={Icons.lock} size={15} />
                      </span>
                      <input
                        id="confirm-password"
                        className="form-input"
                        type="password"
                        placeholder="Repite tu nueva contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        style={{ paddingLeft: 38 }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn primary btn-lg"
                    disabled={loading || code.length !== 6 || !newPassword || !confirmPassword}
                    style={{ width: "100%", justifyContent: "center", gap: 8 }}
                  >
                    {loading ? (
                      <>
                        <Spinner size={14} /> Actualizando…
                      </>
                    ) : (
                      <>
                        Cambiar contraseña <IconSvg d={Icons.check} size={14} />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setError("");
                    }}
                    className="btn ghost"
                    style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: 12 }}
                  >
                    Reenviar código
                  </button>
                </form>
              </>
            )}

            {step === "done" && (
              <>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "color-mix(in srgb, var(--success) 14%, transparent)",
                    color: "var(--success)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                >
                  <IconSvg d={Icons.check} size={26} />
                </div>
                <h2 className="auth-heading">¡Contraseña actualizada!</h2>
                <p className="auth-sub">
                  Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
                <Link
                  className="btn primary btn-lg"
                  href="/login"
                  style={{ width: "100%", justifyContent: "center", textDecoration: "none" }}
                >
                  Ir al login
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
