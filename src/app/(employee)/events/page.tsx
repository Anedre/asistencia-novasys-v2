"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { IconSvg, Icons } from "@/components/nova/icons";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/nova/page-header";
import { useEvents, useCreateEvent, useRSVP } from "@/hooks/use-events";
import { useSession } from "next-auth/react";
import type { AppEvent, RSVPStatus } from "@/lib/types/event";
import type { EmployeeLocation } from "@/lib/types/employee";

const LocationPicker = dynamic(
  () =>
    import("@/components/shared/location-picker").then((m) => ({
      default: m.LocationPicker,
    })),
  { ssr: false }
);

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const typeLabels: Record<string, string> = {
  meeting: "Reunion",
  social: "Social",
  announcement: "Anuncio",
  custom: "Otro",
};

const typeTagClass: Record<string, string> = {
  meeting: "accent",
  social: "accent",
  announcement: "warn",
  custom: "muted",
};

const visibilityLabels: Record<string, string> = {
  company: "Empresa",
  area: "Area",
  private: "Privado",
};

const visibilityIconKey: Record<string, keyof typeof Icons> = {
  company: "globe",
  area: "building",
  private: "lock",
};

const rsvpStatusConfig: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  going: {
    label: "Confirmado",
    color: "var(--success)",
    dotColor: "var(--success)",
  },
  maybe: {
    label: "Quizas",
    color: "var(--warn)",
    dotColor: "var(--warn)",
  },
  declined: {
    label: "No asiste",
    color: "var(--danger)",
    dotColor: "var(--danger)",
  },
};

/* ------------------------------------------------------------------ */
/*  Helper: get initials from a name or ID                             */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Attendee list component                                            */
/* ------------------------------------------------------------------ */

