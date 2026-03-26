"use client";

import { Suspense, useState, useCallback } from "react";
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
  Building2,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  ArrowLeft,
  LogIn,
  ArrowRight,
} from "lucide-react";

type Step = "company" | "admin" | "confirm" | "success";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

  // Company form
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  // Admin form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Confirm form
  const [cognitoUsername, setCognitoUsername] = useState("");
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleCompanyNameChange = useCallback(
    (value: string) => {
      setCompanyName(value);
      if (!slugTouched) {
        setCompanySlug(slugify(value));
      }
    },
    [slugTouched]
  );

  const handleNextToAdmin = (e: React.FormEvent) => {
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
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }

    if (password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres");
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
      setError("Error de conexion. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError("El codigo debe tener 6 digitos");
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
      setError("Error de conexion. Intenta nuevamente.");
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
        setError(data.error || "Error al reenviar el codigo");
      }
    } catch {
      setError("Error de conexion");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl">
              {step === "company" && "Registra tu Empresa"}
              {step === "admin" && "Cuenta de Administrador"}
              {step === "confirm" && "Verificar Correo"}
              {step === "success" && "Empresa Registrada"}
            </CardTitle>
            <CardDescription className="mt-2">
              {step === "company" &&
                "Configura tu espacio de trabajo para tu equipo"}
              {step === "admin" &&
                "Crea la cuenta del administrador principal"}
              {step === "confirm" && (
                <>
                  Ingresa el codigo de 6 digitos enviado a{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </>
              )}
              {step === "success" &&
                "Tu empresa y cuenta han sido verificadas exitosamente"}
            </CardDescription>
          </div>

          {/* Step indicator */}
          {step !== "success" && (
            <div className="flex items-center justify-center gap-2">
              {["company", "admin", "confirm"].map((s, i) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s === step
                      ? "w-8 bg-primary"
                      : i < ["company", "admin", "confirm"].indexOf(step)
                      ? "w-8 bg-primary/50"
                      : "w-2 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* ── STEP: Company Info ── */}
          {step === "company" && (
            <form onSubmit={handleNextToAdmin} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="companyName">Nombre de la empresa</Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Mi Empresa S.A.C."
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  required
                  autoComplete="organization"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySlug">Identificador unico (slug)</Label>
                <Input
                  id="companySlug"
                  type="text"
                  placeholder="mi-empresa"
                  value={companySlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setCompanySlug(slugify(e.target.value));
                  }}
                  required
                  className="h-10 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Solo letras minusculas, numeros y guiones. Ej: mi-empresa
                </p>
              </div>

              <Button type="submit" className="w-full h-11 text-base" size="lg">
                Siguiente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          )}

          {/* ── STEP: Admin Account ── */}
          {step === "admin" && (
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="font-medium">{companyName}</span>
                <span className="text-muted-foreground ml-2">({companySlug})</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Perez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="name"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-email">Correo electronico</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="admin@miempresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Telefono</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+51999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="tel"
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">Contrasena</Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 chars, mayuscula, numero, simbolo"
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
                <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repite tu contrasena"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="h-10"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("company")}
                  disabled={isLoading}
                  className="h-11"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 h-11 text-base"
                  size="lg"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Building2 className="mr-2 h-5 w-5" />
                  )}
                  Registrar Empresa
                </Button>
              </div>
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
                <Label htmlFor="code">Codigo de verificacion</Label>
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
                    ? `Reenviar codigo en ${resendCooldown}s`
                    : "Reenviar codigo"}
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

              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{companyName}</p>
                <p className="text-muted-foreground">ha sido registrada exitosamente</p>
              </div>

              <p className="text-sm text-muted-foreground">
                Inicia sesion para acceder al panel de administracion de tu empresa.
              </p>

              <Button
                onClick={() => router.push("/login")}
                className="w-full h-11 text-base"
                size="lg"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Iniciar Sesion
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
                Volver a iniciar sesion
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Novasys. Todos los derechos reservados.
      </p>
    </div>
  );
}

export default function RegisterCompanyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <RegisterCompanyContent />
    </Suspense>
  );
}
