"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useAttendanceHistory } from "@/hooks/use-attendance";
import { StatusBadge } from "@/components/attendance/status-badge";
import { RegularizeDialog } from "@/components/attendance/regularize-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  PenLineIcon,
  CalendarDays,
  List,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  Coffee,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getMonthRange(year: number, month: number) {
  const m = String(month + 1).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${m}-01`,
    to: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function shortTime(t: string | null): string {
  if (!t) return "--:--";
  // "09:00:00" -> "09:00"
  return t.length > 5 ? t.substring(0, 5) : t;
}

const REGULARIZABLE_STATUSES = new Set([
  "MISSING", "NO_RECORD", "ABSENT", "SHORT", "INCOMPLETE",
]);

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_HEADERS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];

interface HistoryDay {
  date: string;
  firstInLocal: string | null;
  lastOutLocal: string | null;
  breakMinutes: number;
  workedMinutes: number;
  workedHHMM: string;
  status: string;
  reasonCode?: string;
  reasonLabel?: string;
  anomalies?: string[];
}

/* ── Status Color System ──────────────────────────────────────────── */

function statusStyle(status: string | undefined) {
  switch (status) {
    case "OK":
    case "CLOSED":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        border: "border-emerald-200 dark:border-emerald-800",
        accent: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-400",
        label: "Completo",
      };
    case "OPEN":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-800",
        accent: "bg-blue-500",
        text: "text-blue-700 dark:text-blue-400",
        label: "En curso",
      };
    case "SHORT":
    case "INCOMPLETE":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        accent: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-400",
        label: "Incompleto",
      };
    case "REGULARIZED":
      return {
        bg: "bg-violet-50 dark:bg-violet-950/30",
        border: "border-violet-200 dark:border-violet-800",
        accent: "bg-violet-500",
        text: "text-violet-700 dark:text-violet-400",
        label: "Regularizado",
      };
    case "ABSENCE":
    case "ABSENT":
      return {
        bg: "bg-orange-50 dark:bg-orange-950/30",
        border: "border-orange-200 dark:border-orange-800",
        accent: "bg-orange-500",
        text: "text-orange-700 dark:text-orange-400",
        label: "Ausencia",
      };
    default:
      return {
        bg: "bg-gray-50/50 dark:bg-gray-900/20",
        border: "border-gray-100 dark:border-gray-800",
        accent: "bg-gray-300 dark:bg-gray-600",
        text: "text-gray-400 dark:text-gray-500",
        label: "Sin registro",
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Compact Calendar Cell                                             */
/* ------------------------------------------------------------------ */

function CalendarCell({
  day,
  dateStr,
  dayData,
  isToday,
  isSelected,
  isWeekend,
  onClick,
}: {
  day: number | null;
  dateStr: string | null;
  dayData?: HistoryDay;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  onClick: () => void;
}) {
  if (day === null) {
    return <div className="min-h-[72px]" />;
  }

  const style = statusStyle(dayData?.status);
  const hasData = !!dayData;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-lg border p-1.5 min-h-[72px] text-left transition-all duration-150",
        "hover:shadow-md hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        hasData ? style.bg : isWeekend ? "bg-gray-50/30 dark:bg-gray-900/10" : "bg-background",
        hasData ? style.border : "border-border/50",
        isSelected && "ring-2 ring-primary shadow-lg scale-[1.02] !border-primary/50",
        isToday && !isSelected && "ring-1 ring-primary/40",
      )}
    >
      {/* Top row: day number + status dot */}
      <div className="flex items-center justify-between w-full">
        <span className={cn(
          "text-xs font-semibold leading-none",
          isToday && "text-primary",
          hasData ? style.text : isWeekend ? "text-gray-400" : "text-muted-foreground",
        )}>
          {day}
        </span>
        {hasData && (
          <span className={cn("size-2 rounded-full", style.accent)} />
        )}
        {isToday && (
          <span className="rounded-full bg-primary px-1 py-px text-[7px] font-bold text-primary-foreground uppercase leading-none">
            hoy
          </span>
        )}
      </div>

      {/* Attendance info inside cell */}
      {hasData && dayData ? (
        <div className="mt-auto space-y-0.5 w-full">
          <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
            <span className="tabular-nums">{shortTime(dayData.firstInLocal)}</span>
            <span>-</span>
            <span className="tabular-nums">{shortTime(dayData.lastOutLocal)}</span>
          </div>
          <div className={cn("text-[10px] font-bold tabular-nums", style.text)}>
            {dayData.workedHHMM || formatMinutes(dayData.workedMinutes)}
          </div>
        </div>
      ) : !isWeekend ? (
        <div className="mt-auto">
          <span className="text-[9px] text-gray-300 dark:text-gray-600">--:--</span>
        </div>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar Grid                                                     */
/* ------------------------------------------------------------------ */

function CalendarGrid({
  year,
  month,
  days,
  onSelectDate,
  selectedDate,
}: {
  year: number;
  month: number;
  days: HistoryDay[];
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
}) {
  const todayStr = new Date().toISOString().split("T")[0];

  const dayMap = useMemo(() => {
    const map = new Map<string, HistoryDay>();
    for (const d of days) map.set(d.date, d);
    return map;
  }, [days]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstOfMonth.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: Array<{ day: number | null; dateStr: string | null; isWeekend: boolean }> = [];

    for (let i = 0; i < startDow; i++) {
      cells.push({ day: null, dateStr: null, isWeekend: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const dow = new Date(year, month, d).getDay();
      cells.push({ day: d, dateStr, isWeekend: dow === 0 || dow === 6 });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateStr: null, isWeekend: false });
    }

    return cells;
  }, [year, month]);

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((name, i) => (
          <div
            key={name}
            className={cn(
              "py-1.5 text-center text-[10px] font-bold uppercase tracking-widest",
              i >= 5 ? "text-gray-400" : "text-muted-foreground",
            )}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, idx) => (
          <CalendarCell
            key={cell.dateStr || `blank-${idx}`}
            day={cell.day}
            dateStr={cell.dateStr}
            dayData={cell.dateStr ? dayMap.get(cell.dateStr) : undefined}
            isToday={cell.dateStr === todayStr}
            isSelected={cell.dateStr === selectedDate}
            isWeekend={cell.isWeekend}
            onClick={() => cell.dateStr && onSelectDate(cell.dateStr)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3">
        {[
          { label: "Completo", color: "bg-emerald-500" },
          { label: "En curso", color: "bg-blue-500" },
          { label: "Incompleto", color: "bg-amber-500" },
          { label: "Regularizado", color: "bg-violet-500" },
          { label: "Ausencia", color: "bg-orange-500" },
          { label: "Sin registro", color: "bg-gray-300" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <span className={cn("size-2 rounded-full", item.color)} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Side Detail Panel                                                 */
/* ------------------------------------------------------------------ */

function DetailPanel({
  day,
  onRegularize,
  onClose,
}: {
  day: HistoryDay;
  onRegularize: (date: string) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const canRegularize = REGULARIZABLE_STATUSES.has(day.status) && day.date < today;
  const style = statusStyle(day.status);
  const delta = day.workedMinutes - 480;

  const dateObj = new Date(day.date + "T12:00:00");
  const dayName = dateObj.toLocaleDateString("es-PE", { weekday: "long" });
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString("es-PE", { month: "long" });

  return (
    <div className="flex flex-col rounded-2xl border bg-background shadow-lg overflow-hidden h-full">
      {/* Header with accent color */}
      <div className={cn("px-4 py-3 border-b", style.bg, style.border)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium capitalize text-muted-foreground">{dayName}</p>
            <p className="text-2xl font-bold tracking-tight">
              {dayNum} <span className="text-base font-medium capitalize">{monthName}</span>
            </p>
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", style.bg, "border", style.border)}>
            <span className={cn("size-3 rounded-full", style.accent)} />
          </div>
        </div>
        <div className="mt-2">
          <StatusBadge status={day.status} />
        </div>
      </div>

      {/* Time details */}
      <div className="p-4 space-y-4 flex-1">
        {/* Entry / Exit */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <LogIn className="size-3 text-emerald-600" />
              <span className="text-[10px] font-semibold uppercase text-emerald-600">Entrada</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{shortTime(day.firstInLocal)}</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <LogOut className="size-3 text-red-500" />
              <span className="text-[10px] font-semibold uppercase text-red-500">Salida</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{shortTime(day.lastOutLocal)}</p>
          </div>
        </div>

        {/* Break + Worked */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Coffee className="size-3 text-amber-600" />
              <span className="text-[10px] font-semibold uppercase text-amber-600">Break</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{day.breakMinutes} min</p>
          </div>
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="size-3 text-blue-600" />
              <span className="text-[10px] font-semibold uppercase text-blue-600">Trabajado</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{day.workedHHMM || formatMinutes(day.workedMinutes)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">Progreso del dia</span>
            <span className="font-semibold">{Math.min(Math.round((day.workedMinutes / 480) * 100), 100)}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                day.workedMinutes >= 480 ? "bg-emerald-500" : day.workedMinutes >= 360 ? "bg-blue-500" : day.workedMinutes >= 240 ? "bg-amber-500" : "bg-red-400",
              )}
              style={{ width: `${Math.min((day.workedMinutes / 480) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Delta */}
        <div className={cn(
          "flex items-center gap-2 rounded-xl p-3 border",
          delta >= 0 ? "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900" : "bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900",
        )}>
          {delta >= 0 ? (
            <TrendingUp className="size-4 text-emerald-600" />
          ) : (
            <TrendingDown className="size-4 text-red-500" />
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Balance del dia</p>
            <p className={cn("text-sm font-bold", delta >= 0 ? "text-emerald-700" : "text-red-600")}>
              {delta >= 0 ? "+" : ""}{formatMinutes(delta)}
            </p>
          </div>
        </div>

        {/* Reason */}
        {(day.reasonLabel || day.reasonCode) && (
          <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 border border-border/50">
            <AlertCircle className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Motivo</p>
              <p className="text-xs">{day.reasonLabel ?? day.reasonCode}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t p-3 flex gap-2">
        {canRegularize && (
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => onRegularize(day.date)}
          >
            <PenLineIcon className="size-3.5" />
            Regularizar
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className={canRegularize ? "" : "flex-1"}
          onClick={onClose}
        >
          Cerrar
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty Detail Panel                                                */
/* ------------------------------------------------------------------ */

function EmptyDetailPanel() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/20 p-6 h-full text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5">
        <CalendarDays className="size-7 text-primary/40" />
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">
        Selecciona un dia
      </p>
      <p className="mt-1 text-xs text-muted-foreground/60">
        Haz clic en cualquier dia del calendario para ver el detalle
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Month Summary Bar                                                 */
/* ------------------------------------------------------------------ */

function MonthSummary({ days }: { days: HistoryDay[] }) {
  const worked = days.reduce((a, d) => a + (d.workedMinutes ?? 0), 0);
  const planned = days.filter(d => {
    const dow = new Date(d.date + "T12:00:00").getDay();
    return dow !== 0 && dow !== 6;
  }).length * 480;
  const delta = worked - planned;
  const complete = days.filter(d => d.status === "OK" || d.status === "CLOSED" || d.status === "REGULARIZED").length;
  const missing = days.filter(d => d.status === "MISSING" || d.status === "NO_RECORD").length;

  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: "Trabajado", value: formatMinutes(worked), color: "text-blue-600" },
        { label: "Balance", value: `${delta >= 0 ? "+" : ""}${formatMinutes(delta)}`, color: delta >= 0 ? "text-emerald-600" : "text-red-500" },
        { label: "Completos", value: `${complete}`, color: "text-emerald-600" },
        { label: "Sin registro", value: `${missing}`, color: missing > 0 ? "text-amber-600" : "text-gray-400" },
      ].map((item) => (
        <div key={item.label} className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
          <p className={cn("text-sm font-bold tabular-nums", item.color)}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function HistoryPage() {
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { from: dateFrom, to: dateTo } = useMemo(
    () => getMonthRange(calYear, calMonth),
    [calYear, calMonth]
  );

  const [listDateFrom, setListDateFrom] = useState(dateFrom);
  const [listDateTo, setListDateTo] = useState(dateTo);
  const [activeTab, setActiveTab] = useState<string | number>("calendar");
  const [regularizeDate, setRegularizeDate] = useState<string | null>(null);

  const calendarQuery = useAttendanceHistory(dateFrom, dateTo);
  const listQuery = useAttendanceHistory(listDateFrom, listDateTo);

  const calendarDays = (calendarQuery.data?.days ?? []) as HistoryDay[];
  const listDays = (listQuery.data?.days ?? []) as HistoryDay[];

  const totalWorked = listDays.reduce((acc, d) => acc + (d.workedMinutes ?? 0), 0);
  const totalBreak = listDays.reduce((acc, d) => acc + (d.breakMinutes ?? 0), 0);
  const today = new Date().toISOString().split("T")[0];

  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const navigateMonth = useCallback((delta: number) => {
    let newMonth = calMonth + delta;
    let newYear = calYear;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    else if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setCalMonth(newMonth);
    setCalYear(newYear);
    setSelectedDate(null);
  }, [calMonth, calYear]);

  const goToToday = useCallback(() => {
    const n = new Date();
    setCalYear(n.getFullYear());
    setCalMonth(n.getMonth());
    setSelectedDate(n.toISOString().split("T")[0]);
  }, []);

  const handleCalendarDateSelect = useCallback((date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
  }, []);

  const handleTabChange = useCallback((value: string | number | null) => {
    if (value !== null) setActiveTab(value);
    if (value === "list" && selectedDate) {
      setListDateFrom(dateFrom);
      setListDateTo(dateTo);
      setTimeout(() => {
        const row = rowRefs.current.get(selectedDate);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          row.classList.add("bg-primary/5");
          setTimeout(() => row.classList.remove("bg-primary/5"), 2000);
        }
      }, 100);
    }
  }, [selectedDate, dateFrom, dateTo]);

  const selectedDayData = useMemo(
    () => selectedDate ? calendarDays.find((d) => d.date === selectedDate) : undefined,
    [selectedDate, calendarDays]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial de Asistencia</h1>
        <p className="text-sm text-muted-foreground">Revisa tu historial de marcaciones</p>
      </div>

      <Tabs defaultValue="calendar" value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="size-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5">
            <List className="size-4" />
            Lista
          </TabsTrigger>
        </TabsList>

        {/* ===================== CALENDAR VIEW ===================== */}
        <TabsContent value="calendar" className="mt-3">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-center">
              <h2 className="text-base font-bold">{MONTH_NAMES[calMonth]} {calYear}</h2>
              <button type="button" onClick={goToToday} className="text-[10px] text-primary hover:underline">
                Ir a hoy
              </button>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateMonth(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Month summary */}
          {!calendarQuery.isLoading && calendarDays.length > 0 && (
            <MonthSummary days={calendarDays} />
          )}

          {calendarQuery.isLoading && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground animate-pulse">Cargando calendario...</p>
            </div>
          )}

          {calendarQuery.isError && (
            <p className="text-sm text-destructive py-8 text-center">Error al cargar el historial.</p>
          )}

          {!calendarQuery.isLoading && !calendarQuery.isError && (
            <div className="flex gap-4 mt-3">
              {/* Calendar grid */}
              <div className={cn("flex-1 min-w-0 transition-all", selectedDate ? "max-w-[60%]" : "")}>
                <div className="rounded-2xl border bg-card p-3 shadow-sm">
                  <CalendarGrid
                    year={calYear}
                    month={calMonth}
                    days={calendarDays}
                    onSelectDate={handleCalendarDateSelect}
                    selectedDate={selectedDate}
                  />
                </div>
              </div>

              {/* Side detail panel */}
              <div className={cn(
                "transition-all duration-300 overflow-hidden",
                selectedDate ? "w-[280px] opacity-100" : "w-0 opacity-0",
              )}>
                {selectedDayData ? (
                  <DetailPanel
                    day={selectedDayData}
                    onRegularize={setRegularizeDate}
                    onClose={() => setSelectedDate(null)}
                  />
                ) : selectedDate ? (
                  <div className="rounded-2xl border bg-muted/20 p-6 text-center h-full flex flex-col items-center justify-center">
                    <CalendarDays className="size-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">Sin registro para este dia</p>
                    {REGULARIZABLE_STATUSES.has("NO_RECORD") && selectedDate < today && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 gap-1.5"
                        onClick={() => setRegularizeDate(selectedDate)}
                      >
                        <PenLineIcon className="size-3.5" />
                        Regularizar
                      </Button>
                    )}
                  </div>
                ) : (
                  <EmptyDetailPanel />
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ===================== LIST VIEW ========================= */}
        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input id="dateFrom" type="date" value={listDateFrom} onChange={(e) => setListDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input id="dateTo" type="date" value={listDateTo} onChange={(e) => setListDateTo(e.target.value)} />
            </div>
          </div>

          {listQuery.isLoading && <p className="text-sm text-muted-foreground">Cargando historial...</p>}
          {listQuery.isError && <p className="text-sm text-destructive">Error al cargar el historial.</p>}

          {!listQuery.isLoading && !listQuery.isError && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Salida</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Trabajo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Razon</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listDays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No hay registros en el rango seleccionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    listDays.map((day) => {
                      const canRegularize = REGULARIZABLE_STATUSES.has(day.status) && day.date < today;
                      return (
                        <TableRow
                          key={day.date}
                          ref={(el) => { if (el) rowRefs.current.set(day.date, el); }}
                          className={day.date === selectedDate ? "bg-primary/5 transition-colors duration-500" : "transition-colors duration-500"}
                        >
                          <TableCell className="font-medium">{day.date}</TableCell>
                          <TableCell>{day.firstInLocal ?? "--:--"}</TableCell>
                          <TableCell>{day.lastOutLocal ?? "--:--"}</TableCell>
                          <TableCell>{formatMinutes(day.breakMinutes)}</TableCell>
                          <TableCell>{day.workedHHMM ?? formatMinutes(day.workedMinutes)}</TableCell>
                          <TableCell><StatusBadge status={day.status} /></TableCell>
                          <TableCell className="text-muted-foreground">{day.reasonLabel ?? day.reasonCode ?? "-"}</TableCell>
                          <TableCell>
                            {canRegularize && (
                              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setRegularizeDate(day.date)}>
                                <PenLineIcon className="size-3.5" />
                                Regularizar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {listDays.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="font-bold">{formatMinutes(totalBreak)}</TableCell>
                      <TableCell className="font-bold">{formatMinutes(totalWorked)}</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RegularizeDialog
        open={regularizeDate !== null}
        onOpenChange={(open) => { if (!open) setRegularizeDate(null); }}
        workDate={regularizeDate ?? ""}
      />
    </div>
  );
}
