"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Settings, Calendar, Bell, Clock, Info } from "lucide-react";

const HOLIDAYS_2026 = [
  { date: "01 Enero", name: "Ano Nuevo" },
  { date: "09 Abril", name: "Jueves Santo" },
  { date: "10 Abril", name: "Viernes Santo" },
  { date: "01 Mayo", name: "Dia del Trabajo" },
  { date: "29 Junio", name: "San Pedro y San Pablo" },
  { date: "28 Julio", name: "Fiestas Patrias" },
  { date: "29 Julio", name: "Fiestas Patrias" },
  { date: "30 Agosto", name: "Santa Rosa de Lima" },
  { date: "08 Octubre", name: "Combate de Angamos" },
  { date: "01 Noviembre", name: "Todos los Santos" },
  { date: "08 Diciembre", name: "Inmaculada Concepcion" },
  { date: "25 Diciembre", name: "Navidad" },
];

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    approvals: true,
    rejections: true,
    birthdays: true,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Configuracion del Sistema
        </h1>
        <p className="text-muted-foreground">
          Horarios, feriados y parametros del sistema
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 1: Work Schedule */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                Horario Laboral Predeterminado
              </CardTitle>
            </div>
            <CardDescription>
              Estos valores se aplican a nuevos empleados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="start-time">Hora de Entrada</Label>
                <Input
                  id="start-time"
                  type="time"
                  defaultValue="09:00"
                  disabled
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-time">Hora de Salida</Label>
                <Input
                  id="end-time"
                  type="time"
                  defaultValue="18:00"
                  disabled
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="break-minutes">Minutos de Break</Label>
              <Input
                id="break-minutes"
                type="number"
                defaultValue={60}
                disabled
                className="w-32"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <Info className="mr-1 inline h-3 w-3" />
              Proximamente: edicion de horarios por empleado.
            </p>
          </CardContent>
        </Card>

        {/* Section 3: System Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                Informacion del Sistema
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Version</span>
              <Badge variant="secondary">v2.0.0</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Entorno</span>
              <Badge variant="outline">Desarrollo</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Zona Horaria
              </span>
              <span className="text-sm font-medium">
                America/Lima (UTC-5)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Prefijo de tablas
              </span>
              <code className="rounded bg-muted px-2 py-0.5 text-sm">
                NovasysV2_
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Holidays */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Dias Feriados 2026</CardTitle>
            </div>
            <CardDescription>
              Proximamente: gestion dinamica de feriados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Nombre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {HOLIDAYS_2026.map((h) => (
                    <TableRow key={`${h.date}-${h.name}`}>
                      <TableCell className="font-medium">{h.date}</TableCell>
                      <TableCell>{h.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Notificaciones</CardTitle>
            </div>
            <CardDescription>
              Proximamente: configuracion persistente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-approvals" className="cursor-pointer">
                Notificar al aprobar solicitudes
              </Label>
              <Switch
                id="notify-approvals"
                checked={notifications.approvals}
                onCheckedChange={(val: boolean) =>
                  setNotifications((prev) => ({ ...prev, approvals: val }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-rejections" className="cursor-pointer">
                Notificar al rechazar solicitudes
              </Label>
              <Switch
                id="notify-rejections"
                checked={notifications.rejections}
                onCheckedChange={(val: boolean) =>
                  setNotifications((prev) => ({ ...prev, rejections: val }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-birthdays" className="cursor-pointer">
                Notificar cumpleanos del dia
              </Label>
              <Switch
                id="notify-birthdays"
                checked={notifications.birthdays}
                onCheckedChange={(val: boolean) =>
                  setNotifications((prev) => ({ ...prev, birthdays: val }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
