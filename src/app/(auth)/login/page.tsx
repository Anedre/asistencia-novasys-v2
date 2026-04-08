"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LogIn,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertTriangle,
  Building2,
  UserPlus,
} from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";

function LoginContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    setIsLoading(true);

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
          router.push(
            `/register?step=confirm&email=${encodeURIComponent(email.trim())}`
          );
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
      setIsLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Brand on mobile (hidden on desktop because brand panel covers it) */}
      <div className="flex items-center justify-center gap-2 lg:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-lg font-bold">N</span>
        </div>
        <span className="text-lg font-semibold">Novasys Asistencia</span>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Bienvenido de vuelta</h1>
        <p className="text-sm text-muted-foreground">
          Ingresa a tu cuenta para continuar
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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
              required
              disabled={isLoading}
              autoComplete="email"
              className="h-12 pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              className="h-12 pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar" : "Mostrar"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
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
              Iniciando sesión…
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-5 w-5" />
              Iniciar sesión
            </>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">
            ¿Primera vez?
          </span>
        </div>
      </div>

      {/* Secondary actions */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href="/register-company"
          className="group flex items-center gap-2 rounded-lg border bg-background p-3 text-sm transition hover:border-primary hover:bg-primary/5"
        >
          <Building2 className="h-4 w-4 text-primary" />
          <span className="flex-1">
            <span className="block font-medium">Registrar empresa</span>
            <span className="text-xs text-muted-foreground">
              Crea tu cuenta admin
            </span>
          </span>
        </Link>
        <Link
          href="/register"
          className="group flex items-center gap-2 rounded-lg border bg-background p-3 text-sm transition hover:border-primary hover:bg-primary/5"
        >
          <UserPlus className="h-4 w-4 text-primary" />
          <span className="flex-1">
            <span className="block font-medium">Tengo una invitación</span>
            <span className="text-xs text-muted-foreground">
              Únete con un link
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthLayout>
        <LoginContent />
      </AuthLayout>
    </Suspense>
  );
}
