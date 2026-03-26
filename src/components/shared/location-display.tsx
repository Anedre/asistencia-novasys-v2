"use client";

import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { MapPin } from "lucide-react";
import type { EmployeeLocation } from "@/lib/types/employee";

interface LocationDisplayProps {
  location: EmployeeLocation;
  className?: string;
  height?: number;
}

export function LocationDisplay({
  location,
  className,
  height = 200,
}: LocationDisplayProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
  });

  const center = { lat: location.lat, lng: location.lng };

  if (!apiKey) {
    return (
      <div className={className}>
        <div
          className="w-full rounded-lg border flex items-center justify-center bg-muted/30"
          style={{ height }}
        >
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

  if (!isLoaded) {
    return (
      <div className={className}>
        <div
          className="w-full rounded-lg border flex items-center justify-center bg-muted/30"
          style={{ height }}
        >
          <div className="text-center text-sm text-muted-foreground">
            <MapPin className="h-6 w-6 mx-auto mb-1 opacity-50 animate-pulse" />
            <p>Cargando mapa...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className="w-full rounded-lg border overflow-hidden"
        style={{ height }}
      >
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={15}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            scrollwheel: false,
            draggable: false,
            clickableIcons: false,
            gestureHandling: "none",
            mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
          }}
        >
          <Marker position={center} />
        </GoogleMap>
      </div>
      <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>{location.formattedAddress || location.address}</span>
      </div>
    </div>
  );
}
