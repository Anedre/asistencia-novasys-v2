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
import {
  PenLineIcon,
  CalendarDays,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getMonthRange(year: number, month: number): { from: string; to: string } {
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

const REGULARIZABLE_STATUSES = new Set([
  "MISSING",
  "NO_RECORD",
  "ABSENT",
  "SHORT",
  "INCOMPLETE",
]);

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_NAMES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

/** Map status to tailwind color classes for the calendar cells */
function statusColor(status: string | undefined): {
  bg: string;
  dot: string;
  ring: string;
  text: string;
} {
  switch (status) {
    case "OK":
    case "CLOSED":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        dot: "bg-emerald-500",
        ring: "ring-emerald-200 dark:ring-emerald-800",
        text: "text-emerald-700 dark:text-emerald-400",
      };
    case "OPEN":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/40",
        dot: "bg-blue-500",
        ring: "ring-blue-200 dark:ring-blue-800",
        text: "text-blue-700 dark:text-blue-400",
      };
    case "SHORT":
    case "INCOMPLETE":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/40",
        dot: "bg-amber-500",
        ring: "ring-amber-200 dark:ring-amber-800",
        text: "text-amber-700 dark:text-amber-400",
      };
    case "REGULARIZED":
      return {
        bg: "bg-purple-50 dark:bg-purple-950/40",
        dot: "bg-purple-500",
        ring: "ring-purple-200 dark:ring-purple-800",
        text: "text-purple-700 dark:text-purple-400",
      };
    case "MISSING":
    case "NO_RECORD":
    case "No Laborable":
      return {
        bg: "bg-gray-50 dark:bg-gray-900/40",
        dot: "bg-gray-400",
        ring: "ring-gray-200 dark:ring-gray-800",
        text: "text-gray-500 dark:text-gray-500",
      };
    case "ABSENCE":
    case "ABSENT":
      return {
        bg: "bg-orange-50 dark:bg-orange-950/40",
        dot: "bg-orange-500",
        ring: "ring-orange-200 dark:ring-orange-800",
        text: "text-orange-700 dark:text-orange-400",
      };
    default:
      return {
        bg: "",
        dot: "bg-gray-300 dark:bg-gray-700",
        ring: "",
        text: "text-muted-foreground",
      };
  }
}

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

