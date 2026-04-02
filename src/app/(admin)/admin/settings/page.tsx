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
import { Skeleton } from "@/components/ui/skeleton";
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
  Shield,
  MessageSquare,
  Users,
  Sparkles,
  Briefcase,
  Ban,
  Timer,
  Globe,
  Hash,
  Zap,
  Flag,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Holiday {
  date: string;
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

interface TenantFeatures {
  chat: boolean;
  social: boolean;
  aiAssistant: boolean;
}

interface TenantData {
  name: string;
  slug: string;
  plan: string;
  status: string;
  settings: {
    approvalRequired: boolean;
    defaultScheduleType: string;
    timezone: string;
    features: TenantFeatures;
    defaultSchedule?: ScheduleSettings;
    holidays?: Holiday[];
    notifications?: Record<string, boolean>;
    workPolicy?: { allowHolidayWork: boolean; allowOvertime: boolean; strictSchedule: boolean };
  };
}

// ---------------------------------------------------------------------------
// Default data
// ---------------------------------------------------------------------------

function getDefaultHolidays(year: number): Holiday[] {
  return [
    { date: `${year}-01-01`, name: "Ano Nuevo" },
    { date: `${year}-04-09`, name: "Jueves Santo" },
    { date: `${year}-04-10`, name: "Viernes Santo" },
    { date: `${year}-05-01`, name: "Dia del Trabajo" },
    { date: `${year}-06-29`, name: "San Pedro y San Pablo" },
    { date: `${year}-07-28`, name: "Fiestas Patrias" },
    { date: `${year}-07-29`, name: "Fiestas Patrias" },
    { date: `${year}-08-30`, name: "Santa Rosa de Lima" },
    { date: `${year}-10-08`, name: "Combate de Angamos" },
    { date: `${year}-11-01`, name: "Todos los Santos" },
    { date: `${year}-12-08`, name: "Inmaculada Concepcion" },
    { date: `${year}-12-25`, name: "Navidad" },
  ];
}

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

const DEFAULT_FEATURES: TenantFeatures = {
  chat: false,
  social: false,
  aiAssistant: false,
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

function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function getMonthName(monthNum: number): string {
  return new Date(2026, monthNum, 1).toLocaleDateString("es-PE", {
    month: "long",
  });
}

function calculateWorkHours(
  start: string,
  end: string,
  breakMin: number
): { hours: number; minutes: number; label: string } {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMin = eh * 60 + em - (sh * 60 + sm) - breakMin;
  if (totalMin <= 0) return { hours: 0, minutes: 0, label: "0h" };
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { hours: h, minutes: m, label: m > 0 ? `${h}h ${m}m` : `${h}h` };
}

function timeToPercent(time: string, min = 6, max = 22): number {
  const [h, m] = time.split(":").map(Number);
  const val = h + m / 60;
  return Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
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
// Main Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);

  // -- Schedule state
  const [schedule, setSchedule] = useState<ScheduleSettings>(DEFAULT_SCHEDULE);
  const [savedSchedule, setSavedSchedule] = useState<ScheduleSettings>(DEFAULT_SCHEDULE);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // -- Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [savedHolidays, setSavedHolidays] = useState<Holiday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [savingHolidays, setSavingHolidays] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  // -- Notifications state
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [savedNotifications, setSavedNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [savingNotifications, setSavingNotifications] = useState(false);

  // -- Features, approval, timezone & work policy
  const [features, setFeatures] = useState<TenantFeatures>(DEFAULT_FEATURES);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [timezone, setTimezone] = useState("America/Lima");
  const [workPolicy, setWorkPolicy] = useState({
    allowHolidayWork: false,
    allowOvertime: true,
    strictSchedule: false,
  });
  const [savingToggle, setSavingToggle] = useState<string | null>(null);

  // -- Fetch initial settings
  useEffect(() => {
    fetch("/api/tenant/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.tenant) return;
        const t = data.tenant;
        setTenant(t);
        const s = t.settings;
        if (s.defaultSchedule) {
          setSchedule(s.defaultSchedule);
          setSavedSchedule(s.defaultSchedule);
        }
        if (s.holidays) {
          setHolidays(s.holidays);
          setSavedHolidays(s.holidays);
        }
        if (s.notifications) {
          const n = { ...DEFAULT_NOTIFICATIONS, ...s.notifications };
          setNotifications(n);
          setSavedNotifications(n);
        }
        if (s.features) setFeatures(s.features);
        if (s.approvalRequired !== undefined) setApprovalRequired(s.approvalRequired);
        if (s.timezone) setTimezone(s.timezone);
        if (s.workPolicy) setWorkPolicy(s.workPolicy);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // -- Dirty state detection
  const scheduleChanged = JSON.stringify(schedule) !== JSON.stringify(savedSchedule);
  const holidaysChanged = JSON.stringify(holidays) !== JSON.stringify(savedHolidays);
  const notificationsChanged = JSON.stringify(notifications) !== JSON.stringify(savedNotifications);

  // -- Derived values
  const workInfo = useMemo(
    () => calculateWorkHours(schedule.startTime, schedule.endTime, schedule.breakMinutes),
    [schedule]
  );

  const sortedHolidays = useMemo(() => {
    return [...holidays].sort((a, b) =>
      sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
    );
  }, [holidays, sortAsc]);

  const holidaysByMonth = useMemo(() => {
    const groups = new Map<number, Holiday[]>();
    for (const h of sortedHolidays) {
      const month = new Date(h.date + "T00:00:00").getMonth();
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(h);
    }
    return groups;
  }, [sortedHolidays]);

  // -- Save handlers
  const handleSaveSchedule = useCallback(async () => {
    setSavingSchedule(true);
    try {
      await saveSetting("defaultSchedule", schedule);
      setSavedSchedule({ ...schedule });
      toast.success("Horario guardado correctamente");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar horario");
    } finally {
      setSavingSchedule(false);
    }
  }, [schedule]);

  const handleSaveHolidays = useCallback(async () => {
    setSavingHolidays(true);
    try {
      await saveSetting("holidays", holidays);
      setSavedHolidays([...holidays]);
      toast.success("Feriados guardados correctamente");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar feriados");
    } finally {
      setSavingHolidays(false);
    }
  }, [holidays]);

  const handleSaveNotifications = useCallback(async () => {
    setSavingNotifications(true);
    try {
      await saveSetting("notifications", notifications);
      setSavedNotifications({ ...notifications });
      toast.success("Notificaciones guardadas correctamente");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar notificaciones");
    } finally {
      setSavingNotifications(false);
    }
  }, [notifications]);

  const handleToggle = useCallback(async (key: string, value: unknown) => {
    setSavingToggle(key);
    try {
      await saveSetting(key, value);
      toast.success("¡Configuración actualizada correctamente!");
    } catch {
      toast.error("No se pudo actualizar la configuración. Intenta de nuevo.");
    } finally {
      setSavingToggle(null);
    }
  }, []);

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast.error("Ingrese fecha y nombre del feriado");
      return;
    }
    if (holidays.some((h) => h.date === newHolidayDate)) {
      toast.error("Ya existe un feriado en esa fecha");
      return;
    }
    setHolidays((prev) => [...prev, { date: newHolidayDate, name: newHolidayName.trim() }]);
    setNewHolidayDate("");
    setNewHolidayName("");
  };

  const handleRemoveHoliday = (date: string) => {
    setHolidays((prev) => prev.filter((h) => h.date !== date));
  };

  const handleLoadDefaults = (year: number) => {
    const defaults = getDefaultHolidays(year);
    const merged = [...holidays];
    for (const d of defaults) {
      if (!merged.some((h) => h.date === d.date)) merged.push(d);
    }
    setHolidays(merged);
    toast.success(`Feriados de ${year} cargados`);
  };

  // -- Render
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-full max-w-lg" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuracion</h1>
          <p className="text-muted-foreground">
            Administra horarios, feriados, notificaciones y parametros del sistema
          </p>
        </div>
        {tenant && (
          <Badge variant="outline" className="mt-1">
            {tenant.plan}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <Building2 className="size-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="horarios">
            <Clock className="size-4" />
            <span className="hidden sm:inline">Horarios</span>
          </TabsTrigger>
          <TabsTrigger value="feriados">
            <Calendar className="size-4" />
            <span className="hidden sm:inline">Feriados</span>
            {holidaysChanged && (
              <span className="ml-1 size-2 rounded-full bg-amber-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="notificaciones">
            <Bell className="size-4" />
            <span className="hidden sm:inline">Notificaciones</span>
            {notificationsChanged && (
              <span className="ml-1 size-2 rounded-full bg-amber-500" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* TAB: General                                                     */}
        {/* ================================================================ */}
        <TabsContent value="general" className="space-y-4">
          {/* Company info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-muted-foreground" />
                Informacion de la Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoCard icon={Building2} label="Empresa" value={tenant?.name ?? "—"} />
                <InfoCard icon={Hash} label="Identificador" value={tenant?.slug ?? "—"} />
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                    <Globe className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Zona Horaria</p>
                    <select
                      value={timezone}
                      onChange={(e) => {
                        setTimezone(e.target.value);
                        handleToggle("timezone", e.target.value);
                      }}
                      className="mt-0.5 w-full rounded border-none bg-transparent p-0 text-sm font-medium focus:outline-none focus:ring-0"
                    >
                      <option value="America/Lima">America/Lima (UTC-5)</option>
                      <option value="America/Bogota">America/Bogota (UTC-5)</option>
                      <option value="America/Mexico_City">America/Mexico City (UTC-6)</option>
                      <option value="America/Santiago">America/Santiago (UTC-3/-4)</option>
                      <option value="America/Buenos_Aires">America/Buenos Aires (UTC-3)</option>
                      <option value="America/Sao_Paulo">America/Sao Paulo (UTC-3)</option>
                      <option value="America/New_York">America/New York (UTC-5/-4)</option>
                      <option value="America/Los_Angeles">America/Los Angeles (UTC-8/-7)</option>
                      <option value="Europe/Madrid">Europe/Madrid (UTC+1/+2)</option>
                      <option value="UTC">UTC (UTC+0)</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow settings */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4 text-muted-foreground" />
                Flujo de Trabajo
              </CardTitle>
              <CardDescription>
                Configura como se procesan las solicitudes y regularizaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ToggleRow
                icon={Shield}
                label="Requerir aprobacion para regularizaciones"
                description="Los empleados necesitan aprobacion del admin para regularizar asistencia"
                checked={approvalRequired}
                saving={savingToggle === "approvalRequired"}
                onChange={(val) => {
                  setApprovalRequired(val);
                  handleToggle("approvalRequired", val);
                }}
              />
            </CardContent>
          </Card>

          {/* Work policies */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="size-4 text-muted-foreground" />
                Políticas Laborales
              </CardTitle>
              <CardDescription>
                Define las reglas de trabajo de la empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <ToggleRow
                icon={Flag}
                label="Permitir trabajo en feriados"
                description="Los empleados pueden marcar asistencia en días feriados"
                checked={workPolicy.allowHolidayWork}
                saving={savingToggle === "workPolicy"}
                onChange={(val) => {
                  const next = { ...workPolicy, allowHolidayWork: val };
                  setWorkPolicy(next);
                  handleToggle("workPolicy", next);
                }}
              />
              <ToggleRow
                icon={Timer}
                label="Permitir horas extra"
                description="Las horas trabajadas más allá del horario cuentan como extra"
                checked={workPolicy.allowOvertime}
                saving={savingToggle === "workPolicy"}
                onChange={(val) => {
                  const next = { ...workPolicy, allowOvertime: val };
                  setWorkPolicy(next);
                  handleToggle("workPolicy", next);
                }}
              />
              <ToggleRow
                icon={Ban}
                label="Horario rígido"
                description="Las horas trabajadas se redondean al máximo planificado. Sin horas extra en reportes."
                checked={workPolicy.strictSchedule}
                saving={savingToggle === "workPolicy"}
                onChange={(val) => {
                  const next = { ...workPolicy, strictSchedule: val };
                  setWorkPolicy(next);
                  handleToggle("workPolicy", next);
                }}
              />
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="size-4 text-muted-foreground" />
                Funcionalidades
              </CardTitle>
              <CardDescription>
                Activa o desactiva modulos del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <ToggleRow
                icon={MessageSquare}
                label="Chat interno"
                description="Mensajeria entre empleados y canales de grupo"
                checked={features.chat}
                saving={savingToggle === "features"}
                onChange={(val) => {
                  const next = { ...features, chat: val };
                  setFeatures(next);
                  handleToggle("features", next);
                }}
              />
              <ToggleRow
                icon={Users}
                label="Red social interna"
                description="Feed de publicaciones, celebraciones y noticias"
                checked={features.social}
                saving={savingToggle === "features"}
                onChange={(val) => {
                  const next = { ...features, social: val };
                  setFeatures(next);
                  handleToggle("features", next);
                }}
              />
              <ToggleRow
                icon={Sparkles}
                label="Asistente IA"
                description="Chatbot inteligente para consultas de RRHH y asistencia"
                checked={features.aiAssistant}
                saving={savingToggle === "features"}
                onChange={(val) => {
                  const next = { ...features, aiAssistant: val };
                  setFeatures(next);
                  handleToggle("features", next);
                }}
              />
            </CardContent>
          </Card>

          {/* System info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="size-4 text-muted-foreground" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">Version</span>
                  <Badge variant="secondary">v2.0.0</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">Entorno</span>
                  <Badge variant="outline">Desarrollo</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {tenant?.status === "ACTIVE" ? "Activo" : tenant?.status ?? "—"}
                  </Badge>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="size-4 text-muted-foreground" />
                    Horario Laboral Predeterminado
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Se aplica a nuevos empleados. Cada empleado puede tener un horario personalizado.
                  </CardDescription>
                </div>
                {scheduleChanged && (
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                    <AlertCircle className="mr-1 size-3" />
                    Sin guardar
                  </Badge>
                )}
              </div>
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
                    onChange={(e) => setSchedule((s) => ({ ...s, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">Hora de Salida</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={schedule.endTime}
                    onChange={(e) => setSchedule((s) => ({ ...s, endTime: e.target.value }))}
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
                    onChange={(e) => setSchedule((s) => ({ ...s, breakMinutes: Number(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Visual timeline */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Vista previa de jornada
                </p>
                <div className="relative h-8 w-full rounded-full bg-muted">
                  {/* Work block */}
                  <div
                    className="absolute top-0 h-full rounded-full bg-primary/20"
                    style={{
                      left: `${timeToPercent(schedule.startTime)}%`,
                      width: `${timeToPercent(schedule.endTime) - timeToPercent(schedule.startTime)}%`,
                    }}
                  >
                    <div className="flex h-full items-center justify-center text-xs font-medium text-primary">
                      {workInfo.label} efectivas
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>6:00</span>
                  <span>9:00</span>
                  <span>12:00</span>
                  <span>15:00</span>
                  <span>18:00</span>
                  <span>21:00</span>
                </div>
              </div>

              {/* Summary + Save */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg border bg-card px-4 py-2 text-center">
                    <p className="text-2xl font-bold">{workInfo.hours}</p>
                    <p className="text-xs text-muted-foreground">horas</p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {schedule.startTime} - {schedule.endTime}
                    <br />
                    {schedule.breakMinutes} min de break
                  </div>
                </div>
                <Button onClick={handleSaveSchedule} disabled={savingSchedule || !scheduleChanged}>
                  {savingSchedule ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
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
        <TabsContent value="feriados" className="space-y-4">
          {/* Summary bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="size-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {holidays.length} feriado{holidays.length !== 1 && "s"} configurados
                </h3>
                <p className="text-sm text-muted-foreground">
                  Estos dias no se cuentan como jornada laboral
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {holidaysChanged && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <AlertCircle className="mr-1 size-3" />
                  Cambios sin guardar
                </Badge>
              )}
              <Button
                onClick={handleSaveHolidays}
                disabled={savingHolidays || !holidaysChanged}
              >
                {savingHolidays ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : holidaysChanged ? (
                  <Save className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {holidaysChanged ? "Guardar Feriados" : "Guardado"}
              </Button>
            </div>
          </div>

          {/* Add holiday + Load defaults */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="new-holiday-date" className="text-xs font-medium">
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
                  <Label htmlFor="new-holiday-name" className="text-xs font-medium">
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
                <Button variant="outline" onClick={handleAddHoliday} className="shrink-0">
                  <Plus className="size-4" />
                  Agregar
                </Button>
              </div>

              {/* Quick load defaults */}
              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <RotateCcw className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Cargar feriados de Peru:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => handleLoadDefaults(new Date().getFullYear())}
                >
                  {new Date().getFullYear()}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => handleLoadDefaults(new Date().getFullYear() + 1)}
                >
                  {new Date().getFullYear() + 1}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Holiday table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">
                      <button
                        type="button"
                        onClick={() => setSortAsc((v) => !v)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                      >
                        Fecha
                        <ArrowUpDown className="size-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHolidays.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                        <Calendar className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                        <p>No hay feriados registrados</p>
                        <p className="mt-1 text-xs">
                          Agrega feriados manualmente o carga los predeterminados
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {sortedHolidays.map((h) => {
                    const isPast = h.date < new Date().toISOString().split("T")[0];
                    return (
                      <TableRow key={h.date} className={isPast ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-md bg-muted text-xs font-medium">
                              {formatDateShort(h.date)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{h.name}</span>
                          {isPast && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              Pasado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveHoliday(h.date)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Monthly breakdown */}
          {holidays.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Array.from(holidaysByMonth.entries()).map(([month, items]) => (
                <Badge key={month} variant="secondary" className="px-2.5 py-1">
                  {getMonthName(month)}: {items.length}
                </Badge>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB: Notificaciones                                              */}
        {/* ================================================================ */}
        <TabsContent value="notificaciones">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Bell className="size-4 text-muted-foreground" />
                    Preferencias de Notificacion
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Controla que notificaciones se envian automaticamente
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {notificationsChanged && (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                      <AlertCircle className="mr-1 size-3" />
                      Sin guardar
                    </Badge>
                  )}
                  <Button
                    onClick={handleSaveNotifications}
                    disabled={savingNotifications || !notificationsChanged}
                    size="sm"
                  >
                    {savingNotifications ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Guardar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* Solicitudes */}
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Solicitudes
              </p>
              <NotificationRow
                id="notify-approvals"
                label="Aprobacion de solicitudes"
                description="Notifica al empleado cuando su solicitud es aprobada"
                checked={notifications.approvals}
                onChange={(val) => setNotifications((n) => ({ ...n, approvals: val }))}
              />
              <NotificationRow
                id="notify-rejections"
                label="Rechazo de solicitudes"
                description="Notifica al empleado cuando su solicitud es rechazada"
                checked={notifications.rejections}
                onChange={(val) => setNotifications((n) => ({ ...n, rejections: val }))}
              />
              <NotificationRow
                id="notify-pending"
                label="Solicitudes pendientes"
                description="Recordatorio de solicitudes sin atender por mas de 48h"
                checked={notifications.pendingRequests}
                onChange={(val) => setNotifications((n) => ({ ...n, pendingRequests: val }))}
              />

              <div className="my-3 border-t" />

              {/* Equipo */}
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Equipo
              </p>
              <NotificationRow
                id="notify-birthdays"
                label="Cumpleanos del dia"
                description="Aviso diario de cumpleanos de empleados"
                checked={notifications.birthdays}
                onChange={(val) => setNotifications((n) => ({ ...n, birthdays: val }))}
              />

              <div className="my-3 border-t" />

              {/* Alertas */}
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Alertas
              </p>
              <NotificationRow
                id="notify-late"
                label="Alertas de tardanza"
                description="Notificar cuando un empleado no registra entrada a tiempo"
                checked={notifications.lateArrivals}
                onChange={(val) => setNotifications((n) => ({ ...n, lateArrivals: val }))}
              />
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

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex size-9 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  saving,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  saving?: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3 pr-4">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {saving ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch checked={checked} onCheckedChange={(val: boolean) => onChange(val)} />
      )}
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
      <Switch id={id} checked={checked} onCheckedChange={(val: boolean) => onChange(val)} />
    </div>
  );
}
