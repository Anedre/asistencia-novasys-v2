"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, Copy, Check, Mail, AlertTriangle } from "lucide-react";
import { useCreateInvitation } from "@/hooks/use-invitations";

interface InviteResult {
  inviteLink: string;
  emailSent: boolean;
  emailError?: string;
}

export function InviteEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [area, setArea] = useState("");
  const [position, setPosition] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const createInvite = useCreateInvitation();

  const inviteLink = result?.inviteLink ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = await createInvite.mutateAsync({
      email: email.trim(),
      fullName: fullName.trim() || undefined,
      area: area.trim() || undefined,
      position: position.trim() || undefined,
      role,
    });

    setResult({
      inviteLink: data.inviteLink,
      emailSent: data.emailSent ?? false,
      emailError: data.emailError,
    });
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setOpen(false);
    // Reset after close animation
    setTimeout(() => {
      setEmail("");
      setFullName("");
      setArea("");
      setPosition("");
      setRole("EMPLOYEE");
      setResult(null);
      setCopied(false);
      createInvite.reset();
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Invitar Empleado
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar Empleado</DialogTitle>
          <DialogDescription>
            Envia una invitacion para que un nuevo empleado se registre en tu empresa.
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {createInvite.error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {createInvite.error.message}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-email">Correo electronico *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="empleado@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={createInvite.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-name">Nombre completo</Label>
              <Input
                id="invite-name"
                type="text"
                placeholder="Juan Perez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={createInvite.isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="invite-area">Area</Label>
                <Input
                  id="invite-area"
                  type="text"
                  placeholder="Tecnologia"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  disabled={createInvite.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-position">Posicion</Label>
                <Input
                  id="invite-position"
                  type="text"
                  placeholder="Desarrollador"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  disabled={createInvite.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v as "EMPLOYEE" | "ADMIN")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Empleado</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={createInvite.isPending || !email}
              className="w-full"
            >
              {createInvite.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Crear Invitacion
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {result?.emailSent ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      Email enviado a {email}
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300/80">
                      Recibirá las instrucciones para crear su cuenta. Si no le
                      llega, comparte el link manualmente.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      No se pudo enviar el email automático
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/80">
                      La invitación está creada y el link es válido. Compártelo
                      manualmente con {email}.
                      {result?.emailError && (
                        <span className="mt-1 block font-mono text-[10px] opacity-75">
                          {result.emailError}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Link de invitación</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={inviteLink ?? ""}
                  readOnly
                  className="font-mono text-xs bg-muted"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expira en 7 días.
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={handleClose}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
