"use client";

import { Suspense, useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  ArrowRight,
  LogIn,
  AlertTriangle,
  User,
  Phone,
  Lock,
  Sparkles,
  AtSign,
} from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { CompanyPreviewPanel } from "@/components/auth/BrandPanel";
import { StepProgress } from "@/components/auth/StepProgress";

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

      // Auto sign-in so the new admin lands on the onboarding wizard
      // without a login step in the middle.
      const signInResult = await signIn("cognito-credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push("/welcome");
        return;
      }

      // Fallback: couldn't auto-sign-in, show success step with login CTA.
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

  return (
    <AuthLayout
      brandPanel={
        <CompanyPreviewPanel
          companyName={companyName}
          companySlug={companySlug}
        />
      }
    >
      <div className="space-y-8">
        {/* Progress */}
        {step !== "success" && (
          <StepProgress steps={STEPS} currentIndex={currentStepIndex} />
        )}

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {step === "company" && "Registra tu empresa"}
            {step === "admin" && "Crea tu cuenta de admin"}
            {step === "confirm" && "Verifica tu correo"}
            {step === "success" && "¡Empresa creada!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "company" && "Empieza por el nombre y el slug público."}
            {step === "admin" &&
              "Serás el administrador principal de la empresa."}
            {step === "confirm" && (
              <>
                Enviamos un código a{" "}
                <strong className="text-foreground">{email}</strong>
              </>
            )}
            {step === "success" && "Todo listo. Inicia sesión para continuar."}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP: Company ── */}
        {step === "company" && (
          <form onSubmit={handleNextToAdmin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Nombre de la empresa</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Mi Empresa SAC"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companySlug">Identificador público (slug)</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                  disabled={isLoading}
                  className="h-11 pl-10 font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Solo letras, números y guiones. Se usa en la URL pública.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full text-base font-medium"
            >
              Continuar
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Volver al login
              </Link>
            </div>
          </form>
        )}

        {/* ── STEP: Admin ── */}
        {step === "admin" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="text-muted-foreground">Estás creando</p>
              <p className="font-semibold">{companyName}</p>
              <p className="font-mono text-muted-foreground">
                novasys.pe/{companySlug}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Juan Pérez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="name"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+51999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="tel"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mín. 8 chars, mayúscula, número, símbolo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="h-11 pl-10 pr-10"
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

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("company")}
                disabled={isLoading}
                className="h-12"
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Atrás
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 flex-1 text-base font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creando empresa…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" /> Crear empresa
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* ── STEP: Confirm ── */}
        {step === "confirm" && (
          <form onSubmit={handleConfirm} className="space-y-5">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-10 w-10 text-primary" />
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
                required
                disabled={isLoading}
                autoComplete="one-time-code"
                className="h-14 text-center text-3xl tracking-[0.5em] font-mono"
                maxLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="h-12 w-full text-base font-medium"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-5 w-5" />
              )}
              Confirmar y continuar
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

        {/* ── STEP: Success fallback ── */}
        {step === "success" && (
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Tu empresa y cuenta de admin fueron creadas. Inicia sesión para
              continuar con el onboarding.
            </p>
            <Button
              onClick={() => router.push("/login")}
              className="h-12 w-full text-base font-medium"
            >
              <LogIn className="mr-2 h-5 w-5" /> Ir al login
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
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
