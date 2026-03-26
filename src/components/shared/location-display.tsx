"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { EmployeeLocation } from "@/lib/types/employee";

interface LocationDisplayProps {
  location: EmployeeLocation;
  className?: string;
}

export function LocationDisplay({ location, className }: LocationDisplayProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mapboxgl, setMapboxgl] = useState<any>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token) return;
    import("mapbox-gl").then((mod) => {
      const mb = mod.default || mod;
      mb.accessToken = token;
      setMapboxgl(mb);
    });
  }, [token]);

  useEffect(() => {
    if (!mapboxgl || !mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [location.lng, location.lat],
      zoom: 15,
      interactive: false,
    });

    new mapboxgl.Marker({ color: "#2563eb" })
      .setLngLat([location.lng, location.lat])
      .addTo(map);

    return () => map.remove();
  }, [mapboxgl, location.lat, location.lng]);

  if (!token) {
    return (
      <div className={className}>
        <div className="w-full h-[200px] rounded-lg border flex items-center justify-center bg-muted/30">
          <div className="text-center text-sm text-muted-foreground">
            <MapPin className="h-6 w-6 mx-auto mb-1 opacity-50" />
            <p>Mapa no disponible</p>
          </div>
        </div>
        <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>{location.formattedAddress || location.address}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={mapContainerRef}
        className="w-full h-[200px] rounded-lg border overflow-hidden"
      />
      <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>{location.formattedAddress || location.address}</span>
      </div>
    </div>
  );
}
