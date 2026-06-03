"use client";

import { EmptySettings } from "@/components/admin/settings/EmptySettings";
import { Icons } from "@/components/nova/icons";

export default function SitesSettingsPage() {
  return (
    <EmptySettings
      icon={Icons.pin}
      title="Sedes en construcción"
      subtitle="Pronto podrás administrar las sedes y ubicaciones de tu organización."
    />
  );
}
