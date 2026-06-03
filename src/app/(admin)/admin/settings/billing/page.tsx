"use client";

import { EmptySettings } from "@/components/admin/settings/EmptySettings";
import { Icons } from "@/components/nova/icons";

export default function BillingSettingsPage() {
  return (
    <EmptySettings
      icon={Icons.dollar}
      title="Facturación en construcción"
      subtitle="Pronto podrás revisar tu plan, métodos de pago y facturas."
    />
  );
}
