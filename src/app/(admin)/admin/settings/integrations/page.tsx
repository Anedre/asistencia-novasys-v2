"use client";

import { EmptySettings } from "@/components/admin/settings/EmptySettings";
import { Icons } from "@/components/nova/icons";

export default function IntegrationsSettingsPage() {
  return (
    <EmptySettings
      icon={Icons.link}
      title="Integraciones en construcción"
      subtitle="Pronto podrás conectar Novaassistance con Slack, Google Workspace y otras herramientas."
    />
  );
}
