"use client";

/**
 * Settings → General
 * Company name (read-only), slug (read-only), timezone (editable), plan info.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Globe, Hash, CheckCircle2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsFooter } from "@/components/admin/settings/SettingsFooter";
import {
  useTenantSettings,
  useSaveTenantSettings,
} from "@/hooks/use-tenant-settings";
import { TIMEZONES } from "@/lib/constants/tenant-defaults";

export default function GeneralSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();

  const tenant = data?.tenant;
  const [timezone, setTimezone] = useState("America/Lima");
  const [savedTimezone, setSavedTimezone] = useState("America/Lima");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenant?.settings?.timezone) {
      setTimezone(tenant.settings.timezone);
      setSavedTimezone(tenant.settings.timezone);
    }
  }, [tenant]);

  const dirty = timezone !== savedTimezone;

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({ settings: { timezone } });
      setSavedTimezone(timezone);
      toast.success("Zona horaria actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !tenant) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <SettingsSection
      icon={Building2}
      title="Información general"
      description="Datos básicos de tu empresa y zona horaria"
      rightSlot={
        <Badge variant="outline" className="text-[10px] uppercase">
          Plan {tenant.plan}
        </Badge>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                <Building2 className="mr-1 inline h-3 w-3" />
                Nombre de la empresa
              </Label>
              <Input
                value={tenant.name}
                disabled
                className="h-10 bg-muted/40"
              />
              <p className="text-xs text-muted-foreground">
                Para cambiarlo, contacta soporte.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                <Hash className="mr-1 inline h-3 w-3" />
                Identificador público
              </Label>
              <Input
                value={tenant.slug}
                disabled
                className="h-10 bg-muted/40 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Se usa en los enlaces de invitación.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zona horaria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-xs text-muted-foreground">
              <Globe className="mr-1 inline h-3 w-3" />
              Esta zona se usa para las marcaciones, reportes y feriados.
            </Label>
            <Select
              value={timezone}
              onValueChange={(v) => {
                if (v) setTimezone(v);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan y estado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Plan actual
            </div>
            <p className="mt-1 text-lg font-semibold">{tenant.plan}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Estado
            </div>
            <p className="mt-1 text-lg font-semibold">
              {tenant.status === "ACTIVE" ? "Activo" : tenant.status}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Máx. empleados
            </div>
            <p className="mt-1 text-lg font-semibold">{tenant.maxEmployees}</p>
          </div>
        </CardContent>
      </Card>

      <SettingsFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => setTimezone(savedTimezone)}
      />
    </SettingsSection>
  );
}
