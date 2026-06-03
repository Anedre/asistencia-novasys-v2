"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTenantSettings, useSaveTenantSettings } from "@/hooks/use-tenant-settings";
import { SettingsCard, SaveBar } from "@/components/admin/settings/SettingsCard";
import { IconSvg, Icons } from "@/components/nova/icons";

/* ============================================================
   Toggle inline (matches design)
   ============================================================ */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        cursor: "pointer",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</span>
      <span className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
        <span className="toggle-knob" />
      </span>
    </label>
  );
}

interface Shift {
  name: string;
  range: string;
  days: string;
  tolerance: string;
  employees: number;
  color: "accent" | "warn" | "success";
}

export default function ScheduleSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [tolerance, setTolerance] = useState(15);
  const [minBreak, setMinBreak] = useState(30);
  const [allowOffHours, setAllowOffHours] = useState(false);
  const [requireGps, setRequireGps] = useState(true);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [autoCloseShifts, setAutoCloseShifts] = useState(true);
  const [saving, setSaving] = useState(false);

  const saved = useMemo(
    () => ({
      startTime: tenant?.settings?.workSchedule?.startTime ?? "09:00",
      endTime: tenant?.settings?.workSchedule?.endTime ?? "18:00",
      breakMinutes: tenant?.settings?.workSchedule?.breakMinutes ?? 60,
      tolerance: tenant?.settings?.workSchedule?.toleranceMinutes ?? 15,
      minBreak: tenant?.settings?.workSchedule?.minBreakMinutes ?? 30,
      allowOffHours: tenant?.settings?.workSchedule?.allowOffHours ?? false,
      requireGps: tenant?.settings?.workSchedule?.requireGps ?? true,
      requirePhoto: tenant?.settings?.workSchedule?.requirePhoto ?? false,
      autoCloseShifts: tenant?.settings?.workSchedule?.autoCloseShifts ?? true,
    }),
    [tenant]
  );

  useEffect(() => {
    setStartTime(saved.startTime);
    setEndTime(saved.endTime);
    setBreakMinutes(saved.breakMinutes);
    setTolerance(saved.tolerance);
    setMinBreak(saved.minBreak);
    setAllowOffHours(saved.allowOffHours);
    setRequireGps(saved.requireGps);
    setRequirePhoto(saved.requirePhoto);
    setAutoCloseShifts(saved.autoCloseShifts);
  }, [saved]);

  const dirty =
    startTime !== saved.startTime ||
    endTime !== saved.endTime ||
    breakMinutes !== saved.breakMinutes ||
    tolerance !== saved.tolerance ||
    minBreak !== saved.minBreak ||
    allowOffHours !== saved.allowOffHours ||
    requireGps !== saved.requireGps ||
    requirePhoto !== saved.requirePhoto ||
    autoCloseShifts !== saved.autoCloseShifts;

  function discard() {
    setStartTime(saved.startTime);
    setEndTime(saved.endTime);
    setBreakMinutes(saved.breakMinutes);
    setTolerance(saved.tolerance);
    setMinBreak(saved.minBreak);
    setAllowOffHours(saved.allowOffHours);
    setRequireGps(saved.requireGps);
    setRequirePhoto(saved.requirePhoto);
    setAutoCloseShifts(saved.autoCloseShifts);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({
        settings: {
          workSchedule: {
            startTime,
            endTime,
            breakMinutes,
            toleranceMinutes: tolerance,
            minBreakMinutes: minBreak,
            allowOffHours,
            requireGps,
            requirePhoto,
            autoCloseShifts,
          },
        },
      });
      toast.success("Horario actualizado");
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

  const standardShift: Shift = {
    name: "Estándar",
    range: `${startTime} — ${endTime}`,
    days: "Lun-Vie",
    tolerance: `${tolerance} min`,
    employees: 0,
    color: "accent",
  };

  const shifts: Shift[] = [standardShift];

  const colorVar = (c: Shift["color"]) =>
    c === "accent" ? "var(--accent)" : c === "warn" ? "var(--warn)" : "var(--success)";

  return (
    <>
      <SettingsCard title="Turnos" subtitle="Define los horarios que asignas a tus empleados.">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shifts.map((s) => (
            <div key={s.name} className="schedule-row">
              <div
                style={{
                  width: 8,
                  height: 48,
                  background: colorVar(s.color),
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tcell-strong">{s.name}</div>
                <div className="tcell-muted" style={{ fontSize: 11 }}>
                  {s.range} · {s.days} · Tolerancia: {s.tolerance}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {s.employees} empleados
              </div>
              <button type="button" className="btn ghost btn-sm" aria-label="Editar turno">
                <IconSvg d={Icons.edit} size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn outline btn-md"
            style={{ alignSelf: "flex-start", marginTop: 8 }}
          >
            <IconSvg d={Icons.plus} size={14} /> Crear turno
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Configuración de marcación" subtitle="Reglas globales para entrada y salida.">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Tolerancia entrada</label>
            <input
              type="number"
              className="form-input"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              min={0}
              max={60}
            />
            <span className="form-hint">minutos antes de marcarse tarde</span>
          </div>
          <div className="form-group">
            <label className="form-label">Break mínimo</label>
            <input
              type="number"
              className="form-input"
              value={minBreak}
              onChange={(e) => setMinBreak(Number(e.target.value))}
              min={0}
              max={120}
            />
            <span className="form-hint">minutos requeridos</span>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <Toggle
            label="Permitir marcación fuera del horario"
            checked={allowOffHours}
            onChange={setAllowOffHours}
          />
          <Toggle label="Requerir GPS para marcar" checked={requireGps} onChange={setRequireGps} />
          <Toggle
            label="Requerir foto al marcar entrada"
            checked={requirePhoto}
            onChange={setRequirePhoto}
          />
          <Toggle
            label="Cerrar jornadas abiertas automáticamente a las 23:59"
            checked={autoCloseShifts}
            onChange={setAutoCloseShifts}
          />
        </div>
      </SettingsCard>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={discard} />
    </>
  );
}
