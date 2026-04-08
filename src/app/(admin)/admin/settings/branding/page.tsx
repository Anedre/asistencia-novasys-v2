"use client";

/**
 * Settings → Branding
 * Logo upload + primary color picker + live preview.
 *
 * The logo uploads immediately to S3 via /api/admin/tenant/logo and is
 * applied to tenant.branding.logoUrl. Color changes are batched until the
 * admin clicks Save (to avoid spamming the tenant settings endpoint).
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Palette, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsFooter } from "@/components/admin/settings/SettingsFooter";
import { ColorPicker } from "@/components/admin/settings/ColorPicker";
import { LogoUploader } from "@/components/admin/settings/LogoUploader";
import {
  useTenantSettings,
  useSaveTenantSettings,
} from "@/hooks/use-tenant-settings";

export default function BrandingSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [savedColor, setSavedColor] = useState("#6366f1");
  // Logo is managed by the uploader, which talks directly to the upload
  // endpoint — the state here only mirrors what the server returned so the
  // preview updates without a full refetch.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setPrimaryColor(tenant.branding?.primaryColor ?? "#6366f1");
    setSavedColor(tenant.branding?.primaryColor ?? "#6366f1");
    setLogoUrl(tenant.branding?.logoUrl ?? null);
  }, [tenant]);

  const dirty = primaryColor !== savedColor;

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({
        branding: {
          primaryColor,
          secondaryColor: primaryColor,
          accentColor: primaryColor,
        },
      });
      setSavedColor(primaryColor);
      toast.success("Marca actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !tenant) return <Skeleton className="h-96 w-full" />;

  return (
    <SettingsSection
      icon={Palette}
      title="Marca de la empresa"
      description="Logo y colores que ven los empleados"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Se usa en la barra lateral, los correos de invitación y los reportes
          </p>
        </CardHeader>
        <CardContent>
          <LogoUploader
            value={logoUrl}
            onChange={(v) => {
              setLogoUrl(v);
              if (v) {
                toast.success("Logo actualizado");
              }
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Color principal</CardTitle>
          <p className="text-xs text-muted-foreground">
            Se aplica a botones, links y acentos de la interfaz
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Elige un color</Label>
            <ColorPicker value={primaryColor} onChange={setPrimaryColor} />
          </div>
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previsualización</CardTitle>
          <p className="text-xs text-muted-foreground">
            Así se ve tu marca aplicada a los elementos principales
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-muted/10 p-5">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm"
                style={{ background: primaryColor }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-11 w-11 rounded-lg object-contain"
                  />
                ) : (
                  <Building2 className="h-6 w-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{tenant.name}</p>
                <p className="text-xs text-muted-foreground">
                  Botones y enlaces usarán este color
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                    style={{ background: primaryColor }}
                  >
                    Botón primario
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    style={{
                      borderColor: primaryColor,
                      color: primaryColor,
                    }}
                  >
                    Botón outline
                  </button>
                  <span
                    className="text-xs font-medium"
                    style={{ color: primaryColor }}
                  >
                    Link ejemplo →
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingsFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => setPrimaryColor(savedColor)}
      />
    </SettingsSection>
  );
}
