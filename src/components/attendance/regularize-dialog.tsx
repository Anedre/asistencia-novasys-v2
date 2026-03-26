"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_REASON_OPTIONS } from "@/lib/constants/reason-codes";
import { ClockIcon, CheckCircle2Icon, AlertCircleIcon, LoaderIcon } from "lucide-react";

// Filter out CARGA_INICIAL — not a user-facing reason
const EMPLOYEE_REASON_OPTIONS = ALL_REASON_OPTIONS.filter(
  (o) => o.value !== "CARGA_INICIAL"
);

interface RegularizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workDate: string; // "YYYY-MM-DD"
}

export function RegularizeDialog({
  open,
  onOpenChange,
  workDate,
}: RegularizeDialogProps) {
  const queryClient = useQueryClient();

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [reasonCode, setReasonCode] = useState("OLVIDO_MARCACION");
  const [reasonNote, setReasonNote] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/employee/regularize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate,
          startTime,
          endTime,
          breakMinutes,
          reasonCode,
          reasonNote: reasonNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al regularizar");
      return data as { ok: boolean; mode: string; message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  // Compute worked hours for preview
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const totalMin = eh * 60 + em - (sh * 60 + sm);
  const workedMin = Math.max(0, totalMin - breakMinutes);
  const workedH = Math.floor(workedMin / 60);
  const workedM = workedMin % 60;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const resetAndClose = () => {
    mutation.reset();
    setStartTime("09:00");
    setEndTime("18:00");
    setBreakMinutes(60);
    setReasonCode("OLVIDO_MARCACION");
    setReasonNote("");
    onOpenChange(false);
  };

  // Success state
  if (mutation.isSuccess) {
    const isPending = mutation.data?.mode === "PENDING_APPROVAL";
    return (
      <Dialog open={open} onOpenChange={resetAndClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-green-600" />
              {isPending ? "Solicitud creada" : "Regularizado"}
            </DialogTitle>
            <DialogDescription>
              {mutation.data?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={resetAndClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClockIcon className="size-5" />
              Regularizar {workDate}
            </DialogTitle>
            <DialogDescription>
              Ingresa las horas que trabajaste este dia.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            {/* Time inputs row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-start">Hora entrada</Label>
                <Input
                  id="reg-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-end">Hora salida</Label>
                <Input
                  id="reg-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Break minutes */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-break">Minutos de descanso</Label>
              <Input
                id="reg-break"
                type="number"
                min={0}
                max={480}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
              />
            </div>

            {/* Worked preview */}
            {totalMin > 0 && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                Horas trabajadas:{" "}
                <span className="font-semibold">
                  {String(workedH).padStart(2, "0")}:{String(workedM).padStart(2, "0")}
                </span>
              </div>
            )}

            {/* Reason code */}
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select
                value={reasonCode}
                onValueChange={(val) => setReasonCode(val as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_REASON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note */}
            {(reasonCode === "OTRO" || reasonCode === "PERMISO") && (
              <div className="space-y-1.5">
                <Label htmlFor="reg-note">
                  Nota {reasonCode === "OTRO" ? "(obligatorio)" : "(opcional)"}
                </Label>
                <Textarea
                  id="reg-note"
                  placeholder="Describe el motivo..."
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  maxLength={500}
                  required={reasonCode === "OTRO"}
                />
              </div>
            )}

            {/* Error */}
            {mutation.isError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                {(mutation.error as Error).message}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <DialogClose
              render={<Button variant="outline" type="button" />}
            >
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && (
                <LoaderIcon className="mr-2 size-4 animate-spin" />
              )}
              Regularizar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
