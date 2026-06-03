"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { IconSvg, Icons } from "@/components/nova/icons";

/* ============================================================
   Auth error page — uses the design's `.panel` + `.btn primary`
   inside AuthLayout, matching login/forgot-password style.
   ============================================================ */

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "Hay un problema con la configuración del servidor.",
    AccessDenied: "No tienes permisos para acceder a esta página.",
    Verification: "El token de verificación ha expirado o ya fue usado.",
    Default: "Ocurrió un error inesperado.",
  };

  const message = error
    ? errorMessages[error] || errorMessages.Default
    : errorMessages.Default;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="panel" style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--danger) 14%, transparent)",
            color: "var(--danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <IconSvg d={Icons.alert} size={28} />
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Error de Autenticación
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            margin: "8px 0 24px",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <Link
          href="/login"
          className="btn primary btn-lg"
          style={{ width: "100%", justifyContent: "center" }}
        >
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <AuthLayout hideTabs>
      <Suspense
        fallback={
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
        }
      >
        <ErrorContent />
      </Suspense>
    </AuthLayout>
  );
}
