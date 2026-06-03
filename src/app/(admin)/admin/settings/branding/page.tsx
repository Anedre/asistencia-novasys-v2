"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTenantSettings, useSaveTenantSettings } from "@/hooks/use-tenant-settings";
import { SettingsCard, SaveBar } from "@/components/admin/settings/SettingsCard";
import { NovaLogo } from "@/components/nova/logo";
import { IconSvg, Icons } from "@/components/nova/icons";

const PRESET_COLORS = ["#3FBEFF", "#0A1628", "#10B981", "#8B5CF6", "#F59E0B", "#F43F5E"];

export default function BrandingSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const queryClient = useQueryClient();
  const tenant = data?.tenant;
  const fileRef = useRef<HTMLInputElement>(null);

  const [accentColor, setAccentColor] = useState("#3FBEFF");
  const [tagline, setTagline] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saved = useMemo(
    () => ({
      accentColor: tenant?.settings?.accentColor ?? "#3FBEFF",
      tagline: tenant?.settings?.tagline ?? "",
      welcomeMessage: tenant?.settings?.welcomeMessage ?? "",
    }),
    [tenant]
  );

  useEffect(() => {
    setAccentColor(saved.accentColor);
    setTagline(saved.tagline);
    setWelcomeMessage(saved.welcomeMessage);
  }, [saved]);

  const dirty =
    accentColor !== saved.accentColor ||
    tagline !== saved.tagline ||
    welcomeMessage !== saved.welcomeMessage;

  function discard() {
    setAccentColor(saved.accentColor);
    setTagline(saved.tagline);
    setWelcomeMessage(saved.welcomeMessage);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({
        settings: { accentColor, tagline, welcomeMessage },
      });
      toast.success("Marca actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagen demasiado grande (máx. 2MB)");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/admin/tenant/logo", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al subir logo");
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
      toast.success("Logo actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading || !tenant) {
    return (
      <div className="panel" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Cargando…
      </div>
    );
  }

  return (
    <>
      <SettingsCard title="Logo" subtitle="Tu marca en la interfaz de tus empleados.">
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 120,
              height: 120,
              border: "2px dashed var(--border)",
              borderRadius: "var(--r)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-subtle)",
              flexShrink: 0,
            }}
          >
            {(tenant.branding?.logoUrl ?? tenant.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.branding?.logoUrl ?? tenant.logoUrl}
                alt={tenant.name ?? tenant.tenantName ?? "Logo"}
                style={{ maxWidth: "85%", maxHeight: "85%", objectFit: "contain" }}
              />
            ) : (
              <NovaLogo size={48} showText={false} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
            <button
              type="button"
              className="btn outline btn-md"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <IconSvg d={Icons.upload} size={14} /> {uploading ? "Subiendo…" : "Subir logo"}
            </button>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
              PNG o SVG, mínimo 256×256px, máximo 2MB.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Color de marca"
        subtitle="Acento principal usado en botones y elementos destacados."
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAccentColor(c)}
              aria-label={`Color ${c}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: c,
                border: c.toLowerCase() === accentColor.toLowerCase()
                  ? `3px solid var(--accent)`
                  : "2px solid var(--border)",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            style={{ width: 56, height: 40, padding: 4, marginLeft: 4, borderRadius: 6, border: "1px solid var(--border)" }}
          />
          <input
            className="form-input"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            style={{ width: 120, marginLeft: 4, fontFamily: "var(--font-mono)" }}
          />
        </div>
      </SettingsCard>

      <SettingsCard title="Cabecera personalizada" subtitle="Mensaje visible en login y bienvenida.">
        <div className="form-group">
          <label className="form-label">Frase corporativa</label>
          <input
            className="form-input"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Construyendo el futuro del trabajo"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Mensaje de bienvenida</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Bienvenido al sistema de asistencia. Cualquier duda, contacta a RRHH."
          />
        </div>
      </SettingsCard>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={discard} />
    </>
  );
}
