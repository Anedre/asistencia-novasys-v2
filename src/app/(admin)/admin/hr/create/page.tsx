"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCreateHREvent } from "@/hooks/use-hr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EVENT_TYPES = [
  { value: "ANNOUNCEMENT", label: "Comunicado" },
  { value: "HOLIDAY", label: "Feriado" },
  { value: "BIRTHDAY", label: "Cumpleaños" },
  { value: "WORK_ANNIVERSARY", label: "Aniversario Laboral" },
] as const;

export default function CreateHREventPage() {
  const router = useRouter();
  const createMutation = useCreateHREvent();

  const [type, setType] = useState("ANNOUNCEMENT");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [audience, setAudience] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await createMutation.mutateAsync({
        type,
        title,
        message,
        eventDate,
        ...(audience && { audience }),
        ...(imageUrl && { imageUrl }),
      });
      router.push("/admin/hr");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear evento");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" render={<Link href="/admin/hr" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Crear Evento RRHH</h1>
          <p className="text-muted-foreground">Publica un nuevo anuncio o evento</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo Evento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de evento</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del evento"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descripción del evento"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventDate">Fecha del evento</Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Audiencia (opcional)</Label>
              <Input
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ej: Todos, Área de TI, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL de imagen (opcional)</Label>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creando..." : "Crear Evento"}
              </Button>
              <Button variant="outline" render={<Link href="/admin/hr" />}>
                Volver
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
