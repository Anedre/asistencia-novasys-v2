"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, Plus, Loader2, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvents, useCreateEvent } from "@/hooks/use-events";
import { EventCard } from "@/components/shared/event-card";
import { EmptyState } from "@/components/shared/empty-state";
import type { EmployeeLocation } from "@/lib/types/employee";

const LocationPicker = dynamic(
  () => import("@/components/shared/location-picker").then((m) => ({ default: m.LocationPicker })),
  { ssr: false }
);

export default function EventsPage() {
  const { data, isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("meeting");
  const [visibility, setVisibility] = useState("company");
  const [startDate, setStartDate] = useState("");
  const [location, setLocation] = useState("");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLocation, setMapLocation] = useState<EmployeeLocation | null>(null);

  const events = data?.events ?? [];
  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.StartDate >= now);
  const past = events.filter((e) => e.StartDate < now);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate) return;

    // Use map location address if available, otherwise text location
    const locationText = mapLocation?.formattedAddress || location || undefined;

    await createEvent.mutateAsync({
      title, description: description || undefined,
      type, visibility,
      startDate: new Date(startDate).toISOString(),
      location: locationText,
      locationLat: mapLocation?.lat,
      locationLng: mapLocation?.lng,
    });

    // Reset
    setTitle(""); setDescription(""); setStartDate(""); setLocation("");
    setMapLocation(null); setShowMapPicker(false);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground">Eventos y actividades de tu empresa</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Evento
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Evento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Titulo *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reunion de equipo" required />
                </div>
                <div className="space-y-2">
                  <Label>Fecha y hora *</Label>
                  <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descripcion</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles del evento..." />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => v && setType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Reunion</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="announcement">Anuncio</SelectItem>
                      <SelectItem value="custom">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Visibilidad</Label>
                  <Select value={visibility} onValueChange={(v) => v && setVisibility(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Toda la empresa</SelectItem>
                      <SelectItem value="area">Solo mi area</SelectItem>
                      <SelectItem value="private">Privado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ubicacion</Label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sala de reuniones" />
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMapPicker(!showMapPicker)}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  {showMapPicker ? "Ocultar mapa" : "Seleccionar ubicacion en mapa"}
                </Button>
                {showMapPicker && (
                  <LocationPicker
                    value={mapLocation}
                    onChange={(loc) => setMapLocation(loc)}
                  />
                )}
                {mapLocation && (
                  <p className="text-xs text-muted-foreground">
                    Coordenadas: {mapLocation.lat.toFixed(6)}, {mapLocation.lng.toFixed(6)}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createEvent.isPending}>
                  {createEvent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear Evento
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Proximos ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Pasados ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="space-y-4 mt-4">
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Sin eventos proximos" description="No hay eventos programados. Crea uno!" />
            ) : (
              upcoming.map((event) => <EventCard key={event.EventID} event={event} />)
            )}
          </TabsContent>
          <TabsContent value="past" className="space-y-4 mt-4">
            {past.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Sin eventos pasados" description="No hay eventos anteriores" />
            ) : (
              past.map((event) => <EventCard key={event.EventID} event={event} />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
