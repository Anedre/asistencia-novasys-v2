"use client";

import { cn } from "@/lib/utils";
import {
  Clock,
  CalendarDays,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
  LogIn,
  LogOut,
  Coffee,
  Send,
  FileText,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  PenLine,
  Plus,
  User,
  Flag,
  Users,
  Mail,
  Settings as SettingsIcon,
  Undo2,
  BarChart3,
  Inbox,
  History,
  Sparkles,
  UserPlus,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { REASON_LABELS } from "@/lib/constants/reason-codes";
import type { UIBlock } from "@/lib/types/chat";

type OnAction = (message: string) => void;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OK: { label: "Completo", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  CLOSED: { label: "Cerrado", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  OPEN: { label: "En curso", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  SHORT: { label: "Incompleto", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  REGULARIZED: { label: "Regularizado", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  NO_RECORD: { label: "Sin registro", color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
  MISSING: { label: "Falta", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  ABSENCE: { label: "Ausencia", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  PENDING: { label: "Pendiente", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  APPROVED: { label: "Aprobado", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  REJECTED: { label: "Rechazado", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  CANCELLED: { label: "Cancelado", color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  REGULARIZATION_SINGLE: "Regularizacion",
  REGULARIZATION_RANGE: "Regularizacion (rango)",
  PERMISSION: "Permiso",
  VACATION: "Vacaciones",
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof LogIn; color: string }> = {
  START: { label: "Entrada registrada", icon: LogIn, color: "text-green-600" },
  BREAK_START: { label: "Break iniciado", icon: Coffee, color: "text-amber-600" },
  BREAK_END: { label: "Break finalizado", icon: Coffee, color: "text-blue-600" },
  END: { label: "Salida registrada", icon: LogOut, color: "text-red-600" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", config.bg, config.color)}>
      {config.label}
    </span>
  );
}

function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={cn("h-2 w-full rounded-full bg-gray-100 overflow-hidden", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          pct >= 100 ? "bg-green-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof ChevronRight;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 hover:border-primary/40 transition-colors active:scale-95"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function hhmmToMinutes(hhmm: string): number {
  const negative = hhmm.startsWith("-");
  const clean = hhmm.replace("-", "");
  const [h, m] = clean.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0);
  return negative ? -total : total;
}

function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    // Date-only strings ("2026-04-21") parse as UTC midnight and shift to
    // the previous day in Lima (UTC-5). Force noon local to avoid off-by-one.
    const d =
      dateStr.length === 10
        ? new Date(dateStr + "T12:00:00")
        : new Date(dateStr);
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
}

// ── Block Renderers ─────────────────────────────────────────────────

function AttendanceTodayCard({ block, onAction }: { block: Extract<UIBlock, { type: "attendance_today" }>; onAction?: OnAction }) {
  const worked = hhmmToMinutes(block.workedHHMM);
  const delta = hhmmToMinutes(block.deltaHHMM);

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 border-b border-blue-100">
        <Clock className="h-3.5 w-3.5 text-blue-600" />
        <span className="text-[11px] font-semibold text-blue-800">Asistencia Hoy</span>
        <StatusBadge status={block.status} />
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-gray-50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Entrada</div>
            <div className="text-sm font-bold">{block.firstIn}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Salida</div>
            <div className="text-sm font-bold">{block.lastOut}</div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Trabajado: {block.workedHHMM}</span>
            <span className="text-[10px] text-muted-foreground">{Math.floor(block.plannedMinutes / 60)}h plan</span>
          </div>
          <ProgressBar value={worked} max={block.plannedMinutes} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Timer className="h-3 w-3 text-muted-foreground" />
            <span>Break: {block.breakMinutes} min</span>
          </div>
          <div className={cn("flex items-center gap-1 font-semibold", delta >= 0 ? "text-green-600" : "text-red-500")}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {block.deltaHHMM}
          </div>
        </div>
        {/* Action buttons */}
        {onAction && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-dashed">
            {block.firstIn === "Sin registro" && (
              <ActionButton label="Marcar Entrada" icon={LogIn} onClick={() => onAction("Marca mi entrada")} />
            )}
            {block.hasOpenShift && (
              <>
                <ActionButton label="Inicio Break" icon={Coffee} onClick={() => onAction("Marca inicio de break")} />
                <ActionButton label="Marcar Salida" icon={LogOut} onClick={() => onAction("Marca mi salida")} />
              </>
            )}
            {(block.status === "CLOSED" || block.status === "OK") && (
              <ActionButton label="Resumen semanal" icon={CalendarDays} onClick={() => onAction("Dame mi resumen semanal de horas")} />
            )}
            {(block.status === "MISSING" || block.status === "NO_RECORD") && (
              <ActionButton label="Regularizar hoy" icon={PenLine} onClick={() => onAction(`Quiero regularizar mi asistencia del ${block.date}`)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WeekSummaryCard({ block, onAction }: { block: Extract<UIBlock, { type: "week_summary" }>; onAction?: OnAction }) {
  const totalDelta = hhmmToMinutes(block.totalDeltaHHMM);

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 border-b border-purple-100">
        <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
        <span className="text-[11px] font-semibold text-purple-800">Resumen Semanal</span>
        <span className="ml-auto text-[10px] text-purple-600">{block.fromDate} — {block.toDate}</span>
      </div>
      <div className="p-2">
        <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 mb-2">
          <div className="text-center flex-1">
            <div className="text-[10px] text-muted-foreground">Trabajado</div>
            <div className="text-sm font-bold">{block.totalWorkedHHMM}</div>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="text-center flex-1">
            <div className="text-[10px] text-muted-foreground">Plan</div>
            <div className="text-sm font-bold">{Math.floor(block.totalPlannedMinutes / 60)}:00</div>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="text-center flex-1">
            <div className="text-[10px] text-muted-foreground">Balance</div>
            <div className={cn("text-sm font-bold", totalDelta >= 0 ? "text-green-600" : "text-red-500")}>
              {block.totalDeltaHHMM}
            </div>
          </div>
        </div>
        <div className="space-y-0.5">
          {block.days.map((day) => {
            const dayWorked = hhmmToMinutes(day.workedHHMM);
            const canRegularize = day.status === "MISSING" || day.status === "NO_RECORD" || day.status === "SHORT";
            return (
              <div
                key={day.date}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors"
              >
                <span className="w-7 text-[10px] font-medium text-muted-foreground">{day.weekday}</span>
                <span className="w-10 text-[10px] tabular-nums">{day.firstIn}</span>
                <span className="w-10 text-[10px] tabular-nums">{day.lastOut}</span>
                <div className="flex-1 min-w-6">
                  <ProgressBar value={dayWorked} max={480} />
                </div>
                <span className="w-10 text-[10px] font-medium tabular-nums text-right">{day.workedHHMM}</span>
                {canRegularize && onAction ? (
                  <button
                    onClick={() => onAction(`Quiero regularizar mi asistencia del ${day.date}`)}
                    className="inline-flex items-center gap-0.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 hover:bg-red-100 transition-colors"
                    title={`Regularizar ${day.date}`}
                  >
                    <PenLine className="h-2.5 w-2.5" />
                    Regularizar
                  </button>
                ) : (
                  <StatusBadge status={day.status} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RequestCreatedCard({ block, onAction }: { block: Extract<UIBlock, { type: "request_created" }>; onAction?: OnAction }) {
  const typeLabel = REQUEST_TYPE_LABELS[block.requestType] || block.requestType;
  const reasonLabel = REASON_LABELS[block.reasonCode] || block.reasonCode;
  const dateDisplay = block.date || (block.dateFrom && block.dateTo ? `${block.dateFrom} — ${block.dateTo}` : "—");

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-green-50 px-3 py-2 border-b border-green-100">
        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
        <span className="text-[11px] font-semibold text-green-800">Solicitud Creada</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">{typeLabel}</span>
          <StatusBadge status={block.status} />
        </div>
        {block.employeeName && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{block.employeeName}</span>
          </div>
        )}
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3 w-3 text-muted-foreground" />
            <span>{dateDisplay}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-3 w-3 text-muted-foreground" />
            <span>Motivo: {reasonLabel}</span>
          </div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
          <p className="text-[10px] text-amber-700 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Un administrador revisara tu solicitud pronto.
          </p>
        </div>
        {onAction && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <ActionButton label="Ver mis solicitudes" icon={Send} onClick={() => onAction("Muestra el estado de mis solicitudes")} />
          </div>
        )}
      </div>
    </div>
  );
}

function RequestListCard({ block, onAction }: { block: Extract<UIBlock, { type: "request_list" }>; onAction?: OnAction }) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 border-b border-indigo-100">
        <Send className="h-3.5 w-3.5 text-indigo-600" />
        <span className="text-[11px] font-semibold text-indigo-800">Mis Solicitudes</span>
        <span className="ml-auto text-[10px] text-indigo-500">{block.total} total</span>
      </div>
      <div className="divide-y max-h-52 overflow-y-auto">
        {block.requests.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-4">No tienes solicitudes</p>
        ) : (
          block.requests.map((req) => {
            const typeLabel = REQUEST_TYPE_LABELS[req.type] || req.type;
            const statusLabel = STATUS_CONFIG[req.status]?.label || req.status;
            return (
              <div key={req.id} className="px-3 py-2 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium truncate flex-1">{typeLabel}</span>
                  <StatusBadge status={req.status} />
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {req.date} - {REASON_LABELS[req.reasonCode] || req.reasonCode}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Creado: {formatShortDate(req.createdAt)}
                </div>
                {req.reviewedBy && (
                  <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <User className="h-2.5 w-2.5" />
                    {statusLabel} por {req.reviewedBy}
                    {req.reviewedAt && ` - ${formatShortDate(req.reviewedAt)}`}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {/* Action buttons */}
      {onAction && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t">
          <ActionButton label="Nueva solicitud" icon={Plus} onClick={() => onAction("Quiero solicitar un permiso")} />
          <ActionButton label="Regularizar fecha" icon={PenLine} onClick={() => onAction("Quiero regularizar mi asistencia")} />
        </div>
      )}
    </div>
  );
}

function AttendanceRecordedCard({ block, onAction }: { block: Extract<UIBlock, { type: "attendance_recorded" }>; onAction?: OnAction }) {
  const config = EVENT_TYPE_CONFIG[block.eventType] || { label: block.eventType, icon: Clock, color: "text-gray-600" };
  const Icon = config.icon;

  const nextActions: Record<string, { label: string; icon: typeof LogIn; message: string }> = {
    START: { label: "Inicio Break", icon: Coffee, message: "Marca inicio de break" },
    BREAK_START: { label: "Fin Break", icon: Coffee, message: "Marca fin de break" },
    BREAK_END: { label: "Marcar Salida", icon: LogOut, message: "Marca mi salida" },
    END: { label: "Ver asistencia hoy", icon: Clock, message: "Muestra mi asistencia de hoy" },
  };
  const next = nextActions[block.eventType];

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className={cn("flex items-center gap-3 px-3 py-3", "bg-gradient-to-r from-green-50 to-emerald-50")}>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm", config.color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-green-800">{config.label}</p>
          <p className="text-lg font-bold text-green-900">{block.time}</p>
        </div>
        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
      </div>
      {onAction && next && (
        <div className="flex px-3 py-2 border-t">
          <ActionButton label={next.label} icon={next.icon} onClick={() => onAction(next.message)} />
        </div>
      )}
    </div>
  );
}

function ErrorCard({ block }: { block: Extract<UIBlock, { type: "error" }> }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-500" />
        <span className="text-xs font-medium text-red-700">Error</span>
      </div>
      <p className="text-[11px] text-red-600 mt-1">{block.message}</p>
    </div>
  );
}

function InfoCard({ block }: { block: Extract<UIBlock, { type: "info" }> }) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 border-b">
        <Sparkles className="h-3.5 w-3.5 text-slate-600" />
        <span className="text-[11px] font-semibold text-slate-800">{block.title}</span>
      </div>
      <div className="p-3 text-[11px] text-slate-700 whitespace-pre-line">{block.message}</div>
    </div>
  );
}

/* ─────────────────── HolidaysCard ─────────────────── */

function HolidaysCard({
  block,
  onAction,
}: {
  block: Extract<UIBlock, { type: "holidays" }>;
  onAction?: OnAction;
}) {
  const next = block.holidays[0];

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-indigo-50 px-3 py-2 border-b border-indigo-100">
        <Flag className="h-3.5 w-3.5 text-indigo-600" />
        <span className="text-[11px] font-semibold text-indigo-800">Feriados</span>
        <span className="ml-auto text-[10px] text-indigo-500">
          {block.totalConfigured} configurados
        </span>
      </div>
      <div className="p-3 space-y-3">
        {next && (
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 p-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <span className="text-[9px] uppercase leading-none opacity-80">
                  {next.monthShort}
                </span>
                <span className="text-lg font-bold leading-tight">{next.day}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider opacity-80">
                  Próximo feriado
                </p>
                <p className="truncate text-sm font-semibold">{next.name}</p>
                <p className="text-[10px] opacity-80">
                  En {next.daysUntil === 0
                    ? "hoy"
                    : next.daysUntil === 1
                    ? "1 día"
                    : `${next.daysUntil} días`}
                </p>
              </div>
            </div>
          </div>
        )}

        {block.holidays.length > 1 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Siguientes
            </p>
            <div className="divide-y rounded-lg border">
              {block.holidays.slice(1, 6).map((h) => (
                <div
                  key={h.date}
                  className="flex items-center gap-3 px-2.5 py-1.5"
                >
                  <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded bg-indigo-50 text-indigo-700">
                    <span className="text-[8px] uppercase leading-none">
                      {h.monthShort}
                    </span>
                    <span className="text-[11px] font-bold leading-tight">{h.day}</span>
                  </div>
                  <p className="min-w-0 flex-1 truncate text-[11px] font-medium">{h.name}</p>
                  <span className="text-[9px] text-muted-foreground">
                    {h.daysUntil}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {onAction && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-dashed">
            <ActionButton
              label="Ver todos"
              icon={CalendarDays}
              onClick={() => onAction("Lista todos los feriados del año")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── TeamStatsCard ─────────────────── */

const STATUS_COLORS: Record<string, string> = {
  OK: "#10b981",
  CLOSED: "#059669",
  REGULARIZED: "#0ea5e9",
  ABSENCE: "#ef4444",
  MISSING: "#f97316",
  SHORT: "#f59e0b",
  HOLIDAY: "#6366f1",
  NO_RECORD: "#94a3b8",
  OPEN: "#facc15",
};

function TeamStatsCard({
  block,
  onAction,
}: {
  block: Extract<UIBlock, { type: "team_stats" }>;
  onAction?: OnAction;
}) {
  const topMax = Math.max(...block.topEmployees.map((e) => e.hours), 1);
  const distTotal = block.statusDistribution.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 border-b border-emerald-100">
        <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-[11px] font-semibold text-emerald-800">
          Resumen del equipo
        </span>
        <span className="ml-auto text-[10px] text-emerald-600">
          {block.from} → {block.to}
        </span>
      </div>
      <div className="p-3 space-y-3">
        {/* KPI grid */}
        <div className="grid grid-cols-3 gap-1.5">
          <KpiTile
            label="Trabajadas"
            value={`${block.totals.totalWorkedHours}h`}
            tint="bg-emerald-50 text-emerald-700"
          />
          <KpiTile
            label="Planeadas"
            value={`${block.totals.totalPlannedHours}h`}
            tint="bg-indigo-50 text-indigo-700"
          />
          <KpiTile
            label="Empleados"
            value={String(block.totals.totalEmployees)}
            tint="bg-sky-50 text-sky-700"
          />
          <KpiTile
            label="Días"
            value={String(block.totals.totalDays)}
            tint="bg-violet-50 text-violet-700"
          />
          <KpiTile
            label="Ausencias"
            value={String(block.totals.totalAbsences)}
            tint="bg-red-50 text-red-700"
          />
          <KpiTile
            label="Regularizac."
            value={String(block.totals.totalRegularizations)}
            tint="bg-amber-50 text-amber-700"
          />
        </div>

        {/* Top employees bar chart */}
        {block.topEmployees.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Top empleados por horas
            </p>
            <div className="space-y-1">
              {block.topEmployees.map((e) => {
                const pct = (e.hours / topMax) * 100;
                return (
                  <div key={e.name} className="flex items-center gap-2">
                    <span className="w-20 truncate text-[10px] font-medium">
                      {e.name}
                    </span>
                    <div className="relative h-3 flex-1 overflow-hidden rounded bg-gray-100">
                      <div
                        className="h-full rounded bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-[10px] font-semibold tabular-nums">
                      {e.hours}h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Status distribution */}
        {block.statusDistribution.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Distribución de estados
            </p>
            <div className="flex h-2 w-full overflow-hidden rounded-full">
              {block.statusDistribution.map((s) => {
                const pct = (s.count / distTotal) * 100;
                return (
                  <div
                    key={s.status}
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: STATUS_COLORS[s.status] ?? "#94a3b8",
                    }}
                    title={`${s.status}: ${s.count}`}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px]">
              {block.statusDistribution.map((s) => (
                <div key={s.status} className="flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-sm"
                    style={{ background: STATUS_COLORS[s.status] ?? "#94a3b8" }}
                  />
                  <span className="text-muted-foreground">
                    {s.status} · {s.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {onAction && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-dashed">
            <ActionButton
              label="Reporte completo"
              icon={FileText}
              onClick={() =>
                onAction("Dame el resumen completo del equipo del último mes")
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className={cn("rounded-lg p-2", tint)}>
      <p className="text-[9px] uppercase opacity-75">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
    </div>
  );
}

/* ─────────────────── AuditListCard ─────────────────── */

const AUDIT_ACTION_META: Record<
  string,
  { label: string; color: string }
> = {
  CREATE: { label: "Creado", color: "bg-emerald-100 text-emerald-700" },
  UPDATE: { label: "Modificado", color: "bg-sky-100 text-sky-700" },
  DELETE: { label: "Eliminado", color: "bg-red-100 text-red-700" },
  APPROVE: { label: "Aprobado", color: "bg-green-100 text-green-700" },
  REJECT: { label: "Rechazado", color: "bg-orange-100 text-orange-700" },
  BULK_REGULARIZE: { label: "Bloque", color: "bg-amber-100 text-amber-700" },
  REVERT: { label: "Revertido", color: "bg-violet-100 text-violet-700" },
};

function AuditListCard({
  block,
  onAction,
}: {
  block: Extract<UIBlock, { type: "audit_list" }>;
  onAction?: OnAction;
}) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-violet-50 px-3 py-2 border-b border-violet-100">
        <History className="h-3.5 w-3.5 text-violet-600" />
        <span className="text-[11px] font-semibold text-violet-800">Historial reciente</span>
        <span className="ml-auto text-[10px] text-violet-500">{block.total} entradas</span>
      </div>
      {block.items.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-muted-foreground">
          Sin actividad registrada.
        </p>
      ) : (
        <div className="max-h-56 divide-y overflow-y-auto">
          {block.items.map((e) => {
            const meta = AUDIT_ACTION_META[e.action] ?? {
              label: e.action,
              color: "bg-gray-100 text-gray-700",
            };
            return (
              <div key={e.auditId} className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      meta.color
                    )}
                  >
                    {meta.label}
                  </span>
                  {e.reverted && (
                    <span className="rounded-full border px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      Revertido
                    </span>
                  )}
                  <span className="ml-auto text-[9px] text-muted-foreground">
                    {formatShortDate(e.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-medium">
                  {e.entityLabel}
                </p>
                <p className="text-[10px] text-muted-foreground">{e.actor}</p>
              </div>
            );
          })}
        </div>
      )}
      {onAction && (
        <div className="flex px-3 py-2 border-t">
          <ActionButton
            label="Abrir historial"
            icon={History}
            onClick={() => onAction("__NAVIGATE:/admin/audit")}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────── PendingRequestsCard ─────────────────── */

function PendingRequestsCard({
  block,
  onAction,
}: {
  block: Extract<UIBlock, { type: "pending_requests" }>;
  onAction?: OnAction;
}) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 border-b border-amber-100">
        <Inbox className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-[11px] font-semibold text-amber-800">
          Solicitudes pendientes
        </span>
        <span className="ml-auto text-[10px] text-amber-600">
          {block.total} por revisar
        </span>
      </div>
      <div className="p-3 space-y-2">
        {block.total === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span className="text-[11px] text-emerald-700">
              Todo al día. Sin solicitudes por revisar.
            </span>
          </div>
        ) : (
          <>
            {block.byType.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5">
                {block.byType.map((t) => (
                  <div
                    key={t.type}
                    className="rounded-lg bg-amber-50 p-2"
                  >
                    <p className="text-[9px] uppercase text-amber-700 opacity-80">
                      {REQUEST_TYPE_LABELS[t.type] || t.type}
                    </p>
                    <p className="text-sm font-bold text-amber-900">{t.count}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="divide-y rounded-lg border">
              {block.sample.map((s) => (
                <div key={s.id} className="px-2.5 py-1.5">
                  <p className="truncate text-[11px] font-medium">
                    {s.employee}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {REQUEST_TYPE_LABELS[s.type] || s.type}
                    {s.from ? ` · ${s.from}` : ""}
                    {s.to ? ` → ${s.to}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
        {onAction && (
          <div className="flex flex-wrap gap-1.5 border-t border-dashed pt-1">
            <ActionButton
              label="Abrir aprobaciones"
              icon={Inbox}
              onClick={() => onAction("__NAVIGATE:/admin/approvals")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Invitation cards ─────────────────── */

function InvitationPreviewCard({
  block,
  onAction,
}: {
  block: Extract<UIBlock, { type: "invitation_preview" }>;
  onAction?: OnAction;
}) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-sky-50 px-3 py-2 border-b border-sky-100">
        <UserPlus className="h-3.5 w-3.5 text-sky-600" />
        <span className="text-[11px] font-semibold text-sky-800">
          Previsualización de invitación
        </span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3 rounded-lg bg-sky-50 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold">
              {block.fullName || block.email}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {block.email}
            </p>
          </div>
          <span className="rounded-full bg-sky-200 px-2 py-0.5 text-[9px] font-semibold text-sky-800">
            {block.role}
          </span>
        </div>
        {(block.area || block.position) && (
          <div className="flex gap-1.5 text-[10px]">
            {block.area && (
              <span className="rounded border px-1.5 py-0.5">
                Área: {block.area}
              </span>
            )}
            {block.position && (
              <span className="rounded border px-1.5 py-0.5">
                Cargo: {block.position}
              </span>
            )}
          </div>
        )}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
          <p className="text-[10px] text-amber-700 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Confirmación pendiente. Revisa los datos y confirma para enviar.
          </p>
        </div>
        {onAction && (
          <div className="flex flex-wrap gap-1.5 border-t border-dashed pt-1">
            <ActionButton
              label="Confirmar envío"
              icon={Check}
              onClick={() =>
                onAction(
                  `Sí, confirma y crea la invitación para ${block.email}`
                )
              }
            />
            <ActionButton
              label="Cancelar"
              icon={XCircle}
              onClick={() => onAction("Cancela la invitación")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function InvitationCreatedCard({
  block,
  onAction,
}: {
  block: Extract<UIBlock, { type: "invitation_created" }>;
  onAction?: OnAction;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 border-b border-emerald-100">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-[11px] font-semibold text-emerald-800">
          Invitación creada
        </span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-2.5">
          <Mail className="h-4 w-4 text-emerald-600" />
          <span className="truncate text-[11px] font-medium">{block.email}</span>
        </div>
        <div
          className={cn(
            "rounded-lg border px-2.5 py-1.5 text-[10px]",
            block.emailSent
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {block.emailSent
            ? "✉ Email enviado correctamente."
            : "⚠ No se pudo enviar el email. Comparte el link manualmente."}
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== "undefined") {
              navigator.clipboard.writeText(block.inviteLink).catch(() => undefined);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex w-full items-center gap-1.5 rounded border px-2 py-1.5 text-[10px] font-mono text-muted-foreground hover:bg-muted/60"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          <span className="truncate">{block.inviteLink}</span>
        </button>
        {onAction && (
          <div className="flex gap-1.5 border-t border-dashed pt-1">
            <ActionButton
              label="Invitar otro"
              icon={UserPlus}
              onClick={() => onAction("Quiero invitar a otro empleado")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── Setting cards ─────────────────── */

function SettingPreviewCard({
  block,
  onAction,
}: {
  block: Extract<UIBlock, { type: "setting_preview" }>;
  onAction?: OnAction;
}) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-zinc-50 px-3 py-2 border-b">
        <SettingsIcon className="h-3.5 w-3.5 text-zinc-600" />
        <span className="text-[11px] font-semibold text-zinc-800">
          Previsualización de cambio
        </span>
      </div>
      <div className="p-3 space-y-2">
        <div className="rounded-lg bg-zinc-50 p-2.5">
          <p className="text-[9px] uppercase text-muted-foreground">Setting</p>
          <p className="font-mono text-[11px] font-semibold">{block.key}</p>
          <p className="mt-1 text-[9px] uppercase text-muted-foreground">
            Nuevo valor
          </p>
          <p className="font-mono text-[11px]">{JSON.stringify(block.newValue)}</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">
          <p className="text-[10px] text-amber-700">
            Confirmación pendiente. Confirma para aplicar el cambio.
          </p>
        </div>
        {onAction && (
          <div className="flex gap-1.5 border-t border-dashed pt-1">
            <ActionButton
              label="Confirmar"
              icon={Check}
              onClick={() =>
                onAction(
                  `Sí, aplica el cambio ${block.key} = ${JSON.stringify(block.newValue)}`
                )
              }
            />
            <ActionButton
              label="Cancelar"
              icon={XCircle}
              onClick={() => onAction("Cancela el cambio")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SettingUpdatedCard({
  block,
}: {
  block: Extract<UIBlock, { type: "setting_updated" }>;
}) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 border-b border-emerald-100">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-[11px] font-semibold text-emerald-800">
          Configuración actualizada
        </span>
      </div>
      <div className="p-3 space-y-1.5">
        <p className="font-mono text-[11px]">
          <span className="text-muted-foreground">{block.key} = </span>
          <span className="font-semibold">{JSON.stringify(block.newValue)}</span>
        </p>
        <p className="text-[10px] text-muted-foreground">
          Puedes revertir este cambio desde /admin/audit.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────── Revert cards ─────────────────── */

function RevertPreviewCard({
  block,
  onAction,
}: {
  block: Extract<UIBlock, { type: "revert_preview" }>;
  onAction?: OnAction;
}) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-violet-50 px-3 py-2 border-b border-violet-100">
        <Undo2 className="h-3.5 w-3.5 text-violet-600" />
        <span className="text-[11px] font-semibold text-violet-800">
          Previsualización de revert
        </span>
      </div>
      <div className="p-3 space-y-2">
        <p className="rounded bg-muted/40 p-2 font-mono text-[10px]">
          {block.auditId}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Vas a revertir esta acción. Queda auditada y también es reversible.
        </p>
        {onAction && (
          <div className="flex gap-1.5 border-t border-dashed pt-1">
            <ActionButton
              label="Sí, revertir"
              icon={Undo2}
              onClick={() => onAction(`Sí, confirma el revert de ${block.auditId}`)}
            />
            <ActionButton
              label="Cancelar"
              icon={XCircle}
              onClick={() => onAction("Cancela el revert")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function RevertDoneCard({
  block,
}: {
  block: Extract<UIBlock, { type: "revert_done" }>;
}) {
  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 border-b border-emerald-100">
        <Undo2 className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-[11px] font-semibold text-emerald-800">
          Revert aplicado
        </span>
      </div>
      <div className="p-3 space-y-1">
        <p className="font-mono text-[10px] text-muted-foreground">
          {block.auditId}
        </p>
        <p className="text-[11px]">
          La acción fue revertida exitosamente.
        </p>
      </div>
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────

export function ChatBlockRenderer({ block, onAction }: { block: UIBlock; onAction?: OnAction }) {
  switch (block.type) {
    case "attendance_today":
      return <AttendanceTodayCard block={block} onAction={onAction} />;
    case "week_summary":
      return <WeekSummaryCard block={block} onAction={onAction} />;
    case "request_created":
      return <RequestCreatedCard block={block} onAction={onAction} />;
    case "request_list":
      return <RequestListCard block={block} onAction={onAction} />;
    case "attendance_recorded":
      return <AttendanceRecordedCard block={block} onAction={onAction} />;
    case "holidays":
      return <HolidaysCard block={block} onAction={onAction} />;
    case "team_stats":
      return <TeamStatsCard block={block} onAction={onAction} />;
    case "audit_list":
      return <AuditListCard block={block} onAction={onAction} />;
    case "pending_requests":
      return <PendingRequestsCard block={block} onAction={onAction} />;
    case "invitation_preview":
      return <InvitationPreviewCard block={block} onAction={onAction} />;
    case "invitation_created":
      return <InvitationCreatedCard block={block} onAction={onAction} />;
    case "setting_preview":
      return <SettingPreviewCard block={block} onAction={onAction} />;
    case "setting_updated":
      return <SettingUpdatedCard block={block} />;
    case "revert_preview":
      return <RevertPreviewCard block={block} onAction={onAction} />;
    case "revert_done":
      return <RevertDoneCard block={block} />;
    case "info":
      return <InfoCard block={block} />;
    case "error":
      return <ErrorCard block={block} />;
    default:
      return null;
  }
}
