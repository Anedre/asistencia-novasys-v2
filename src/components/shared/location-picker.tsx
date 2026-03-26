"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Loader2 } from "lucide-react";
import type { EmployeeLocation } from "@/lib/types/employee";

interface LocationPickerProps {
  value?: EmployeeLocation | null;
  onChange: (location: EmployeeLocation) => void;
  disabled?: boolean;
  className?: string;
}

export function LocationPicker({ value, onChange, disabled, className }: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mapboxgl, setMapboxgl] = useState<any>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Dynamic import of mapbox-gl (CSR only)
  useEffect(() => {
    if (!token) return;
    import("mapbox-gl").then((mod) => {
      const mb = mod.default || mod;
      mb.accessToken = token;
      setMapboxgl(mb);
    });
  }, [token]);

  // Initialize map
  useEffect(() => {
    if (!mapboxgl || !mapContainerRef.current || mapRef.current) return;

    const defaultCenter = value
      ? [value.lng, value.lat]
      : [-77.0428, -12.0464]; // Lima, Peru default

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: defaultCenter as [number, number],
      zoom: value ? 15 : 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const marker = new mapboxgl.Marker({ draggable: !disabled, color: "#2563eb" })
      .setLngLat(defaultCenter as [number, number])
      .addTo(map);

    if (!disabled) {
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        reverseGeocode(lngLat.lat, lngLat.lng);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => {
        marker.setLngLat(e.lngLat);
        reverseGeocode(e.lngLat.lat, e.lngLat.lng);
      });
    }

    mapRef.current = map;
    markerRef.current = marker;

    map.on("load", () => setIsLoaded(true));

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxgl]);

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=es`
        );
        const data = await res.json();
        const place = data.features?.[0];

        onChange({
          lat,
          lng,
          address: place?.text || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          formattedAddress: place?.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        });
      } catch {
        onChange({
          lat,
          lng,
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        });
      }
    },
    [onChange, token]
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !mapRef.current || !markerRef.current) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${token}&language=es&limit=1`
      );
      const data = await res.json();
      const place = data.features?.[0];

      if (place) {
        const [lng, lat] = place.center;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 15 });
        markerRef.current.setLngLat([lng, lat]);
        onChange({
          lat,
          lng,
          address: place.text || searchQuery,
          formattedAddress: place.place_name || searchQuery,
        });
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  if (!token) {
    return (
      <div className={className}>
        <div className="w-full h-[300px] rounded-lg border flex items-center justify-center bg-muted/30">
          <div className="text-center text-sm text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Mapa no disponible.</p>
            <p className="text-xs mt-1">Falta configurar NEXT_PUBLIC_MAPBOX_TOKEN.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {!disabled && (
        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar direccion..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              disabled={disabled}
            />
          </div>
          <Button type="submit" variant="outline" size="icon" disabled={isSearching || disabled}>
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>
      )}

      <div
        ref={mapContainerRef}
        className="w-full h-[300px] rounded-lg border overflow-hidden"
      />

      {value && (
        <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>{value.formattedAddress}</span>
        </div>
      )}
    </div>
  );
}
