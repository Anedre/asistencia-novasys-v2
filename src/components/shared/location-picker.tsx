"use client";

import { useState, useCallback, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { MapPin, Search } from "lucide-react";
import type { EmployeeLocation } from "@/lib/types/employee";

const libraries: ("places")[] = ["places"];

const mapContainerStyle = { width: "100%", height: "300px" };
const defaultCenter = { lat: -12.0464, lng: -77.0428 }; // Lima, Peru

interface LocationPickerProps {
  value?: EmployeeLocation | null;
  onChange: (location: EmployeeLocation) => void;
  disabled?: boolean;
  className?: string;
}

export function LocationPicker({
  value,
  onChange,
  disabled,
  className,
}: LocationPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries,
  });

  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral>(
    value ? { lat: value.lat, lng: value.lng } : defaultCenter
  );

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
    },
    []
  );

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const result = results[0];
          // Extract a short address component
          const shortAddress =
            result.address_components?.find((c) =>
              c.types.includes("route")
            )?.long_name ||
            result.address_components?.[0]?.long_name ||
            `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          onChange({
            lat,
            lng,
            address: shortAddress,
            formattedAddress: result.formatted_address,
          });
        } else {
          onChange({
            lat,
            lng,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          });
        }
      });
    },
    [onChange]
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (disabled || !e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      reverseGeocode(lat, lng);
    },
    [disabled, reverseGeocode]
  );

  const handleMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  const onAutocompleteLoad = useCallback(
    (autocomplete: google.maps.places.Autocomplete) => {
      autocompleteRef.current = autocomplete;
    },
    []
  );

  const onPlaceChanged = useCallback(() => {
    const autocomplete = autocompleteRef.current;
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    if (!place.geometry?.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    setMarkerPosition({ lat, lng });
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(15);

    onChange({
      lat,
      lng,
      address: place.name || place.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      formattedAddress: place.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  }, [onChange]);

  if (!apiKey) {
    return (
      <div className={className}>
        <div className="w-full h-[300px] rounded-lg border flex items-center justify-center bg-muted/30">
          <div className="text-center text-sm text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Mapa no disponible.</p>
            <p className="text-xs mt-1">
              Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={className}>
        <div className="w-full h-[300px] rounded-lg border flex items-center justify-center bg-muted/30">
          <div className="text-center text-sm text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
            <p>Cargando mapa...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {!disabled && (
        <div className="mb-3">
          <Autocomplete
            onLoad={onAutocompleteLoad}
            onPlaceChanged={onPlaceChanged}
            options={{ componentRestrictions: { country: "pe" } }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar direccion..."
                className="pl-9"
                disabled={disabled}
              />
            </div>
          </Autocomplete>
        </div>
      )}

      <div className="w-full h-[300px] rounded-lg border overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={markerPosition}
          zoom={value ? 15 : 12}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          <Marker
            position={markerPosition}
            draggable={!disabled}
            onDragEnd={handleMarkerDragEnd}
          />
        </GoogleMap>
      </div>

      {value && (
        <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>{value.formattedAddress}</span>
        </div>
      )}
    </div>
  );
}
