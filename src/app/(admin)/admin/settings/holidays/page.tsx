"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTenantSettings, useSaveTenantSettings } from "@/hooks/use-tenant-settings";
import { getPeruHolidays, type Holiday } from "@/lib/constants/tenant-defaults";
import { SettingsCard, SaveBar } from "@/components/admin/settings/SettingsCard";
import { IconSvg, Icons } from "@/components/nova/icons";

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

interface HolidayRow extends Holiday {
  type: "Nacional" | "Empresa";
}

function formatShortDate(d: string): string {
  const dt = new Date(d + "T12:00:00");
  return `${String(dt.getDate()).padStart(2, "0")} ${MONTH_SHORT[dt.getMonth()].charAt(0).toUpperCase() + MONTH_SHORT[dt.getMonth()].slice(1)}`;
}

export default function HolidaysSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [savedHolidays, setSavedHolidays] = useState<HolidayRow[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const list: HolidayRow[] = ((tenant?.settings?.holidays ?? []) as Holiday[]).map((h) => ({
      ...h,
      type: (h as HolidayRow).type ?? "Nacional",
    }));
    setHolidays(list);
    setSavedHolidays(list);
  }, [tenant]);

  const filtered = useMemo(
    () =>
      holidays
        .filter((h) => h.date.startsWith(String(year)))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, year]
  );

  const dirty = useMemo(() => {
    if (holidays.length !== savedHolidays.length) return true;
    return holidays.some((h, i) => {
      const s = savedHolidays[i];
      return !s || s.date !== h.date || s.name !== h.name || s.type !== h.type;
    });
  }, [holidays, savedHolidays]);

  function discard() {
    setHolidays(savedHolidays);
  }

  function addHoliday() {
    if (!newDate || !newName.trim()) {
      toast.error("Completa fecha y nombre");
      return;
    }
    if (holidays.find((h) => h.date === newDate)) {
      toast.error("Ya existe un feriado en esa fecha");
      return;
    }
    setHolidays((prev) =>
      [...prev, { date: newDate, name: newName.trim(), type: "Empresa" as const }].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    );
    setNewDate("");
    setNewName("");
  }

  function removeHoliday(date: string) {
    setHolidays((prev) => prev.filter((h) => h.date !== date));
  }

  function importPeruHolidays() {
    const peru: HolidayRow[] = getPeruHolidays(year).map((h) => ({ ...h, type: "Nacional" as const }));
    const existing = new Set(holidays.map((h) => h.date));
    const merged = [
      ...holidays,
      ...peru.filter((h) => !existing.has(h.date)),
    ].sort((a, b) => a.date.localeCompare(b.date));
    setHolidays(merged);
    toast.success(`${peru.filter((h) => !existing.has(h.date)).length} feriados de Perú agregados`);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({
        settings: { holidays: holidays.map(({ date, name, type }) => ({ date, name, type })) },
      });
      setSavedHolidays(holidays);
      toast.success("Feriados actualizados");
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
        title={`Calendario ${year}`}
        subtitle="Feriados nacionales y días especiales de la empresa."
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
          <select
            className="form-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ width: 140 }}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button type="button" className="btn outline btn-sm" onClick={importPeruHolidays}>
            <IconSvg d={Icons.download} size={13} /> Importar de Perú
          </button>
        </div>

        {/* Add holiday form */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            padding: 12,
            background: "var(--bg-subtle)",
            borderRadius: "var(--r)",
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <div className="form-group" style={{ marginBottom: 0, flex: "0 0 160px" }}>
            <label className="form-label">Fecha</label>
            <input
              type="date"
              className="form-input"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label className="form-label">Nombre</label>
            <input
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Aniversario de la empresa"
            />
          </div>
          <button type="button" className="btn primary btn-md" onClick={addHoliday}>
            <IconSvg d={Icons.plus} size={13} /> Agregar
          </button>
        </div>

        {/* Holidays table */}
        <table className="table cards" style={{ border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Fecha</th>
              <th>Nombre</th>
              <th style={{ width: 120 }}>Tipo</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  Sin feriados para {year}
                </td>
              </tr>
            ) : (
              filtered.map((h) => (
                <tr key={h.date}>
                  <td className="tcell-mono" data-label="Fecha">{formatShortDate(h.date)}</td>
                  <td className="tcell-strong" data-label="Nombre">{h.name}</td>
                  <td data-label="Tipo">
                    <span className={`type-tag ${h.type === "Nacional" ? "accent" : "warn"}`}>{h.type}</span>
                  </td>
                  <td className="card-actions" style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn ghost btn-sm"
                      onClick={() => removeHoliday(h.date)}
                      aria-label={`Eliminar ${h.name}`}
                    >
                      <IconSvg d={Icons.trash} size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </SettingsCard>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={discard} />
    </>
  );
}
