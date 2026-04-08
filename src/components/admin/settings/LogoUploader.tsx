"use client";

/**
 * Logo uploader with drag-and-drop + preview.
 * POSTs multipart to /api/admin/tenant/logo.
 *
 * On success, calls onChange(newLogoUrl) so the parent can update its local
 * state (used by both the settings branding page and the /welcome wizard).
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Loader2,
  Image as ImageIcon,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function LogoUploader({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/admin/tenant/logo", {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || `Error ${res.status}`);
      }
      onChange(body.logoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el logo");
    } finally {
      setUploading(false);
    }
  }

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    upload(file);
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "relative flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 transition",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-foreground/40 hover:bg-muted/40"
        )}
      >
        {/* Preview */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {value ? (
            // Using a plain img to avoid Next image domain config for arbitrary S3 buckets.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Logo"
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          )}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {value ? "Reemplazar logo" : "Subir logo"}
          </p>
          <p className="text-xs text-muted-foreground">
            Arrastra un archivo aquí o haz click para seleccionar. JPG, PNG,
            WebP o SVG, máximo 2MB.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {value && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              aria-label="Quitar logo"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            {uploading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1 h-3.5 w-3.5" />
            )}
            {uploading ? "Subiendo…" : "Elegir archivo"}
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
