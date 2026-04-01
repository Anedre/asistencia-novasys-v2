"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Settings,
  Calendar,
  Bell,
  Clock,
  Building2,
  Plus,
  Trash2,
  Save,
  Loader2,
  ArrowUpDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Holiday {
  date: string; // ISO date string YYYY-MM-DD
  name: string;
}

interface ScheduleSettings {
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

interface NotificationSettings {
  approvals: boolean;
  rejections: boolean;
  birthdays: boolean;
  lateArrivals: boolean;
  pendingRequests: boolean;
}

// ---------------------------------------------------------------------------
// Default data
// ---------------------------------------------------------------------------

const DEFAULT_HOLIDAYS: Holiday[] = [
  { date: "2026-01-01", name: "Ano Nuevo" },
  { date: "2026-04-09", name: "Jueves Santo" },
  { date: "2026-04-10", name: "Viernes Santo" },
  { date: "2026-05-01", name: "Dia del Trabajo" },
  { date: "2026-06-29", name: "San Pedro y San Pablo" },
  { date: "2026-07-28", name: "Fiestas Patrias" },
  { date: "2026-07-29", name: "Fiestas Patrias" },
  { date: "2026-08-30", name: "Santa Rosa de Lima" },
  { date: "2026-10-08", name: "Combate de Angamos" },
  { date: "2026-11-01", name: "Todos los Santos" },
  { date: "2026-12-08", name: "Inmaculada Concepcion" },
  { date: "2026-12-25", name: "Navidad" },
];

const DEFAULT_SCHEDULE: ScheduleSettings = {
  startTime: "09:00",
  endTime: "18:00",
  breakMinutes: 60,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  approvals: true,
  rejections: true,
  birthdays: true,
  lateArrivals: false,
  pendingRequests: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function calculateWorkHours(
  start: string,
  end: string,
  breakMin: number
): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMin = eh * 60 + em - (sh * 60 + sm) - breakMin;
  if (totalMin <= 0) return "0h 0m";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function saveSetting(key: string, value: unknown) {
  const res = await fetch("/api/tenant/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ SettingKey: key, value }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Error al guardar");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  // -- Schedule state -------------------------------------------------------
  const [schedule, setSchedule] = useState<ScheduleSettings>(DEFAULT_SCHEDULE);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // -- Holidays state -------------------------------------------------------
  const [holidays, setHolidays] = useState<Holiday[]>(DEFAULT_HOLIDAYS);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [savingHolidays, setSavingHolidays] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  // -- Notifications state --------------------------------------------------
  const [notifications, setNotifications] =
    useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // -- Fetch initial settings on mount --------------------------------------
  useEffect(() => {
    fetch("/api/tenant/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.tenant?.settings) return;
        const s = data.tenant.settings;
        if (s.defaultSchedule) setSchedule(s.defaultSchedule);
        if (s.holidays) setHolidays(s.holidays);
        if (s.notifications) setNotifications(s.notifications);
      })
      .catch(() => {
        // Silently use defaults
      });
  }, []);

  // -- Derived values -------------------------------------------------------
  const workHours = useMemo(
    () =>
      calculateWorkHours(
        schedule.startTime,
        schedule.endTime,
        schedule.breakMinutes
      ),
    [schedule]
  );

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((a, b) =>
      sortAsc
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date)
    );
  }, [holidays, sortAsc]);

  // -- Save handlers --------------------------------------------------------
  const handleSaveSchedule = useCallback(async () => {
    setSavingSchedule(true);
    try {
      await saveSetting("defaultSchedule", schedule);
      toast.success("Horario guardado correctamente");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar horario"
      );
    } finally {
      setSavingSchedule(false);
    }
  }, [schedule]);

  const handleSaveHolidays = useCallback(async () => {
    setSavingHolidays(true);
    try {
      await saveSetting("holidays", holidays);
      toast.success("Feriados guardados correctamente");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar feriados"
      );
    } finally {
      setSavingHolidays(false);
    }
  }, [holidays]);

  const handleSaveNotifications = useCallback(async () => {
    setSavingNotifications(true);
    try {
      await saveSetting("notifications", notifications);
      toast.success("Notificaciones guardadas correctamente");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar notificaciones"
      );
    } finally {
      setSavingNotifications(false);
    }
  }, [notifications]);

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast.error("Ingrese fecha y nombre del feriado");
      return;
    }
    const exists = holidays.some((h) => h.date === newHolidayDate);
    if (exists) {
      toast.error("Ya existe un feriado en esa fecha");
      return;
    }
    setHolidays((prev) => [
      ...prev,
      { date: newHolidayDate, name: newHolidayName.trim() },
    ]);
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const handleRemoveHoliday = (date: string) => {
    setHolidays((prev) => prev.filter((h) => h.date !== date));
  };

  // -- Render ---------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Configuracion del Sistema
        </h1>
        <p className="text-muted-foreground">
          Administra horarios, feriados, notificaciones y parametros generales
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="general">
            <Building2 className="mr-1.5 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="horarios">
            <Clock className="mr-1.5 h-4 w-4" />
            Horarios
          </TabsTrigger>
          <TabsTrigger value="feriados">
            <Calendar className="mr-1.5 h-4 w-4" />
            Feriados
          </TabsTrigger>
          <TabsTrigger value="notificaciones">
            <Bell className="mr-1.5 h-4 w-4" />
            Notificaciones
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB: General                                                     */}
        {/* ================================================================ */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  Informacion del Sistema
                </CardTitle>
              </div>
              <CardDescription>
                Datos generales de la empresa y del entorno
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Company info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Empresa
                  </h3>
                  <InfoRow label="Empresa" value="Novasys Consultores" />
                  <InfoRow label="RUC" value="20XXXXXXXXX" />
                  <InfoRow
                    label="Zona Horaria"
                    value="America/Lima (UTC-5)"
                  />
                </div>

                {/* System info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Sistema
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Version
                    </span>
                    <Badge variant="secondary">v2.0.0</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Entorno
                    </span>
                    <Badge variant="outline">Desarrollo</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Prefijo de tablas
                    </span>
                    <code className="rounded bg-muted px-2 py-0.5 text-sm">
                      NovasysV2_
                    </code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: Horarios                                                    */}
        {/* ================================================================ */}
        <TabsContent value="horarios">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  Horario Laboral Predeterminado
                </CardTitle>
              </div>
              <CardDescription>
                Estos valores se aplican a nuevos empleados. Modifica y guarda
                los cambios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Time inputs */}
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Hora de Entrada</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={schedule.startTime}
                    onChange={(e) =>
                      setSchedule((s) => ({
                        ...s,
                        startTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">Hora de Salida</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={schedule.endTime}
                    onChange={(e) =>
                      setSchedule((s) => ({
                        ...s,
                        endTime: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="break-minutes">Minutos de Break</Label>
                  <Input
                    id="break-minutes"
                    type="number"
                    min={0}
                    max={180}
                    value={schedule.breakMinutes}
                    onChange={(e) =>
                      setSchedule((s) => ({
                        ...s,
                        breakMinutes: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Summary + Save */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Horas de trabajo efectivas:{" "}
                  </span>
                  <span className="font-semibold text-foreground">
                    {workHours}
                  </span>
                  <span className="ml-3 text-muted-foreground">
                    ({schedule.startTime} - {schedule.endTime}, {schedule.breakMinutes} min break)
                  </span>
                </div>
                <Button
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule}
                  size="sm"
                >
                  {savingSchedule ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Guardar Horario
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: Feriados                                                    */}
        {/* ================================================================ */}
        <TabsContent value="feriados">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">
                    Dias Feriados {new Date().getFullYear()}
                  </CardTitle>
                </div>
                <Badge variant="secondary">
                  {holidays.length} feriado{holidays.length !== 1 && "s"}
                </Badge>
              </div>
              <CardDescription>
                Agrega o elimina feriados. Los cambios se guardan manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add holiday form */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="new-holiday-date" className="text-xs">
                    Fecha
                  </Label>
                  <Input
                    id="new-holiday-date"
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                  />
                </div>
                <div className="flex-[2] space-y-1.5">
                  <Label htmlFor="new-holiday-name" className="text-xs">
                    Nombre del feriado
                  </Label>
                  <Input
                    id="new-holiday-name"
                    type="text"
                    placeholder="Ej: Dia de la Independencia"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddHoliday();
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddHoliday}
                  className="shrink-0"
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Agregar
                </Button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">
                        <button
                          type="button"
                          onClick={() => setSortAsc((v) => !v)}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                        >
                          Fecha
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        </button>
                      </TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedHolidays.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-8"
                        >
                          No hay feriados registrados
                        </TableCell>
                      </TableRow>
                    )}
                    {sortedHolidays.map((h) => (
                      <TableRow key={h.date}>
                        <TableCell className="font-medium">
                          {formatDate(h.date)}
                        </TableCell>
                        <TableCell>{h.name}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveHoliday(h.date)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Save holidays */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveHolidays}
                  disabled={savingHolidays}
                  size="sm"
                >
                  {savingHolidays ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Guardar Feriados
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: Notificaciones                                              */}
        {/* ================================================================ */}
        <TabsContent value="notificaciones">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  Preferencias de Notificacion
                </CardTitle>
              </div>
              <CardDescription>
                Controla que notificaciones se envian a los administradores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <NotificationRow
                id="notify-approvals"
                label="Notificar al aprobar solicitudes"
                description="Se envia al empleado cuando su solicitud es aprobada"
                checked={notifications.approvals}
                onChange={(val) =>
                  setNotifications((n) => ({ ...n, approvals: val }))
                }
              />
              <NotificationRow
                id="notify-rejections"
                label="Notificar al rechazar solicitudes"
                description="Se envia al empleado cuando su solicitud es rechazada"
                checked={notifications.rejections}
                onChange={(val) =>
                  setNotifications((n) => ({ ...n, rejections: val }))
                }
              />
              <NotificationRow
                id="notify-birthdays"
                label="Notificar cumpleanos del dia"
                description="Aviso diario de cumpleanos de empleados"
                checked={notifications.birthdays}
                onChange={(val) =>
                  setNotifications((n) => ({ ...n, birthdays: val }))
                }
              />
              <NotificationRow
                id="notify-late"
                label="Alertas de tardanza"
                description="Notificar cuando un empleado no registra entrada a tiempo"
                checked={notifications.lateArrivals}
                onChange={(val) =>
                  setNotifications((n) => ({ ...n, lateArrivals: val }))
                }
              />
              <NotificationRow
                id="notify-pending"
                label="Solicitudes pendientes"
                description="Recordatorio de solicitudes sin atender por mas de 48h"
                checked={notifications.pendingRequests}
                onChange={(val) =>
                  setNotifications((n) => ({ ...n, pendingRequests: val }))
                }
              />

              {/* Save */}
              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveNotifications}
                  disabled={savingNotifications}
                  size="sm"
                >
                  {savingNotifications ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  Guardar Notificaciones
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function NotificationRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/50">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(val: boolean) => onChange(val)}
      />
    </div>
  );
}
