"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  ArrowLeft,
  LogIn,
} from "lucide-react";

type Step = "register" | "confirm" | "success";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialStep = (searchParams.get("step") as Step) || "register";
  const initialEmail = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>(initialStep);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Register form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Confirm form
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleRegister = async (e: React.FormEvent) => {
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrar la cuenta");
        return;
      }

      setStep("confirm");
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
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
          email: email.trim(),
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
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError(null);

    try {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
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
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
            N
          </div>
          <div>
            <CardTitle className="text-2xl">
              {step === "register" && "Crear Cuenta"}
              {step === "confirm" && "Verificar Correo"}
              {step === "success" && "Cuenta Creada"}
            </CardTitle>
            <CardDescription className="mt-2">
              {step === "register" &&
                "Completa el formulario para registrarte"}
              {step === "confirm" && (
                <>
                  Ingresa el código de 6 dígitos enviado a{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </>
              )}
              {step === "success" &&
                "Tu cuenta ha sido verificada exitosamente"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {/* ── STEP: Register ── */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="name"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email">Correo electrónico</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mín. 8 chars, mayúscula, número, símbolo"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="new-password"
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="h-10"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 text-base"
                size="lg"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-5 w-5" />
                )}
                Crear Cuenta
              </Button>
            </form>
          )}

          {/* ── STEP: Confirm ── */}
          {step === "confirm" && (
            <form onSubmit={handleConfirm} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Código de verificación</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  disabled={isLoading}
                  autoComplete="one-time-code"
                  className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full h-11 text-base"
                size="lg"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                )}
                Verificar Cuenta
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0}
                  className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
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
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Tu cuenta ha sido creada y verificada. Ya puedes iniciar sesión.
              </p>

              <Button
                onClick={() => router.push("/login")}
                className="w-full h-11 text-base"
                size="lg"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Ir a Iniciar Sesión
              </Button>
            </div>
          )}

          {/* ── Footer link ── */}
          {step !== "success" && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a iniciar sesión
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Novasys. Todos los derechos
        reservados.
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
