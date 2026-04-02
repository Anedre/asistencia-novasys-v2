"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { StatusBadge } from "@/components/attendance/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useAdminAttendance } from "@/hooks/use-employee";
import {
  Users,
  UserX,
  Coffee,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  FilePenLine,
  Globe,
  Smartphone,
  Edit3,
  FileCheck,
  Server,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMin(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtTime(isoOrLocal: string | null): string {
  if (!isoOrLocal) return "—";
  if (isoOrLocal.includes("T")) {
    return isoOrLocal.split("T")[1]?.replace(/[-+]\d{2}:\d{2}$/, "").slice(0, 5) ?? isoOrLocal;
  }
  return isoOrLocal.slice(0, 5);
}

function getTodayLima(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

function getYesterdayLima(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ title, value, subtitle, icon: Icon, accentFrom, accentTo, loading }: {
  title: string; value: React.ReactNode; subtitle: string;
  icon: React.ElementType; accentFrom: string; accentTo: string; loading: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentFrom} ${accentTo}`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`flex size-8 items-center justify-center rounded-lg bg-gradient-to-br ${accentFrom} ${accentTo}`}>
          <Icon className="size-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="mb-1 h-8 w-20" /> : <div className="text-3xl font-bold tracking-tight">{value}</div>}
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function WorkedBar({ worked, planned }: { worked: number; planned: number }) {
  const pct = planned > 0 ? Math.min(100, (worked / planned) * 100) : 0;
  const color = pct >= 100 ? "from-green-500 to-emerald-400" : pct >= 75 ? "from-blue-500 to-sky-400" : pct >= 50 ? "from-yellow-500 to-amber-400" : "from-red-500 to-orange-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium tabular-nums">{fmtMin(worked)}</span>
        <span className="text-muted-foreground tabular-nums">/ {fmtMin(planned)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-xs text-muted-foreground">0:00</span>;
  const isPos = delta > 0;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${isPos ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"}`}>
      {isPos ? "+" : "-"}{fmtMin(Math.abs(delta))}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { icon: React.ElementType; label: string }> = {
    WEB: { icon: Globe, label: "Web" },
    REALTIME: { icon: Globe, label: "Web" },
    MOBILE: { icon: Smartphone, label: "Movil" },
    CUSTOM_TIME: { icon: Edit3, label: "Manual" },
    REGULARIZATION: { icon: FileCheck, label: "Regularizado" },
    REGULARIZATION_RANGE: { icon: FileCheck, label: "Regularizado" },
    SYSTEM: { icon: Server, label: "Sistema" },
  };
  const cfg = map[source] ?? map.WEB;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

function useLiveMinutes(firstInLocal: string | null, breakMinutes: number, active: boolean): number {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active || !firstInLocal) return 0;
  const timePart = firstInLocal.includes("T")
    ? firstInLocal.split("T")[1]?.replace(/[-+]\d{2}:\d{2}$/, "") ?? "00:00:00"
    : firstInLocal;
  const [h, m, s] = timePart.split(":").map(Number);
  const startMin = h * 60 + m + (s || 0) / 60;
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return Math.max(0, Math.floor(nowMin - startMin) - breakMinutes);
}

function LiveWorkedBar({ worked, planned }: { worked: number; planned: number }) {
  const pct = planned > 0 ? Math.min(100, (worked / planned) * 100) : 0;
  const color = pct >= 100 ? "from-green-500 to-emerald-400" : pct >= 75 ? "from-blue-500 to-sky-400" : pct >= 50 ? "from-yellow-500 to-amber-400" : "from-red-500 to-orange-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-green-700 dark:text-green-400">
          <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
          {fmtMin(worked)}
        </span>
        <span className="text-muted-foreground tabular-nums">/ {fmtMin(planned)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttendanceSummary {
  employeeId: string;
  workDate: string;
  fullName: string;
  area: string;
  position: string;
  avatarUrl: string | null;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakStartLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  plannedMinutes: number;
  deltaMinutes: number;
  status: string;
  source: string;
  anomalies: string[];
  hasOpenBreak: boolean;
  hasOpenShift: boolean;
  eventsCount: number;
}

interface AttendanceResponse {
  ok: boolean;
  date: string;
  totals: { total: number; present: number; absent: number; onBreak: number; complete: number; short: number; anomalies: number };
  areas: string[];
  summaries: AttendanceSummary[];
}

// ---------------------------------------------------------------------------
// Row component (needs its own hook for live timer)
// ---------------------------------------------------------------------------

function AttendanceRow({ s, isToday }: { s: AttendanceSummary; isToday: boolean }) {
  const isLive = s.hasOpenShift && isToday;
  const liveMin = useLiveMinutes(s.firstInLocal, s.breakMinutes, isLive);
  const displayWorked = isLive ? liveMin : s.workedMinutes;
  const initials = s.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <TableRow className="group">
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar size="sm" className="shrink-0">
            {s.avatarUrl ? <AvatarImage src={s.avatarUrl} alt={s.fullName} /> : null}
            <AvatarFallback className="text-[10px] font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{s.fullName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{s.area || s.position}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="tabular-nums text-sm">{fmtTime(s.firstInLocal)}</TableCell>
      <TableCell className="tabular-nums text-sm">{fmtTime(s.lastOutLocal)}</TableCell>
      <TableCell>
        {s.hasOpenBreak ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <Coffee className="size-3 animate-pulse" />
            En break
          </span>
        ) : s.breakMinutes > 0 ? (
          <span className="text-sm tabular-nums">{s.breakMinutes} min</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {isLive ? (
          <LiveWorkedBar worked={displayWorked} planned={s.plannedMinutes} />
        ) : (
          <WorkedBar worked={displayWorked} planned={s.plannedMinutes} />
        )}
      </TableCell>
      <TableCell>
        {s.status === "MISSING" ? (
          <span className="text-muted-foreground">—</span>
        ) : isLive ? (
          <DeltaBadge delta={displayWorked - s.plannedMinutes} />
        ) : (
          <DeltaBadge delta={s.deltaMinutes} />
        )}
      </TableCell>
      <TableCell><StatusBadge status={s.status} /></TableCell>
      <TableCell>{s.source ? <SourceBadge source={s.source} /> : <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell>
        {s.anomalies.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {s.anomalies.map((a) => (
              <Badge key={a} variant="destructive" className="text-[10px] px-1.5">{a}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Link
          href={`/admin/regularize?employee=${encodeURIComponent(s.employeeId)}&date=${s.workDate}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <FilePenLine className="size-3.5" />
          </Button>
        </Link>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState(getTodayLima);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");

  const { data, isLoading, isError } = useAdminAttendance(selectedDate);
  const response = data as AttendanceResponse | undefined;
  const summaries = response?.summaries ?? [];
  const totals = response?.totals;
  const areas = response?.areas ?? [];
  const isToday = selectedDate === getTodayLima();

  // Filter & sort
  const filtered = useMemo(() => {
    let list = summaries;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((s) => s.fullName.toLowerCase().includes(q));
    }
    if (statusFilter !== "ALL") {
      list = list.filter((s) => s.status === statusFilter);
    }
    if (areaFilter !== "ALL") {
      list = list.filter((s) => s.area === areaFilter);
    }

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "entry": return (a.firstInLocal ?? "99").localeCompare(b.firstInLocal ?? "99");
        case "worked": return b.workedMinutes - a.workedMinutes;
        case "status": {
          const order: Record<string, number> = { OPEN: 0, OK: 1, SHORT: 2, REGULARIZED: 3, MISSING: 4, ABSENCE: 5 };
          return (order[a.status] ?? 9) - (order[b.status] ?? 9);
        }
        default: return a.fullName.localeCompare(b.fullName);
      }
    });

    return list;
  }, [summaries, searchTerm, statusFilter, areaFilter, sortBy]);

  const hasFilters = searchTerm || statusFilter !== "ALL" || areaFilter !== "ALL";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asistencia del Dia</h1>
          <p className="text-muted-foreground capitalize">{formatDateDisplay(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(getYesterdayLima())}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Ayer
          </Button>
          <Button variant={isToday ? "default" : "outline"} size="sm" onClick={() => setSelectedDate(getTodayLima())}>
            Hoy
          </Button>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40 h-9" />
        </div>
      </div>

      {isError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Error al cargar la asistencia. Intenta de nuevo.
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard title="Presentes" value={totals?.present ?? 0} subtitle="han marcado entrada" icon={Users} accentFrom="from-green-500" accentTo="to-emerald-400" loading={isLoading} />
        <MetricCard title="Ausentes" value={totals?.absent ?? 0} subtitle="sin registro" icon={UserX} accentFrom="from-red-500" accentTo="to-rose-400" loading={isLoading} />
        <MetricCard title="En Break" value={totals?.onBreak ?? 0} subtitle="en descanso ahora" icon={Coffee} accentFrom="from-amber-500" accentTo="to-yellow-400" loading={isLoading} />
        <MetricCard title="Jornada Completa" value={totals?.complete ?? 0} subtitle="cumplieron 8h" icon={CheckCircle} accentFrom="from-blue-500" accentTo="to-sky-400" loading={isLoading} />
        <MetricCard title="Jornada Corta" value={totals?.short ?? 0} subtitle="menos de 8h" icon={Clock} accentFrom="from-violet-500" accentTo="to-purple-400" loading={isLoading} />
        <MetricCard title="Anomalias" value={totals?.anomalies ?? 0} subtitle="registros con alertas" icon={AlertTriangle} accentFrom="from-rose-500" accentTo="to-pink-400" loading={isLoading} />
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nombre..." className="pl-9 h-9" />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
              <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="OPEN">Trabajando</SelectItem>
                <SelectItem value="OK">Jornada completa</SelectItem>
                <SelectItem value="SHORT">Jornada corta</SelectItem>
                <SelectItem value="MISSING">Ausente</SelectItem>
                <SelectItem value="ABSENCE">Falta</SelectItem>
                <SelectItem value="REGULARIZED">Regularizado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={areaFilter} onValueChange={(v) => setAreaFilter(v ?? "ALL")}>
              <SelectTrigger className="w-full sm:w-44 h-9"><SelectValue placeholder="Area" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las areas</SelectItem>
                {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v ?? "name")}>
              <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nombre</SelectItem>
                <SelectItem value="entry">Hora entrada</SelectItem>
                <SelectItem value="worked">Horas trabajadas</SelectItem>
                <SelectItem value="status">Estado</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); setAreaFilter("ALL"); }}>
                Limpiar filtros
              </Button>
            )}
          </div>
          {!isLoading && <p className="mt-2 text-xs text-muted-foreground">{filtered.length} de {summaries.length} empleados</p>}
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registro de Asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="Sin resultados" description={hasFilters ? "No hay empleados que coincidan con los filtros." : "No hay registros de asistencia para esta fecha."} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px]">Empleado</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead className="w-[160px]">Horas</TableHead>
                    <TableHead>Delta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Anomalias</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <AttendanceRow key={s.employeeId} s={s} isToday={isToday} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
