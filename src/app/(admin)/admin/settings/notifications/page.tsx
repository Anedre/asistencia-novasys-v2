"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTenantSettings, useSaveTenantSettings } from "@/hooks/use-tenant-settings";
import { SettingsCard, SaveBar } from "@/components/admin/settings/SettingsCard";

/* ============================================================
   Notification matrix — events × channels
   ============================================================ */

interface NotifRow {
  key: string;
  label: string;
  email: boolean;
  push: boolean;
  app: boolean;
}

const DEFAULTS: NotifRow[] = [
  { key: "newRequest", label: "Nueva solicitud por aprobar", email: true, push: true, app: true },
  { key: "offHours", label: "Marcación fuera de horario", email: true, push: false, app: true },
  { key: "anomaly", label: "Anomalía detectada en jornada", email: true, push: true, app: true },
  { key: "approval", label: "Aprobación de solicitud", email: true, push: true, app: true },
  { key: "weekly", label: "Resumen semanal de asistencia", email: true, push: false, app: false },
  { key: "newEmployee", label: "Nuevo empleado registrado", email: false, push: false, app: true },
  { key: "docs", label: "Recordatorio: documentos por firmar", email: true, push: true, app: true },
];

export default function NotificationsSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [rows, setRows] = useState<NotifRow[]>(DEFAULTS);
  const [savedRows, setSavedRows] = useState<NotifRow[]>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const matrix = (tenant?.settings?.notifications as Record<string, { email?: boolean; push?: boolean; app?: boolean }> | undefined) ?? {};
    const merged = DEFAULTS.map((d) => ({
      ...d,
      email: matrix[d.key]?.email ?? d.email,
      push: matrix[d.key]?.push ?? d.push,
      app: matrix[d.key]?.app ?? d.app,
    }));
    setRows(merged);
    setSavedRows(merged);
  }, [tenant]);

  const dirty = useMemo(
    () =>
      rows.some((r, i) => {
        const s = savedRows[i];
        return r.email !== s.email || r.push !== s.push || r.app !== s.app;
      }),
    [rows, savedRows]
  );

  function discard() {
    setRows(savedRows);
  }

  function toggle(key: string, channel: "email" | "push" | "app") {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [channel]: !r[channel] } : r))
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const matrix: Record<string, { email: boolean; push: boolean; app: boolean }> = {};
      rows.forEach((r) => {
        matrix[r.key] = { email: r.email, push: r.push, app: r.app };
      });
      await saveTenantSettings({ settings: { notifications: matrix } });
      setSavedRows(rows);
      toast.success("Notificaciones actualizadas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
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
      <SettingsCard title="Notificaciones" subtitle="Decide cuándo y cómo recibir alertas.">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "10px 0",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Evento
              </th>
              <th
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  width: 80,
                }}
              >
                Email
              </th>
              <th
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  width: 80,
                }}
              >
                Push
              </th>
              <th
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  width: 80,
                }}
              >
                App
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 0", fontSize: 13, color: "var(--text-primary)" }}>{r.label}</td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={r.email}
                    onChange={() => toggle(r.key, "email")}
                    style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={r.push}
                    onChange={() => toggle(r.key, "push")}
                    style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={r.app}
                    onChange={() => toggle(r.key, "app")}
                    style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsCard>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={discard} />
    </>
  );
}
