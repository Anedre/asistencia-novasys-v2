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
} from "lucide-react";
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

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  } catch {
    return iso;
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
    case "error":
      return <ErrorCard block={block} />;
    default:
      return null;
  }
}
