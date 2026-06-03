"use client";

import { EmptySettings } from "@/components/admin/settings/EmptySettings";
import { Icons } from "@/components/nova/icons";

export default function SecuritySettingsPage() {
  return (
    <EmptySettings
      icon={Icons.shield}
      title="Seguridad en construcción"
      subtitle="Pronto podrás administrar SSO, 2FA y políticas de acceso."
    />
  );
}