function AttendeeList({ rsvps }: { rsvps: Record<string, RSVPStatus> }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(rsvps);

  if (entries.length === 0) return null;

  const grouped: Record<string, string[]> = {
    going: [],
    maybe: [],
    declined: [],
  };
  for (const [name, status] of entries) {
    if (grouped[status]) grouped[status].push(name);
  }

  // Show a compact preview of avatars when collapsed
  const previewEntries = entries.slice(0, 5);
  const remaining = entries.length - previewEntries.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Compact preview row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="btn ghost btn-sm"
        style={{
          width: "100%",
          justifyContent: "space-between",
          padding: "6px 8px",
          color: "var(--text-secondary)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <IconSvg d={Icons.users} size={14} />
          <span style={{ fontSize: 13 }}>
            {entries.length} asistente
            {entries.length !== 1 ? "s" : ""}
          </span>
          <span style={{ display: "inline-flex", gap: -8 }}>
            {previewEntries.map(([name], idx) => (
              <span
                key={name}
                className="avatar plain"
                style={{
                  width: 22,
                  height: 22,
                  fontSize: 9,
                  marginLeft: idx > 0 ? -6 : 0,
                  border: "2px solid var(--bg-elevated)",
                }}
              >
                {getInitials(name)}
              </span>
            ))}
            {remaining > 0 && (
              <span
                className="avatar muted"
                style={{
                  width: 22,
                  height: 22,
                  fontSize: 9,
                  marginLeft: -6,
                  border: "2px solid var(--bg-elevated)",
                }}
              >
                +{remaining}
              </span>
            )}
          </span>
        </span>
        <IconSvg
          d={Icons.chevronDown}
          size={14}
          style={{
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Expanded attendee list */}
      {expanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 12,
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
          }}
        >
          {(["going", "maybe", "declined"] as const).map((status) => {
            const people = grouped[status];
            if (!people || people.length === 0) return null;
            const cfg = rsvpStatusConfig[status];
            return (
              <div
                key={status}
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: cfg.dotColor,
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: cfg.color,
                    }}
                  >
                    {cfg.label} ({people.length})
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    paddingLeft: 16,
                  }}
                >
                  {people.map((name) => (
                    <div
                      key={name}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "2px 8px 2px 2px",
                        fontSize: 11,
                      }}
                    >
                      <span
                        className="avatar plain"
                        style={{ width: 18, height: 18, fontSize: 8 }}
                      >
                        {getInitials(name)}
                      </span>
                      <span
                        style={{
                          maxWidth: 120,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Location display                                                   */
/* ------------------------------------------------------------------ */

function EventLocation({ event }: { event: AppEvent }) {
  const hasCoords =
    event.LocationLat != null &&
    event.LocationLng != null &&
    !isNaN(event.LocationLat) &&
    !isNaN(event.LocationLng);

  const meetingUrl = extractMeetingUrl(event);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Physical location with coords - Google Maps link */}
      {hasCoords && (
        <a
          href={`https://maps.google.com/?q=${event.LocationLat},${event.LocationLng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r)",
            fontSize: 13,
            color: "var(--text-primary)",
            transition: "background 0.15s",
          }}
        >
          <IconSvg
            d={Icons.pin}
            size={16}
            style={{ color: "var(--danger)", flexShrink: 0 }}
          />
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.Location ||
              `${event.LocationLat!.toFixed(4)}, ${event.LocationLng!.toFixed(4)}`}
          </span>
          <IconSvg
            d={Icons.link}
            size={14}
            style={{ color: "var(--text-muted)" }}
          />
        </a>
      )}

      {/* Text-only location without coords */}
      {event.Location && !hasCoords && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          <IconSvg d={Icons.pin} size={16} style={{ flexShrink: 0 }} />
          <span>{event.Location}</span>
        </div>
      )}

      {/* Virtual meeting link */}
      {meetingUrl && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            border: "1px solid var(--accent)",
            background: "var(--accent-soft)",
            borderRadius: "var(--r)",
            fontSize: 13,
            color: "var(--accent-strong)",
            fontWeight: 500,
          }}
        >
          <IconSvg d={Icons.pulse} size={16} style={{ flexShrink: 0 }} />
          Unirse a reunion
          <IconSvg d={Icons.link} size={14} style={{ opacity: 0.6 }} />
        </a>
      )}
    </div>
  );
}

/** Extract a meeting URL from the event. Checks a MeetingUrl field first, then scans Description. */
function extractMeetingUrl(event: AppEvent): string | null {
  // Check for explicit MeetingUrl field (future-proof)
  const ev = event as AppEvent & { MeetingUrl?: string };
  if (ev.MeetingUrl) return ev.MeetingUrl;

  // Scan description for common meeting URLs
  if (!event.Description) return null;
  const urlMatch = event.Description.match(
    /https?:\/\/(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|whereby\.com)[^\s)"]*/i
  );
  return urlMatch ? urlMatch[0] : null;
}

/* ------------------------------------------------------------------ */
/*  Event card component                                               */
/* ------------------------------------------------------------------ */

function EnhancedEventCard({ event }: { event: AppEvent }) {
  const { data: session } = useSession();
  const rsvpMutation = useRSVP();
  const employeeId = (session?.user as Record<string, string>)?.employeeId;

  const myRSVP = event.RSVPs?.[employeeId] as RSVPStatus | undefined;
  const rsvpEntries = event.RSVPs || {};
  const rsvpCounts = Object.values(rsvpEntries);
  const goingCount = rsvpCounts.filter((s) => s === "going").length;
  const maybeCount = rsvpCounts.filter((s) => s === "maybe").length;

  const handleRSVP = (status: string) => {
    if (rsvpMutation.isPending) return;
    rsvpMutation.mutate(
      { eventId: event.EventID, status },
      {
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "No se pudo responder"),
      },
    );
  };

  const startDate = new Date(event.StartDate);
  const isUpcoming = startDate > new Date();
  const tagCls = typeTagClass[event.Type] || "muted";
  const visIcon = Icons[visibilityIconKey[event.Visibility] || "globe"];

  // Format date parts
  const dayNum = startDate.getDate();
  const monthShort = startDate
    .toLocaleDateString("es-PE", { month: "short" })
    .toUpperCase();
  const timeStr = startDate.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const weekday = startDate.toLocaleDateString("es-PE", { weekday: "long" });

  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 18px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          {/* Date block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--r)",
              padding: "8px 12px",
              minWidth: 60,
              background: "var(--accent-soft)",
              color: "var(--accent-strong)",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
              {dayNum}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginTop: 2,
              }}
            >
              {monthShort}
            </span>
          </div>

          {/* Title & meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 4,
              }}
            >
              <span className={`type-tag ${tagCls}`}>
                {typeLabels[event.Type] || event.Type}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                <IconSvg d={visIcon} size={12} />
                {visibilityLabels[event.Visibility] || event.Visibility}
              </span>
            </div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                margin: "0 0 4px",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
                color: "var(--text-primary)",
              }}
            >
              {event.Title}
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <IconSvg d={Icons.clock} size={12} />
                {weekday}, {timeStr}
              </span>
              {event.EndDate && (
                <span style={{ fontSize: 11 }}>
                  hasta{" "}
                  {new Date(event.EndDate).toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "0 18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Description */}
        {event.Description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {event.Description}
          </p>
        )}

        {/* Location */}
        {(event.Location ||
          event.LocationLat != null ||
          extractMeetingUrl(event)) && <EventLocation event={event} />}

        {/* RSVP buttons + count summary */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 4,
          }}
          className="rsvp-row"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <IconSvg
                d={Icons.check}
                size={14}
                style={{ color: "var(--success)" }}
              />
              {goingCount} confirmado{goingCount !== 1 ? "s" : ""}
            </span>
            {maybeCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <IconSvg
                  d={Icons.helpCircle}
                  size={14}
                  style={{ color: "var(--warn)" }}
                />
                {maybeCount} quizas
              </span>
            )}
          </div>

          {isUpcoming && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className={`btn ${myRSVP === "going" ? "primary" : "outline"} btn-sm`}
                onClick={() => handleRSVP("going")}
                disabled={rsvpMutation.isPending}
              >
                <IconSvg d={Icons.check} size={13} />
                Voy
              </button>
              <button
                type="button"
                className={`btn ${myRSVP === "maybe" ? "primary" : "outline"} btn-sm`}
                onClick={() => handleRSVP("maybe")}
                disabled={rsvpMutation.isPending}
              >
                <IconSvg d={Icons.helpCircle} size={13} />
                Quizas
              </button>
              <button
                type="button"
                className={`btn ${myRSVP === "declined" ? "danger" : "outline"} btn-sm`}
                onClick={() => handleRSVP("declined")}
                disabled={rsvpMutation.isPending}
              >
                <IconSvg d={Icons.x} size={13} />
                No
              </button>
            </div>
          )}
        </div>

        {/* Attendee list (collapsible) */}
        {Object.keys(rsvpEntries).length > 0 && (
          <AttendeeList rsvps={rsvpEntries} />
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 18px",
          fontSize: 11,
          color: "var(--text-muted)",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-subtle)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <IconSvg d={Icons.user} size={12} />
        Creado por {event.CreatorName}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create event sheet                                                 */
/* ------------------------------------------------------------------ */

function CreateEventSheet({ onClose }: { onClose: () => void }) {
  const createEvent = useCreateEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("meeting");
  const [visibility, setVisibility] = useState("company");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLocation, setMapLocation] = useState<EmployeeLocation | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate) return;

    const locationText =
      mapLocation?.formattedAddress || location || undefined;

    let finalDescription = description || undefined;
    if (meetingUrl) {
      finalDescription = finalDescription
        ? `${finalDescription}\n\nEnlace de reunion: ${meetingUrl}`
        : `Enlace de reunion: ${meetingUrl}`;
    }

    await createEvent.mutateAsync({
      title,
      description: finalDescription,
      type,
      visibility,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      location: locationText,
      locationLat: mapLocation?.lat,
      locationLng: mapLocation?.lng,
    });

    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        style={{ maxWidth: 640 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h3 className="sheet-title">Nuevo Evento</h3>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <IconSvg d={Icons.x} size={16} />
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <div className="sheet-body">
            {/* Row 1: Title + Type */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px",
                gap: 14,
              }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="ev-title">
                  Titulo<span className="req">*</span>
                </label>
                <input
                  id="ev-title"
                  className="form-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Reunion de equipo"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ev-type">
                  Tipo
                </label>
                <select
                  id="ev-type"
                  className="form-select"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="meeting">Reunion</option>
                  <option value="social">Social</option>
                  <option value="announcement">Anuncio</option>
                  <option value="custom">Otro</option>
                </select>
              </div>
            </div>

            {/* Row 2: Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="ev-desc">
                Descripcion
              </label>
              <textarea
                id="ev-desc"
                className="form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles del evento..."
                rows={3}
              />
            </div>

            {/* Row 3: Date/Time + Visibility */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 14,
              }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="ev-start">
                  Inicio<span className="req">*</span>
                </label>
                <input
                  id="ev-start"
                  className="form-input"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ev-end">
                  Fin (opcional)
                </label>
                <input
                  id="ev-end"
                  className="form-input"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ev-vis">
                  Visibilidad
                </label>
                <select
                  id="ev-vis"
                  className="form-select"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                >
                  <option value="company">Toda la empresa</option>
                  <option value="area">Solo mi area</option>
                  <option value="private">Privado</option>
                </select>
              </div>
            </div>

            {/* Row 4: Location + Meeting URL */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="ev-loc">
                  Ubicacion
                </label>
                <input
                  id="ev-loc"
                  className="form-input"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Sala de reuniones"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ev-meeting">
                  Enlace de reunion virtual
                </label>
                <input
                  id="ev-meeting"
                  className="form-input"
                  type="text"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            </div>

            {/* Map picker */}
            <div className="form-group">
              <button
                type="button"
                className="btn outline btn-sm"
                onClick={() => setShowMapPicker(!showMapPicker)}
                style={{ width: "fit-content" }}
              >
                <IconSvg d={Icons.pin} size={14} />
                {showMapPicker
                  ? "Ocultar mapa"
                  : "Seleccionar ubicacion en mapa"}
              </button>
              {showMapPicker && (
                <div style={{ marginTop: 10 }}>
                  <LocationPicker
                    value={mapLocation}
                    onChange={(loc) => setMapLocation(loc)}
                  />
                </div>
              )}
              {mapLocation && (
                <span className="form-hint">
                  Coordenadas: {mapLocation.lat.toFixed(6)},{" "}
                  {mapLocation.lng.toFixed(6)}
                </span>
              )}
            </div>
          </div>

          <div className="sheet-foot">
            <button
              type="button"
              className="btn outline"
              onClick={onClose}
              disabled={createEvent.isPending}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn primary"
              disabled={createEvent.isPending}
            >
              {createEvent.isPending && (
                <span
                  className="spin"
                  style={{
                    width: 14,
                    height: 14,
                    borderColor: "currentColor",
                    borderTopColor: "transparent",
                  }}
                />
              )}
              Crear Evento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function EventsPage() {
  const { data, isLoading } = useEvents();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  const events = data?.events ?? [];
  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.StartDate >= now);
  const past = events.filter((e) => e.StartDate < now);

  const list = activeTab === "upcoming" ? upcoming : past;

  return (
    <>
      {/* Page Header */}
      <PageHeader
        title="Eventos"
        subtitle="Eventos y actividades de tu empresa."
        actions={
          <button
            type="button"
            className="btn primary btn-sm"
            onClick={() => setShowForm(true)}
          >
            <IconSvg d={Icons.plus} size={14} />
            Crear evento
          </button>
        }
      />

      {/* Event list */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="tabs">
            <button
              type="button"
              className={`tab ${activeTab === "upcoming" ? "active" : ""}`}
              onClick={() => setActiveTab("upcoming")}
            >
              Próximos
              <span className="tab-count">{upcoming.length}</span>
            </button>
            <button
              type="button"
              className={`tab ${activeTab === "past" ? "active" : ""}`}
              onClick={() => setActiveTab("past")}
            >
              Pasados
              <span className="tab-count">{past.length}</span>
            </button>
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={Icons.calendar}
              title={
                activeTab === "upcoming"
                  ? "Sin eventos próximos"
                  : "Sin eventos pasados"
              }
              description={
                activeTab === "upcoming"
                  ? "Aún no hay eventos programados. Crea el primero para anunciarlo al equipo."
                  : "Todavía no se han realizado eventos en esta organización."
              }
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {list.map((event) => (
                <EnhancedEventCard key={event.EventID} event={event} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create form sheet */}
      {showForm && <CreateEventSheet onClose={() => setShowForm(false)} />}

      <style jsx>{`
        @media (min-width: 640px) {
          :global(.rsvp-row) {
            flex-direction: row !important;
            align-items: center;
            justify-content: space-between;
          }
        }
      `}</style>
    </>
  );
}
