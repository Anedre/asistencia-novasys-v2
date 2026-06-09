"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateHREvent } from "@/hooks/use-hr";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PageHeader } from "@/components/nova/page-header";
import { NovaDatePicker } from "@/components/nova/date-picker";

/* ============================================================
   /admin/hr/create — create new HR event
   Migrated to design CSS (.panel/.form-input/.btn primary)
   ============================================================ */

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
    <>
      <PageHeader
        breadcrumb={[
          { label: "RRHH", href: "/admin/hr" },
          { label: "Crear" },
        ]}
        title="Crear evento RRHH"
        subtitle="Publica un nuevo anuncio o evento."
        actions={
          <Link href="/admin/hr" className="btn outline btn-sm">
            <IconSvg d={Icons.arrowLeft} size={14} /> Volver
          </Link>
        }
      />

      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="panel-title" style={{ marginBottom: 16 }}>
          Nuevo evento
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r)",
                border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                color: "var(--danger)",
                fontSize: 13,
                marginBottom: 14,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <IconSvg d={Icons.alert} size={15} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="type">
              Tipo de evento
            </label>
            <select
              id="type"
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Título<span className="req">*</span>
            </label>
            <input
              id="title"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del evento"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="message">
              Mensaje
            </label>
            <textarea
              id="message"
              className="form-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descripción del evento"
              rows={4}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="eventDate">
                Fecha del evento<span className="req">*</span>
              </label>
              <NovaDatePicker value={eventDate} onChange={setEventDate} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="audience">
                Audiencia (opcional)
              </label>
              <input
                id="audience"
                className="form-input"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ej: Todos, Área de TI, etc."
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="imageUrl">
              URL de imagen (opcional)
            </label>
            <input
              id="imageUrl"
              className="form-input"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              className="btn primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creando…" : "Crear evento"}
            </button>
            <Link href="/admin/hr" className="btn outline">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
