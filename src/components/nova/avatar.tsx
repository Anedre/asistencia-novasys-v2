/**
 * Avatar — initials or image. Matches the design's .avatar component.
 *
 * When an `image` is provided but fails to load, falls back to initials so
 * we never show the broken-image alt text inside the avatar circle.
 */

"use client";

import { useEffect, useState } from "react";

interface AvatarProps {
  name?: string;
  image?: string | null;
  size?: number;
  variant?: "accent" | "plain" | "muted";
  status?: "success" | "warn" | "accent" | "muted";
}

export function NovaAvatar({ name = "?", image, size = 32, variant = "plain", status }: AvatarProps) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  // Map the visual presence dot color to a screen-reader label so non-visual
  // users get the same signal as sighted ones.
  const statusLabel =
    status === "success"
      ? "En línea"
      : status === "warn"
      ? "Ausente"
      : status === "muted"
      ? "Desconectado"
      : status === "accent"
      ? "Activo"
      : null;

  const showImage = !!image && !imageFailed;

  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image as string}
          className="avatar-img"
          alt={name || ""}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className={`avatar ${variant}`}
          style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.36)) }}
          aria-label={name && name !== "?" ? name : undefined}
        >
          {initials}
        </div>
      )}
      {status && (
        <span className={`presence-dot ${status}`} role="status" aria-label={statusLabel ?? undefined}>
          {statusLabel && <span className="sr-only">{statusLabel}</span>}
        </span>
      )}
    </div>
  );
}
