"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useCreateRequest } from "@/hooks/use-requests";
import { ALL_REASON_OPTIONS } from "@/lib/constants/reason-codes";
import { REQUEST_TYPE_LABELS } from "@/lib/constants/event-types";
import type { RequestType, CreateRequestInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const REQUEST_TYPES: { value: RequestType; label: string }[] = [
  { value: "REGULARIZATION_SINGLE", label: REQUEST_TYPE_LABELS.REGULARIZATION_SINGLE },
  { value: "REGULARIZATION_RANGE", label: REQUEST_TYPE_LABELS.REGULARIZATION_RANGE },
  { value: "PERMISSION", label: REQUEST_TYPE_LABELS.PERMISSION },
  { value: "VACATION", label: REQUEST_TYPE_LABELS.VACATION },
];

const isRegularization = (type: RequestType) =>
  type === "REGULARIZATION_SINGLE" || type === "REGULARIZATION_RANGE";

const isRangeType = (type: RequestType) =>
  type === "REGULARIZATION_RANGE" || type === "PERMISSION" || type === "VACATION";

export default function NewRequestPage() {
  const router = useRouter();
  const createMutation = useCreateRequest();

  const [requestType, setRequestType] = useState<RequestType>("REGULARIZATION_SINGLE");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateRequestInput = {
      requestType,
      reasonCode,
      reasonNote: reasonNote.trim() || undefined,
    };

    if (isRangeType(requestType)) {
      payload.dateFrom = dateFrom;
      payload.dateTo = dateTo;
    } else {
      payload.effectiveDate = effectiveDate;
    }

    if (isRegularization(requestType)) {
      payload.startTime = startTime;
      payload.endTime = endTime;
      payload.breakMinutes = breakMinutes;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        router.push("/requests");
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/requests" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nueva Solicitud</h1>
          <p className="text-muted-foreground">
            Crea una nueva solicitud de regularizacion o permiso
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Datos de la solicitud</CardTitle>
          <CardDescription>Completa los campos para enviar tu solicitud</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Request Type */}
            <div className="space-y-2">
              <Label htmlFor="requestType">Tipo de solicitud</Label>
              <select
                id="requestType"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as RequestType)}
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {REQUEST_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date fields */}
            {isRangeType(requestType) ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateFrom">Fecha inicio</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateTo">Fecha fin</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Fecha</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                />
              </div>
            )}

            {/* Time fields — only for regularizations */}
            {isRegularization(requestType) && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Hora entrada</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Hora salida</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breakMinutes">Break (min)</Label>
                  <Input
                    id="breakMinutes"
                    type="number"
                    min={0}
                    max={120}
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            {/* Reason Code */}
            <div className="space-y-2">
              <Label htmlFor="reasonCode">Motivo</Label>
              <select
                id="reasonCode"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
                required
                className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="" disabled>
                  Selecciona un motivo
                </option>
                {ALL_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Reason Note */}
            <div className="space-y-2">
              <Label htmlFor="reasonNote">Nota adicional (opcional)</Label>
              <Textarea
                id="reasonNote"
                placeholder="Detalle adicional sobre tu solicitud..."
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                rows={3}
              />
            </div>

            {/* Error message */}
            {createMutation.isError && (
              <p className="text-sm text-destructive">
                {(createMutation.error as Error).message}
              </p>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" render={<Link href="/requests" />}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                <Send className="h-4 w-4" />
                {createMutation.isPending ? "Enviando..." : "Enviar solicitud"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
