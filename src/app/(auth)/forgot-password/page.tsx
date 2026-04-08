"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Mail,
  KeyRound,
  ArrowLeft,
  CheckCircle,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { StepProgress } from "@/components/auth/StepProgress";

type Step = "email" | "code" | "done";

const STEPS = [
  { id: "email", label: "Correo" },
  { id: "code", label: "Código" },
  { id: "done", label: "Listo" },
];

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
      if (!res.ok)
        throw new Error(data.error || "Error al cambiar la contraseña");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <AuthLayout>
      <div className="space-y-8">
        <StepProgress steps={STEPS} currentIndex={currentStepIndex} />

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {step === "email" && "Recuperar contraseña"}
            {step === "code" && "Cambia tu contraseña"}
            {step === "done" && "¡Contraseña actualizada!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "email" &&
              "Te enviaremos un código de verificación a tu correo."}
            {step === "code" && (
              <>
                Enviamos un código a{" "}
                <strong className="text-foreground">{email}</strong>
              </>
            )}
            {step === "done" && "Ya puedes iniciar sesión con tu nueva contraseña."}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP: Email ── */}
        {step === "email" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  className="h-12 pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Mail className="mr-2 h-5 w-5" />
              )}
              Enviar código
            </Button>
          </form>
        )}

        {/* ── STEP: Code + new password ── */}
        {step === "code" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-10 w-10 text-primary" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="code">Código de verificación</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                autoFocus
                maxLength={6}
                className="h-14 text-center text-3xl tracking-[0.5em] font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-12 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite tu nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full text-base font-medium"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-5 w-5" />
              )}
              Cambiar contraseña
            </Button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError("");
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Reenviar código
            </button>
          </form>
        )}

        {/* ── STEP: Done ── */}
        {step === "done" && (
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <Link href="/login">
              <Button className="h-12 w-full text-base font-medium">
                Ir al login
              </Button>
            </Link>
          </div>
        )}

        {step !== "done" && (
          <div className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver al login
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
