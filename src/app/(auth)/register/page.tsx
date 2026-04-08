"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
  User,
  Phone,
  Lock,
  AtSign,
} from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import {
  DefaultBrandPanel,
  TenantBrandPanel,
} from "@/components/auth/BrandPanel";
import { StepProgress } from "@/components/auth/StepProgress";

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

  // Pick which brand panel to show
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    );
  }

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <AuthLayout brandPanel={brandPanel}>
      <div className="space-y-8">
        {/* Progress */}
        <StepProgress steps={STEPS} currentIndex={currentStepIndex} />

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            {step === "register" && (inviteData ? "Crea tu cuenta" : "Crear cuenta")}
            {step === "confirm" && "Verifica tu correo"}
            {step === "success" && "¡Todo listo!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "register" && inviteData && (
              <>
                Únete a <strong className="text-foreground">{inviteData.tenantName}</strong> completando el formulario.
              </>
            )}
            {step === "register" && !inviteData &&
              "Completa tus datos para registrarte."}
            {step === "confirm" && (
              <>
                Enviamos un código de 6 dígitos a{" "}
                <strong className="text-foreground">{email}</strong>
              </>
            )}
            {step === "success" &&
              "Tu cuenta fue verificada correctamente. Ya puedes iniciar sesión."}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP: Register ── */}
        {step === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
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

            {!inviteData && (
              <div className="space-y-1.5">
                <Label htmlFor="nickname">Nickname</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="juanp"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="username"
                    className="h-11 pl-10"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="reg-email">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || !!inviteData}
                  readOnly={!!inviteData}
                  autoComplete="email"
                  className={`h-11 pl-10 ${inviteData ? "bg-muted" : ""}`}
                />
              </div>
              {inviteData && (
                <p className="text-xs text-muted-foreground">
                  El correo está vinculado a tu invitación
                </p>
              )}
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
              <p className="text-xs text-muted-foreground">
                Formato internacional: +51 seguido del número
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-password"
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

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full text-base font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creando cuenta…
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-5 w-5" />
                  Crear cuenta
                </>
              )}
            </Button>
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
              Verificar cuenta
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
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Ya puedes iniciar sesión y empezar a usar el sistema.
            </p>

            <Button
              onClick={() => router.push("/login")}
              className="h-12 w-full text-base font-medium"
            >
              <LogIn className="mr-2 h-5 w-5" /> Ir al login
            </Button>
          </div>
        )}

        {/* Footer link */}
        {step !== "success" && (
          <div className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al login
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
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
