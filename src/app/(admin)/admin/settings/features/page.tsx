"use client";

/**
 * Settings → Features + approval workflow
 * Toggles for chat/social/AI assistant + whether self-service regs need approval.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  MessageSquare,
  Users,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsFooter } from "@/components/admin/settings/SettingsFooter";
import {
  useTenantSettings,
  useSaveTenantSettings,
} from "@/hooks/use-tenant-settings";
import {
  DEFAULT_FEATURES,
  type TenantFeatures,
} from "@/lib/constants/tenant-defaults";

export default function FeaturesSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [features, setFeatures] = useState<TenantFeatures>(DEFAULT_FEATURES);
  const [savedFeatures, setSavedFeatures] =
    useState<TenantFeatures>(DEFAULT_FEATURES);
  const [approval, setApproval] = useState(false);
  const [savedApproval, setSavedApproval] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    const f = { ...DEFAULT_FEATURES, ...tenant.settings.features };
    setFeatures(f);
    setSavedFeatures(f);
    setApproval(!!tenant.settings.approvalRequired);
    setSavedApproval(!!tenant.settings.approvalRequired);
  }, [tenant]);

  const dirty =
    JSON.stringify(features) !== JSON.stringify(savedFeatures) ||
    approval !== savedApproval;

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({
        settings: { features, approvalRequired: approval },
      });
      setSavedFeatures({ ...features });
      setSavedApproval(approval);
      toast.success("Configuración guardada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !tenant) return <Skeleton className="h-96 w-full" />;

  return (
    <SettingsSection
      icon={Sparkles}
      title="Funcionalidades"
      description="Activa módulos opcionales y el flujo de aprobaciones"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos opcionales</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada módulo aparece como una entrada en el sidebar cuando está
            activo
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <FeatureRow
            icon={MessageSquare}
            tint="text-violet-600 bg-violet-50 dark:bg-violet-950/40"
            label="Chat entre empleados"
            description="Conversaciones privadas y canales de grupo"
            checked={features.chat}
            onChange={(v) => setFeatures({ ...features, chat: v })}
          />
          <FeatureRow
            icon={Users}
            tint="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
            label="Red social interna"
            description="Feed de posts, reacciones y comentarios"
            checked={features.social}
            onChange={(v) => setFeatures({ ...features, social: v })}
          />
          <FeatureRow
            icon={Zap}
            tint="text-amber-600 bg-amber-50 dark:bg-amber-950/40"
            label="Asistente con IA"
            description="Preguntas sobre asistencia asistidas por IA"
            checked={features.aiAssistant}
            onChange={(v) => setFeatures({ ...features, aiAssistant: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flujo de aprobaciones</CardTitle>
          <p className="text-xs text-muted-foreground">
            Define si las regularizaciones de los empleados necesitan
            aprobación de un admin
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Requerir aprobación</p>
                <p className="text-xs text-muted-foreground">
                  Si está activo, las regularizaciones propias pasan por revisión.
                  Si está desactivado, se aplican directamente.
                </p>
              </div>
            </div>
            <Switch checked={approval} onCheckedChange={setApproval} />
          </div>
        </CardContent>
      </Card>

      <SettingsFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => {
          setFeatures(savedFeatures);
          setApproval(savedApproval);
        }}
      />
    </SettingsSection>
  );
}

function FeatureRow({
  icon: Icon,
  tint,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  tint: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 transition hover:bg-muted/30">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
