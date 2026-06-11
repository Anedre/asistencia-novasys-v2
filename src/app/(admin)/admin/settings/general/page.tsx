"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTenantSettings, useSaveTenantSettings } from "@/hooks/use-tenant-settings";
import { TIMEZONES } from "@/lib/constants/tenant-defaults";
import { SettingsCard, SaveBar } from "@/components/admin/settings/SettingsCard";

export default function GeneralSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [timezone, setTimezone] = useState("America/Lima");
  const [weekStart, setWeekStart] = useState("MONDAY");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [ruc, setRuc] = useState("");
  const [industry, setIndustry] = useState("Tecnología");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const saved = useMemo(
    () => ({
      timezone: tenant?.settings?.timezone ?? "America/Lima",
      weekStart: tenant?.settings?.weekStart ?? "MONDAY",
      dateFormat: tenant?.settings?.dateFormat ?? "DD/MM/YYYY",
      timeFormat: tenant?.settings?.timeFormat ?? "24h",
      tradeName: tenant?.name ?? tenant?.tenantName ?? "",
      legalName: tenant?.settings?.legalName ?? tenant?.name ?? "",
      ruc: tenant?.settings?.ruc ?? "",
      industry: tenant?.settings?.industry ?? "Tecnología",
      address: tenant?.settings?.address ?? "",
    }),
    [tenant]
  );

  useEffect(() => {
    setTimezone(saved.timezone);
    setWeekStart(saved.weekStart);
    setDateFormat(saved.dateFormat);
    setTimeFormat(saved.timeFormat);
    setTradeName(saved.tradeName);
    setLegalName(saved.legalName);
    setRuc(saved.ruc);
    setIndustry(saved.industry);
    setAddress(saved.address);
  }, [saved]);

  const dirty =
    timezone !== saved.timezone ||
    weekStart !== saved.weekStart ||
    dateFormat !== saved.dateFormat ||
    timeFormat !== saved.timeFormat ||
    legalName !== saved.legalName ||
    ruc !== saved.ruc ||
    industry !== saved.industry ||
    address !== saved.address;

  function discard() {
    setTimezone(saved.timezone);
    setWeekStart(saved.weekStart);
    setDateFormat(saved.dateFormat);
    setTimeFormat(saved.timeFormat);
    setTradeName(saved.tradeName);
    setLegalName(saved.legalName);
    setRuc(saved.ruc);
    setIndustry(saved.industry);
    setAddress(saved.address);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({
        settings: {
          timezone,
          weekStart,
          dateFormat,
          timeFormat,
          legalName,
          ruc,
          industry,
          address,
        },
      });
      toast.success("Configuración general actualizada");
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
      <SettingsCard
        title="Información de la empresa"
        subtitle="Datos legales y de contacto."
      >
        <div className="fill-grid min-280">
          <div className="form-group">
            <label className="form-label">Nombre comercial</label>
            <input
              className="form-input"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              disabled
            />
          </div>
          <div className="form-group">
            <label className="form-label">Razón social</label>
            <input
              className="form-input"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Tu Empresa SAC"
            />
          </div>
          <div className="form-group">
            <label className="form-label">RUC</label>
            <input
              className="form-input"
              value={ruc}
              onChange={(e) => setRuc(e.target.value)}
              placeholder="20512345678"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Industria</label>
            <select className="form-select" value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option>Tecnología</option>
              <option>Retail / Comercio</option>
              <option>Manufactura</option>
              <option>Servicios profesionales</option>
              <option>Salud</option>
              <option>Educación</option>
              <option>Otro</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Dirección fiscal</label>
            <input
              className="form-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Javier Prado Este 1234, San Isidro, Lima"
            />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Zona horaria y formato" subtitle="Cómo se muestran las fechas y horas.">
        <div className="fill-grid min-200">
          <div className="form-group">
            <label className="form-label">Zona horaria</label>
            <select className="form-select" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Inicio de semana</label>
            <select
              className="form-select"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            >
              <option value="MONDAY">Lunes</option>
              <option value="SUNDAY">Domingo</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Formato de fecha</label>
            <select
              className="form-select"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
            >
              <option>DD/MM/YYYY</option>
              <option>MM/DD/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Formato de hora</label>
            <select
              className="form-select"
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value)}
            >
              <option value="24h">24h (18:30)</option>
              <option value="12h">12h (6:30 PM)</option>
            </select>
          </div>
        </div>
      </SettingsCard>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={discard} />
    </>
  );
}
