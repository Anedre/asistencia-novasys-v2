"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  Plus,
  Loader2,
  MapPin,
  Check,
  HelpCircle,
  X,
  Users,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Video,
  Clock,
  User,
  Globe,
  Lock,
  Building2,
  Link2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvents, useCreateEvent, useRSVP } from "@/hooks/use-events";
import { EmptyState } from "@/components/shared/empty-state";
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

const typeConfig: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  meeting: {
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-400",
  },
  social: {
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
    icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/60 dark:text-purple-400",
  },
  announcement: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400",
  },
  custom: {
    bg: "bg-gray-50 dark:bg-gray-900/40",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-700",
    icon: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400",
  },
};

const visibilityIcons: Record<string, React.ElementType> = {
  company: Globe,
  area: Building2,
  private: Lock,
};

const rsvpStatusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  going: {
    label: "Confirmado",
    color: "text-emerald-700 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  maybe: {
    label: "Quizas",
    color: "text-amber-700 dark:text-amber-400",
    dotColor: "bg-amber-500",
  },
  declined: {
    label: "No asiste",
    color: "text-red-600 dark:text-red-400",
    dotColor: "bg-red-500",
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

  const grouped: Record<string, string[]> = { going: [], maybe: [], declined: [] };
  for (const [name, status] of entries) {
    if (grouped[status]) grouped[status].push(name);
  }

  // Show a compact preview of avatars when collapsed
  const previewEntries = entries.slice(0, 5);
  const remaining = entries.length - previewEntries.length;

  return (
    <div className="space-y-2">
      {/* Compact preview row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          <span>{entries.length} asistente{entries.length !== 1 ? "s" : ""}</span>
          <AvatarGroup>
            {previewEntries.map(([name]) => (
              <Avatar key={name} size="sm">
                <AvatarFallback>{getInitials(name)}</AvatarFallback>
              </Avatar>
            ))}
            {remaining > 0 && (
              <AvatarGroupCount>+{remaining}</AvatarGroupCount>
            )}
          </AvatarGroup>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Expanded attendee list */}
      {expanded && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          {(["going", "maybe", "declined"] as const).map((status) => {
            const people = grouped[status];
            if (!people || people.length === 0) return null;
            const cfg = rsvpStatusConfig[status];
            return (
              <div key={status} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${cfg.dotColor}`} />
                  <span className={`text-xs font-medium ${cfg.color}`}>
                    {cfg.label} ({people.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-4">
                  {people.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 text-xs ring-1 ring-foreground/10"
                    >
                      <Avatar size="sm">
                        <AvatarFallback>{getInitials(name)}</AvatarFallback>
                      </Avatar>
                      <span className="max-w-[120px] truncate">{name}</span>
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

function EventLocation({
  event,
}: {
  event: AppEvent;
}) {
  const hasCoords =
    event.LocationLat != null &&
    event.LocationLng != null &&
    !isNaN(event.LocationLat) &&
    !isNaN(event.LocationLng);

  // Virtual meeting URL (stored in Description with prefix or as a future field)
  // For now we detect URLs that look like meeting links in the event
  const meetingUrl = extractMeetingUrl(event);

  return (
    <div className="flex flex-col gap-2">
      {/* Physical location with coords - Google Maps link */}
      {hasCoords && (
        <a
          href={`https://maps.google.com/?q=${event.LocationLat},${event.LocationLng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted group/link"
        >
          <MapPin className="h-4 w-4 text-red-500 shrink-0" />
          <span className="flex-1 truncate">
            {event.Location || `${event.LocationLat!.toFixed(4)}, ${event.LocationLng!.toFixed(4)}`}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/link:opacity-100" />
        </a>
      )}

      {/* Text-only location without coords */}
      {event.Location && !hasCoords && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span>{event.Location}</span>
        </div>
      )}

      {/* Virtual meeting link */}
      {meetingUrl && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
        >
          <Video className="h-4 w-4 shrink-0" />
          Unirse a reunion
          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
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
/*  Event card component (inline, replaces EventCard import)           */
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
    rsvpMutation.mutate({ eventId: event.EventID, status });
  };

  const startDate = new Date(event.StartDate);
  const isUpcoming = startDate > new Date();
  const tc = typeConfig[event.Type] || typeConfig.custom;
  const VisIcon = visibilityIcons[event.Visibility] || Globe;

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
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-0">
        <div className="flex items-start gap-4">
          {/* Date block */}
          <div
            className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[60px] ${tc.icon}`}
          >
            <span className="text-2xl font-bold leading-none">{dayNum}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {monthShort}
            </span>
          </div>

          {/* Title & meta */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={`${tc.bg} ${tc.text} ${tc.border} border`}
                variant="outline"
              >
                {typeLabels[event.Type] || event.Type}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <VisIcon className="h-3 w-3" />
                {event.Visibility === "company"
                  ? "Empresa"
                  : event.Visibility === "area"
                    ? "Area"
                    : "Privado"}
              </span>
            </div>
            <CardTitle className="text-lg leading-tight">{event.Title}</CardTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {weekday}, {timeStr}
              </span>
              {event.EndDate && (
                <span className="text-xs">
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
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        {/* Description */}
        {event.Description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {event.Description}
          </p>
        )}

        {/* Location */}
        {(event.Location || event.LocationLat != null || extractMeetingUrl(event)) && (
          <EventLocation event={event} />
        )}

        {/* RSVP buttons + count summary */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              {goingCount} confirmado{goingCount !== 1 ? "s" : ""}
            </span>
            {maybeCount > 0 && (
              <span className="flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                {maybeCount} quizas
              </span>
            )}
          </div>

          {isUpcoming && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant={myRSVP === "going" ? "default" : "outline"}
                onClick={() => handleRSVP("going")}
                disabled={rsvpMutation.isPending}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Voy
              </Button>
              <Button
                size="sm"
                variant={myRSVP === "maybe" ? "default" : "outline"}
                onClick={() => handleRSVP("maybe")}
                disabled={rsvpMutation.isPending}
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                Quizas
              </Button>
              <Button
                size="sm"
                variant={myRSVP === "declined" ? "destructive" : "outline"}
                onClick={() => handleRSVP("declined")}
                disabled={rsvpMutation.isPending}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                No
              </Button>
            </div>
          )}
        </div>

        {/* Attendee list (collapsible) */}
        {Object.keys(rsvpEntries).length > 0 && (
          <AttendeeList rsvps={rsvpEntries} />
        )}
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          Creado por {event.CreatorName}
        </div>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Create event form                                                  */
/* ------------------------------------------------------------------ */

function CreateEventForm({ onClose }: { onClose: () => void }) {
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

    // If there's a meeting URL, append it to description so it's stored
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
    <Card>
      <CardHeader>
        <CardTitle>Nuevo Evento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Row 1: Title + Type */}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="ev-title">Titulo *</Label>
              <Input
                id="ev-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Reunion de equipo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Reunion</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="announcement">Anuncio</SelectItem>
                  <SelectItem value="custom">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="space-y-2">
            <Label htmlFor="ev-desc">Descripcion</Label>
            <Textarea
              id="ev-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles del evento..."
              className="min-h-[80px]"
            />
          </div>

          {/* Row 3: Date/Time + Visibility */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ev-start">Inicio *</Label>
              <Input
                id="ev-start"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-end">Fin (opcional)</Label>
              <Input
                id="ev-end"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Visibilidad</Label>
              <Select
                value={visibility}
                onValueChange={(v) => v && setVisibility(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Toda la empresa</SelectItem>
                  <SelectItem value="area">Solo mi area</SelectItem>
                  <SelectItem value="private">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Location + Meeting URL */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ev-loc">Ubicacion</Label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ev-loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Sala de reuniones"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-meeting">Enlace de reunion virtual</Label>
              <div className="relative">
                <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ev-meeting"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Map picker */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMapPicker(!showMapPicker)}
            >
              <MapPin className="mr-2 h-4 w-4" />
              {showMapPicker
                ? "Ocultar mapa"
                : "Seleccionar ubicacion en mapa"}
            </Button>
            {showMapPicker && (
              <LocationPicker
                value={mapLocation}
                onChange={(loc) => setMapLocation(loc)}
              />
            )}
            {mapLocation && (
              <p className="text-xs text-muted-foreground">
                Coordenadas: {mapLocation.lat.toFixed(6)},{" "}
                {mapLocation.lng.toFixed(6)}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Crear Evento
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function EventsPage() {
  const { data, isLoading } = useEvents();
  const [showForm, setShowForm] = useState(false);

  const events = data?.events ?? [];
  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.StartDate >= now);
  const past = events.filter((e) => e.StartDate < now);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground">
            Eventos y actividades de tu empresa
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Evento
        </Button>
      </div>

      {/* Create form */}
      {showForm && <CreateEventForm onClose={() => setShowForm(false)} />}

      {/* Event list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">
              Proximos ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="past">Pasados ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="space-y-4 mt-4">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Sin eventos proximos"
                description="No hay eventos programados. Crea uno!"
              />
            ) : (
              upcoming.map((event) => (
                <EnhancedEventCard key={event.EventID} event={event} />
              ))
            )}
          </TabsContent>
          <TabsContent value="past" className="space-y-4 mt-4">
            {past.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Sin eventos pasados"
                description="No hay eventos anteriores"
              />
            ) : (
              past.map((event) => (
                <EnhancedEventCard key={event.EventID} event={event} />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
