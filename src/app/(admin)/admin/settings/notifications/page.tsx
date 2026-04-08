"use client";

/**
 * Settings → Notifications
 * Toggles for each notification type.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  XCircle,
  Cake,
  Clock,
  Inbox,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsFooter } from "@/components/admin/settings/SettingsFooter";
import {
  useTenantSettings,
  useSaveTenantSettings,
} from "@/hooks/use-tenant-settings";
import {
  DEFAULT_NOTIFICATIONS,
  type NotificationSettings,
} from "@/lib/constants/tenant-defaults";

const ROWS: {
  key: keyof NotificationSettings;
  label: string;
  description: string;
  icon: React.ElementType;
  tint: string;
}[] = [
  {
    key: "approvals",
    label: "Solicitudes aprobadas",
    description: "Notificar cuando una solicitud es aprobada",
    icon: CheckCircle2,
    tint: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
  },
  {
    key: "rejections",
    label: "Solicitudes rechazadas",
    description: "Notificar cuando una solicitud es rechazada",
    icon: XCircle,
    tint: "text-red-600 bg-red-50 dark:bg-red-950/40",
  },
  {
    key: "pendingRequests",
    label: "Solicitudes pendientes",
    description: "Recordar al admin cuando hay solicitudes por revisar",
    icon: Inbox,
    tint: "text-sky-600 bg-sky-50 dark:bg-sky-950/40",
  },
  {
    key: "birthdays",
    label: "Cumpleaños",
    description: "Notificar cuando un empleado cumple años",
    icon: Cake,
    tint: "text-pink-600 bg-pink-50 dark:bg-pink-950/40",
  },
  {
    key: "lateArrivals",
    label: "Llegadas tarde",
    description: "Avisar cuando alguien marca entrada después del horario",
    icon: Clock,
    tint: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
  },
];

export default function NotificationsSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [values, setValues] =
    useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [saved, setSaved] =
    useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    const notif = (tenant.settings.notifications ??
      DEFAULT_NOTIFICATIONS) as NotificationSettings;
    const merged = { ...DEFAULT_NOTIFICATIONS, ...notif };
    setValues(merged);
    setSaved(merged);
  }, [tenant]);

  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({ settings: { notifications: values } });
      setSaved({ ...values });
      toast.success("Notificaciones guardadas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !tenant) return <Skeleton className="h-96 w-full" />;

  return (
    <SettingsSection
      icon={Bell}
      title="Notificaciones"
      description="Activa o desactiva los avisos automáticos del sistema"
    >
      <Card>
        <CardContent className="space-y-2 p-4">
          {ROWS.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 transition hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${row.tint}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={values[row.key]}
                  onCheckedChange={(v) =>
                    setValues({ ...values, [row.key]: v })
                  }
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <SettingsFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => setValues(saved)}
      />
    </SettingsSection>
  );
}
