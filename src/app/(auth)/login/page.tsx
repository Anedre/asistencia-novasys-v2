"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { DefaultBrandPanel, NovaDesignLogo } from "@/components/auth/BrandPanel";
import { IconSvg, Icons } from "@/components/nova/icons";
import { Spinner } from "@/components/nova/spinner";

/* ============================================================
   SSO logo SVGs (matching original)
   ============================================================ */

function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a11 11 0 000 9.86l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.466 2.27-1.232 3.073-.79.829-2.082 1.473-3.166 1.389-.124-1.106.466-2.247 1.193-2.954.79-.79 2.184-1.443 3.205-1.508zM21 16.7c-.93 1.355-1.927 2.704-3.495 2.733-1.555.029-2.06-.91-3.85-.91-1.793 0-2.348.88-3.83.94-1.527.06-2.69-1.47-3.63-2.81-1.93-2.75-3.4-7.79-1.42-11.18.99-1.68 2.76-2.74 4.69-2.77 1.5-.03 2.92.99 3.84.99.91 0 2.65-1.23 4.46-1.05.76.03 2.88.3 4.25 2.25-.11.07-2.53 1.46-2.5 4.38.03 3.48 3.07 4.64 3.1 4.66-.02.08-.49 1.65-1.6 3.27z" />
    </svg>
  );
}

/* ============================================================
   Login Content — mirrors auth.jsx Login component
   ============================================================ */

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("cognito-credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.ok) {
        router.push(callbackUrl);
      } else if (result?.error) {
        if (result.error === "USER_NOT_CONFIRMED") {
          router.push(`/register?step=confirm&email=${encodeURIComponent(email.trim())}`);
          return;
        }
        setError(
          result.error === "CredentialsSignin"
            ? "Correo o contraseña incorrectos"
            : result.error
        );
      }
    } catch {
      setError("Error inesperado. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <DefaultBrandPanel />
      <div className="auth-pane">
        <div className="auth-form-wrap">
          <NovaDesignLogo size={32} />
          <h2 className="auth-heading" style={{ marginTop: 36 }}>
            Bienvenido de vuelta
          </h2>
          <p className="auth-sub">Inicia sesión para continuar a tu panel.</p>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "10px 12px",
                borderRadius: "var(--r)",
                border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                color: "var(--danger)",
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              <IconSvg d={Icons.alert} size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <button
              type="button"
              className="btn outline btn-lg"
              disabled={loading}
              onClick={() => signIn("google", { callbackUrl })}
              style={{ width: "100%", justifyContent: "center", gap: 10, marginBottom: 8 }}
            >
              <GoogleLogo size={16} />
              Continuar con Google
            </button>
            <button
              type="button"
              className="btn outline btn-lg"
              disabled={loading}
              onClick={() => signIn("apple", { callbackUrl })}
              style={{ width: "100%", justifyContent: "center", gap: 10 }}
            >
              <AppleLogo size={16} />
              Continuar con Apple
            </button>

            <div className="auth-divider">o con email</div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Correo corporativo
              </label>
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
                  <IconSvg d={Icons.mail} size={15} />
                </span>
                <input
                  id="email"
                  className="form-input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  placeholder="tu@empresa.com"
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  style={{ paddingLeft: 38 }}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label className="form-label" htmlFor="password">
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  className="btn-ghost-link"
                  style={{ padding: 0, fontSize: 11 }}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
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
                  id="password"
                  className="form-input"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  style={{ paddingLeft: 38, paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  className="btn ghost btn-sm"
                  aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPwd}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    padding: 6,
                  }}
                >
                  <IconSvg d={showPwd ? Icons.eyeOff : Icons.eye} size={15} />
                </button>
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 18,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={keepSignedIn}
                onChange={(e) => setKeepSignedIn(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              Mantener sesión iniciada
            </label>

            <button
              type="submit"
              className="btn primary btn-lg"
              disabled={loading || !email.trim() || !password}
              style={{ width: "100%", justifyContent: "center", gap: 8 }}
            >
              {loading ? (
                <>
                  <Spinner size={14} /> Iniciando sesión…
                </>
              ) : (
                <>
                  Iniciar sesión <IconSvg d={Icons.arrow} size={14} />
                </>
              )}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-secondary)",
              marginTop: 20,
            }}
          >
            ¿No tienes cuenta?{" "}
            <Link
              href="/register-company"
              style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
            >
              Registra tu empresa
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "var(--text-muted)" }}>Cargando…</span>
        </div>
      }
    >
      <AuthLayout>
        <LoginContent />
      </AuthLayout>
    </Suspense>
  );
}
