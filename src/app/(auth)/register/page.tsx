"use client";

import { Suspense, useState, useEffect } from "react";
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
  Building2,
} from "lucide-react";

type Step = "register" | "confirm" | "success";

interface InviteData {
  email: string;
  fullName: string;
  tenantName: string;
  tenantSlug: string;
  tenantLogoUrl: string | null;
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

  // Register form
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cognitoUsername, setCognitoUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Confirm form
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Validate invite token on mount
  useEffect(() => {
    if (!inviteToken) return;

    async function validateInvite() {
      try {
        const res = await fetch(`/api/auth/validate-invite?token=${inviteToken}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Invitacion invalida");
          setInviteLoading(false);
          return;
        }

        setInviteData({
          email: data.invitation.email,
          fullName: data.invitation.fullName,
          tenantName: data.tenant.name,
          tenantSlug: data.tenant.slug,
          tenantLogoUrl: data.tenant.logoUrl,
        });
        setEmail(data.invitation.email);
        if (data.invitation.fullName) {
          setFullName(data.invitation.fullName);
        }
      } catch {
        setError("Error al validar la invitacion");
      } finally {
        setInviteLoading(false);
      }
    }

    validateInvite();
  }, [inviteToken]);

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

  if (inviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">
            {inviteData?.tenantLogoUrl ? (
              <img src={inviteData.tenantLogoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              "N"
            )}
          </div>
          <div>
            <CardTitle className="text-2xl">
              {step === "register" && "Crear Cuenta"}
              {step === "confirm" && "Verificar Correo"}
              {step === "success" && "Cuenta Creada"}
            </CardTitle>
            <CardDescription className="mt-2">
              {step === "register" && inviteData && (
                <span className="flex items-center justify-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Uniendote a <span className="font-medium text-foreground">{inviteData.tenantName}</span>
                </span>
              )}
              {step === "register" && !inviteData &&
                "Completa el formulario para registrarte"}
              {step === "confirm" && (
                <>
                  Ingresa el codigo de 6 digitos enviado a{" "}
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
                  placeholder="Juan Perez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="name"
                  className="h-10"
                />
              </div>

              {!inviteData && (
                <div className="space-y-2">
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    type="text"
                    placeholder="juanp"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="username"
                    className="h-10"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reg-email">Correo electronico</Label>
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
                  className={`h-10 ${inviteData ? "bg-muted" : ""}`}
                />
                {inviteData && (
                  <p className="text-xs text-muted-foreground">
                    El correo esta vinculado a tu invitacion
                  </p>
                )}
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
                <p className="text-xs text-muted-foreground">
                  Formato internacional: +51 seguido del numero
                </p>
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

              <p className="text-sm text-muted-foreground">
                Tu cuenta ha sido creada y verificada. Inicia sesion para completar tu perfil.
              </p>

              <Button
                onClick={() => router.push("/login")}
                className="w-full h-11 text-base"
                size="lg"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Iniciar Sesion y Completar Perfil
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
