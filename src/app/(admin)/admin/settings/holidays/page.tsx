"use client";

/**
 * Settings → Holidays
 * Editable list of non-working days, grouped by month. Peru template loader.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsFooter } from "@/components/admin/settings/SettingsFooter";
import {
  useTenantSettings,
  useSaveTenantSettings,
} from "@/hooks/use-tenant-settings";
import {
  getPeruHolidays,
  type Holiday,
} from "@/lib/constants/tenant-defaults";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatShort(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-PE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return iso;
  }
}

export default function HolidaysSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [saved, setSaved] = useState<Holiday[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const list = tenant?.settings?.holidays ?? [];
    setHolidays(list);
    setSaved(list);
  }, [tenant]);

  const dirty = JSON.stringify(holidays) !== JSON.stringify(saved);

  const grouped = useMemo(() => {
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    const groups = new Map<number, Holiday[]>();
    for (const h of sorted) {
      const month = new Date(h.date + "T00:00:00").getMonth();
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(h);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [holidays]);

  function handleAdd() {
    if (!newDate || !newName.trim()) {
      toast.error("Ingresa fecha y nombre");
      return;
    }
    if (holidays.some((h) => h.date === newDate)) {
      toast.error("Ya existe un feriado en esa fecha");
      return;
    }
    setHolidays((prev) => [...prev, { date: newDate, name: newName.trim() }]);
    setNewDate("");
    setNewName("");
  }

  function handleRemove(date: string) {
    setHolidays((prev) => prev.filter((h) => h.date !== date));
  }

  function handleLoadTemplate() {
    const year = new Date().getFullYear();
    const template = getPeruHolidays(year);
    const merged = [...holidays];
    let added = 0;
    for (const h of template) {
      if (!merged.some((x) => x.date === h.date)) {
        merged.push(h);
        added++;
      }
    }
    setHolidays(merged);
    toast.success(`${added} feriado(s) agregado(s) de la plantilla Perú ${year}`);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({ settings: { holidays } });
      setSaved([...holidays]);
      toast.success("Feriados guardados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !tenant) return <Skeleton className="h-96 w-full" />;

  return (
    <SettingsSection
      icon={CalendarDays}
      title="Feriados"
      description="Días bloqueados que no se pueden regularizar"
    >
      {/* Add row */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agregar feriado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="new-date" className="text-xs">
                Fecha
              </Label>
              <Input
                id="new-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-name" className="text-xs">
                Nombre
              </Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Día del trabajo"
                className="h-10"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} className="h-10">
                <Plus className="mr-1 h-4 w-4" /> Agregar
              </Button>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadTemplate}
                className="h-10"
              >
                <Download className="mr-1 h-4 w-4" /> Plantilla Perú
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grouped list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {holidays.length} feriado{holidays.length === 1 ? "" : "s"} configurado{holidays.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no hay feriados. Agrega uno arriba o carga la plantilla.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([month, items]) => (
                <div key={month}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {MONTH_NAMES[month]}
                  </h3>
                  <div className="divide-y overflow-hidden rounded-lg border">
                    {items.map((h) => (
                      <div
                        key={h.date}
                        className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-muted/30"
                      >
                        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                          <span className="text-[9px] uppercase leading-none">
                            {MONTH_NAMES[month].slice(0, 3)}
                          </span>
                          <span className="text-sm font-bold leading-tight">
                            {h.date.split("-")[2]}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{h.name}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {formatShort(h.date)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(h.date)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SettingsFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => setHolidays(saved)}
      />
    </SettingsSection>
  );
}
