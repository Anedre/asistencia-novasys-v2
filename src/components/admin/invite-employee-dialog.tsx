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
import { UserPlus, Loader2, Copy, Check, Link2 } from "lucide-react";
import { useCreateInvitation } from "@/hooks/use-invitations";

export function InviteEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [area, setArea] = useState("");
  const [position, setPosition] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "ADMIN">("EMPLOYEE");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createInvite = useCreateInvitation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createInvite.mutateAsync({
      email: email.trim(),
      fullName: fullName.trim() || undefined,
      area: area.trim() || undefined,
      position: position.trim() || undefined,
      role,
    });

    setInviteLink(result.inviteLink);
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
      setInviteLink(null);
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
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-center">
              <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                Invitacion creada exitosamente
              </p>
            </div>

            <div className="space-y-2">
              <Label>Link de invitacion</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={inviteLink}
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
                Comparte este link con {email}. Expira en 7 dias.
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