/* ------------------------------------------------------------------ */
/*  Calendar Grid Component                                           */
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

  // Build a map from date string to day data
  const dayMap = useMemo(() => {
    const map = new Map<string, HistoryDay>();
    for (const d of days) {
      map.set(d.date, d);
    }
    return map;
  }, [days]);

  // Build calendar grid cells
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastOfMonth.getDate();

    // getDay() returns 0=Sun, we want 0=Mon
    let startDow = firstOfMonth.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: Array<{ day: number | null; dateStr: string | null }> = [];

    // Leading blanks
    for (let i = 0; i < startDow; i++) {
      cells.push({ day: null, dateStr: null });
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      cells.push({ day: d, dateStr: `${year}-${mm}-${dd}` });
    }

    // Trailing blanks to fill last row
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, dateStr: null });
    }

    return cells;
  }, [year, month]);

  // Status legend items
  const legendItems = [
    { label: "Completo", color: "bg-emerald-500" },
    { label: "En curso", color: "bg-blue-500" },
    { label: "Incompleto", color: "bg-amber-500" },
    { label: "Regularizado", color: "bg-purple-500" },
    { label: "Ausencia", color: "bg-orange-500" },
    { label: "Sin registro", color: "bg-gray-400" },
  ];

  return (
    <div className="space-y-4">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((cell, idx) => {
          if (cell.day === null) {
            return <div key={`blank-${idx}`} className="aspect-square" />;
          }

          const dayData = cell.dateStr ? dayMap.get(cell.dateStr) : undefined;
          const colors = statusColor(dayData?.status);
          const isToday = cell.dateStr === todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const hasData = !!dayData;

          return (
            <button
              key={cell.dateStr}
              type="button"
              onClick={() => cell.dateStr && onSelectDate(cell.dateStr)}
              className={[
                "relative flex flex-col items-center justify-center rounded-xl aspect-square transition-all duration-150",
                "text-sm font-medium",
                "hover:scale-105 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                hasData ? colors.bg : "",
                isSelected
                  ? "ring-2 ring-primary shadow-md scale-105"
                  : hasData
                    ? `ring-1 ${colors.ring}`
                    : "ring-1 ring-transparent hover:ring-border",
                isToday && !isSelected ? "ring-2 ring-primary/50" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Day number */}
              <span
                className={[
                  "text-sm leading-none",
                  isToday ? "font-bold" : "",
                  hasData ? colors.text : "text-muted-foreground",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {cell.day}
              </span>

              {/* Status dot */}
              {hasData && (
                <span
                  className={`mt-1 size-1.5 rounded-full ${colors.dot}`}
                />
              )}

              {/* Today indicator */}
              {isToday && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold uppercase tracking-widest text-primary">
                  hoy
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${item.color}`} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Day Detail Card (shown when clicking a calendar day)              */
/* ------------------------------------------------------------------ */

function DayDetail({
  day,
  onRegularize,
}: {
  day: HistoryDay;
  onRegularize: (date: string) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const canRegularize =
    REGULARIZABLE_STATUSES.has(day.status) && day.date < today;

  const colors = statusColor(day.status);

  // Format the date nicely
  const dateObj = new Date(day.date + "T12:00:00");
  const formattedDate = dateObj.toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${colors.bg} ring-1 ${colors.ring}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold capitalize">{formattedDate}</p>
          <StatusBadge status={day.status} className="mt-1" />
        </div>
        {canRegularize && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onRegularize(day.date)}
          >
            <PenLineIcon className="size-3.5" />
            Regularizar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DetailItem label="Entrada" value={day.firstInLocal ?? "--:--"} />
        <DetailItem label="Salida" value={day.lastOutLocal ?? "--:--"} />
        <DetailItem label="Break" value={formatMinutes(day.breakMinutes)} />
        <DetailItem
          label="Trabajado"
          value={day.workedHHMM ?? formatMinutes(day.workedMinutes)}
        />
      </div>

      {(day.reasonLabel || day.reasonCode) && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Razon:</span>{" "}
          {day.reasonLabel ?? day.reasonCode}
        </p>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold">{value}</p>
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

  // Compute date range from calendar month
  const { from: dateFrom, to: dateTo } = useMemo(
    () => getMonthRange(calYear, calMonth),
    [calYear, calMonth]
  );

  // Also allow custom range for list view
  const [listDateFrom, setListDateFrom] = useState(dateFrom);
  const [listDateTo, setListDateTo] = useState(dateTo);
  const [activeTab, setActiveTab] = useState<string | number>("calendar");

  const [regularizeDate, setRegularizeDate] = useState<string | null>(null);

  // Fetch data: for calendar view use calMonth range; for list view use custom range
  const calendarQuery = useAttendanceHistory(dateFrom, dateTo);
  const listQuery = useAttendanceHistory(listDateFrom, listDateTo);

  const calendarDays = (calendarQuery.data?.days ?? []) as HistoryDay[];
  const listDays = (listQuery.data?.days ?? []) as HistoryDay[];

  const totalWorked = listDays.reduce(
    (acc, d) => acc + (d.workedMinutes ?? 0),
    0
  );
  const totalBreak = listDays.reduce(
    (acc, d) => acc + (d.breakMinutes ?? 0),
    0
  );

  const today = new Date().toISOString().split("T")[0];

  // Row refs for scrolling in list view
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const navigateMonth = useCallback(
    (delta: number) => {
      let newMonth = calMonth + delta;
      let newYear = calYear;
      if (newMonth < 0) {
        newMonth = 11;
        newYear -= 1;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear += 1;
      }
      setCalMonth(newMonth);
      setCalYear(newYear);
      setSelectedDate(null);
    },
    [calMonth, calYear]
  );

  const goToToday = useCallback(() => {
    const n = new Date();
    setCalYear(n.getFullYear());
    setCalMonth(n.getMonth());
    setSelectedDate(n.toISOString().split("T")[0]);
  }, []);

  const handleCalendarDateSelect = useCallback(
    (date: string) => {
      setSelectedDate((prev) => (prev === date ? null : date));
    },
    []
  );

  // When switching to list tab from a selected calendar date, scroll to that row
  const handleTabChange = useCallback(
    (value: string | number | null) => {
      if (value !== null) setActiveTab(value);
      if (value === "list" && selectedDate) {
        // Update list range to match calendar month
        setListDateFrom(dateFrom);
        setListDateTo(dateTo);
        // Scroll after a short delay for the tab content to render
        setTimeout(() => {
          const row = rowRefs.current.get(selectedDate);
          if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.classList.add("bg-primary/5");
            setTimeout(() => row.classList.remove("bg-primary/5"), 2000);
          }
        }, 100);
      }
    },
    [selectedDate, dateFrom, dateTo]
  );

  const selectedDayData = useMemo(
    () =>
      selectedDate
        ? calendarDays.find((d) => d.date === selectedDate)
        : undefined,
    [selectedDate, calendarDays]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Historial de Asistencia
        </h1>
        <p className="text-muted-foreground">
          Revisa tu historial de marcaciones
        </p>
      </div>

      <Tabs
        defaultValue="calendar"
        value={activeTab}
        onValueChange={handleTabChange}
      >
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
        <TabsContent value="calendar" className="mt-4 space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navigateMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {MONTH_NAMES[calMonth]} {calYear}
              </h2>
              <button
                type="button"
                onClick={goToToday}
                className="text-xs text-primary hover:underline"
              >
                Ir a hoy
              </button>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => navigateMonth(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Calendar */}
          {calendarQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                Cargando calendario...
              </p>
            </div>
          )}
          {calendarQuery.isError && (
            <p className="text-sm text-destructive">
              Error al cargar el historial. Intenta de nuevo.
            </p>
          )}
          {!calendarQuery.isLoading && !calendarQuery.isError && (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <CalendarGrid
                year={calYear}
                month={calMonth}
                days={calendarDays}
                onSelectDate={handleCalendarDateSelect}
                selectedDate={selectedDate}
              />
            </div>
          )}

          {/* Day Detail */}
          {selectedDayData && (
            <DayDetail
              day={selectedDayData}
              onRegularize={setRegularizeDate}
            />
          )}

          {selectedDate && !selectedDayData && (
            <div className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
              No hay registro para este dia.
            </div>
          )}
        </TabsContent>

        {/* ===================== LIST VIEW ========================= */}
        <TabsContent value="list" className="mt-4 space-y-4">
          {/* Date Range Selector */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={listDateFrom}
                onChange={(e) => setListDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={listDateTo}
                onChange={(e) => setListDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Results Table */}
          {listQuery.isLoading && (
            <p className="text-sm text-muted-foreground">
              Cargando historial...
            </p>
          )}
          {listQuery.isError && (
            <p className="text-sm text-destructive">
              Error al cargar el historial. Intenta de nuevo.
            </p>
          )}

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
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground"
                      >
                        No hay registros en el rango seleccionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    listDays.map((day) => {
                      const canRegularize =
                        REGULARIZABLE_STATUSES.has(day.status) &&
                        day.date < today;

                      return (
                        <TableRow
                          key={day.date}
                          ref={(el) => {
                            if (el) rowRefs.current.set(day.date, el);
                          }}
                          className={
                            day.date === selectedDate
                              ? "bg-primary/5 transition-colors duration-500"
                              : "transition-colors duration-500"
                          }
                        >
                          <TableCell className="font-medium">
                            {day.date}
                          </TableCell>
                          <TableCell>
                            {day.firstInLocal ?? "--:--"}
                          </TableCell>
                          <TableCell>
                            {day.lastOutLocal ?? "--:--"}
                          </TableCell>
                          <TableCell>
                            {formatMinutes(day.breakMinutes)}
                          </TableCell>
                          <TableCell>
                            {day.workedHHMM ??
                              formatMinutes(day.workedMinutes)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={day.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {day.reasonLabel ?? day.reasonCode ?? "-"}
                          </TableCell>
                          <TableCell>
                            {canRegularize && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={() => setRegularizeDate(day.date)}
                              >
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
                      <TableCell className="font-bold">
                        {formatMinutes(totalBreak)}
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatMinutes(totalWorked)}
                      </TableCell>
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

      {/* Regularize Dialog */}
      <RegularizeDialog
        open={regularizeDate !== null}
        onOpenChange={(open) => {
          if (!open) setRegularizeDate(null);
        }}
        workDate={regularizeDate ?? ""}
      />
    </div>
  );
}
