"use client";

/**
 * Settings → Schedule
 * Default working hours, break, schedule type, and work policy toggles.
 */

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Clock,
  Briefcase,
  Flag,
  Zap,
  Ban,
  Timer,
  Sunrise,
  Sunset,
  Coffee,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsFooter } from "@/components/admin/settings/SettingsFooter";
import {
  useTenantSettings,
  useSaveTenantSettings,
} from "@/hooks/use-tenant-settings";
import {
  DEFAULT_SCHEDULE,
  DEFAULT_WORK_POLICY,
  type ScheduleSettings,
} from "@/lib/constants/tenant-defaults";

type WorkPolicy = typeof DEFAULT_WORK_POLICY;

function calculateWorkHours(s: ScheduleSettings): string {
  const [sh, sm] = s.startTime.split(":").map(Number);
  const [eh, em] = s.endTime.split(":").map(Number);
  const total = eh * 60 + em - (sh * 60 + sm) - s.breakMinutes;
  if (total <= 0) return "0h";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function ScheduleSettingsPage() {
  const { data, isLoading } = useTenantSettings();
  const saveTenantSettings = useSaveTenantSettings();
  const tenant = data?.tenant;

  const [schedule, setSchedule] = useState<ScheduleSettings>(DEFAULT_SCHEDULE);
  const [saved, setSaved] = useState<ScheduleSettings>(DEFAULT_SCHEDULE);
  const [scheduleType, setScheduleType] = useState<"FULL_TIME" | "PART_TIME">(
    "FULL_TIME"
  );
  const [savedScheduleType, setSavedScheduleType] = useState<
    "FULL_TIME" | "PART_TIME"
  >("FULL_TIME");
  const [workPolicy, setWorkPolicy] = useState<WorkPolicy>(DEFAULT_WORK_POLICY);
  const [savedWorkPolicy, setSavedWorkPolicy] =
    useState<WorkPolicy>(DEFAULT_WORK_POLICY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    const s = tenant.settings;
    if (s.defaultSchedule) {
      setSchedule(s.defaultSchedule);
      setSaved(s.defaultSchedule);
    }
    if (s.defaultScheduleType) {
      setScheduleType(s.defaultScheduleType);
      setSavedScheduleType(s.defaultScheduleType);
    }
    if (s.workPolicy) {
      setWorkPolicy({ ...DEFAULT_WORK_POLICY, ...s.workPolicy });
      setSavedWorkPolicy({ ...DEFAULT_WORK_POLICY, ...s.workPolicy });
    }
  }, [tenant]);

  const dirty =
    JSON.stringify(schedule) !== JSON.stringify(saved) ||
    scheduleType !== savedScheduleType ||
    JSON.stringify(workPolicy) !== JSON.stringify(savedWorkPolicy);

  const workLabel = useMemo(() => calculateWorkHours(schedule), [schedule]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveTenantSettings({
        settings: {
          defaultSchedule: schedule,
          defaultScheduleType: scheduleType,
          workPolicy,
        },
      });
      setSaved({ ...schedule });
      setSavedScheduleType(scheduleType);
      setSavedWorkPolicy({ ...workPolicy });
      toast.success("Horario guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setSchedule(saved);
    setScheduleType(savedScheduleType);
    setWorkPolicy(savedWorkPolicy);
  }

  if (isLoading || !tenant) return <Skeleton className="h-96 w-full" />;

  return (
    <SettingsSection
      icon={Clock}
      title="Horario laboral"
      description="Jornada por defecto y políticas de trabajo"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horario base</CardTitle>
          <p className="text-xs text-muted-foreground">
            Jornada por defecto aplicada a los empleados nuevos. Total: {" "}
            <strong>{workLabel}</strong> / día
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="startTime" className="text-xs">
                <Sunrise className="mr-1 inline h-3 w-3" />
                Hora de entrada
              </Label>
              <Input
                id="startTime"
                type="time"
                value={schedule.startTime}
                onChange={(e) =>
                  setSchedule({ ...schedule, startTime: e.target.value })
                }
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime" className="text-xs">
                <Sunset className="mr-1 inline h-3 w-3" />
                Hora de salida
              </Label>
              <Input
                id="endTime"
                type="time"
                value={schedule.endTime}
                onChange={(e) =>
                  setSchedule({ ...schedule, endTime: e.target.value })
                }
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="break" className="text-xs">
                <Coffee className="mr-1 inline h-3 w-3" />
                Break (minutos)
              </Label>
              <Input
                id="break"
                type="number"
                min={0}
                max={480}
                value={schedule.breakMinutes}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    breakMinutes: Number(e.target.value),
                  })
                }
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheduleType" className="text-xs">
              <Briefcase className="mr-1 inline h-3 w-3" />
              Tipo de jornada por defecto
            </Label>
            <Select
              value={scheduleType}
              onValueChange={(v) =>
                setScheduleType(v as "FULL_TIME" | "PART_TIME")
              }
            >
              <SelectTrigger className="h-10 w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">Tiempo completo</SelectItem>
                <SelectItem value="PART_TIME">Medio tiempo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Política de trabajo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Reglas generales que se aplican a la jornada de todos los empleados
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <PolicyRow
            icon={Flag}
            label="Permitir trabajo en feriados"
            description="Los empleados pueden marcar entrada en días feriados"
            checked={workPolicy.allowHolidayWork}
            onChange={(v) =>
              setWorkPolicy({ ...workPolicy, allowHolidayWork: v })
            }
          />
          <PolicyRow
            icon={Zap}
            label="Permitir horas extra"
            description="Se cuenta el tiempo trabajado después del horario base"
            checked={workPolicy.allowOvertime}
            onChange={(v) =>
              setWorkPolicy({ ...workPolicy, allowOvertime: v })
            }
          />
          <PolicyRow
            icon={Ban}
            label="Horario estricto"
            description="Marca anomalía si llegan antes o salen después del horario"
            checked={workPolicy.strictSchedule}
            onChange={(v) =>
              setWorkPolicy({ ...workPolicy, strictSchedule: v })
            }
          />
        </CardContent>
      </Card>

      <SettingsFooter
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </SettingsSection>
  );
}

function PolicyRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 transition hover:bg-muted/30">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
