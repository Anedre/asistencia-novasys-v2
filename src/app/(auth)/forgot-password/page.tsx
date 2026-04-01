"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, KeyRound, ArrowLeft, CheckCircle } from "lucide-react";

type Step = "email" | "code" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Ingresa tu correo electronico");
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
      if (!res.ok) throw new Error(data.error || "Error al enviar el codigo");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Ingresa el codigo de verificacion");
      return;
    }
    if (newPassword.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar la contrasena");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-background p-8 shadow-lg">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            {step === "done" ? (
              <CheckCircle className="h-7 w-7 text-primary" />
            ) : step === "code" ? (
              <KeyRound className="h-7 w-7 text-primary" />
            ) : (
              <Mail className="h-7 w-7 text-primary" />
            )}
          </div>
          <h1 className="mt-4 text-xl font-bold">
            {step === "done"
              ? "Contrasena actualizada"
              : step === "code"
                ? "Ingresa el codigo"
                : "Recuperar contrasena"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "done"
              ? "Tu contrasena ha sido cambiada exitosamente"
              : step === "code"
                ? `Enviamos un codigo de verificacion a ${email}`
                : "Te enviaremos un codigo de verificacion a tu correo"}
          </p>
        </div>

        {/* Step 1: Email */}
        {step === "email" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electronico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Enviar codigo"
              )}
            </Button>
          </form>
        )}

        {/* Step 2: Code + New Password */}
        {step === "code" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Codigo de verificacion</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contrasena</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Minimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu nueva contrasena"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Cambiar contrasena"
              )}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setError(""); }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Reenviar codigo
            </button>
          </form>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <Link href="/login">
            <Button className="w-full">Ir a iniciar sesion</Button>
          </Link>
        )}

        {/* Back to login */}
        {step !== "done" && (
          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al inicio de sesion
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
