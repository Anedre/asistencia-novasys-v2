"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  Palette,
  X,
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

function fmtMin(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function shortTime(t: string | null): string {
  if (!t) return "--:--";
  return t.length > 5 ? t.substring(0, 5) : t;
}

const REGULARIZABLE = new Set(["MISSING", "NO_RECORD", "ABSENT", "SHORT", "INCOMPLETE"]);
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_H = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];

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

/* ── 4 Color Themes ───────────────────────────────────────────────── */

interface Theme {
  name: string;
  ok: { bg: string; border: string; dot: string; text: string };
  open: { bg: string; border: string; dot: string; text: string };
  short: { bg: string; border: string; dot: string; text: string };
  reg: { bg: string; border: string; dot: string; text: string };
  absent: { bg: string; border: string; dot: string; text: string };
  none: { bg: string; border: string; dot: string; text: string };
  accent: string;
  headerBg: string;
}

const THEMES: Record<string, Theme> = {
  aurora: {
    name: "Aurora Boreal",
    ok:     { bg: "bg-teal-50",    border: "border-teal-200",    dot: "bg-teal-500",    text: "text-teal-700" },
    open:   { bg: "bg-cyan-50",    border: "border-cyan-200",    dot: "bg-cyan-500",    text: "text-cyan-700" },
    short:  { bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500",   text: "text-amber-700" },
    reg:    { bg: "bg-indigo-50",  border: "border-indigo-200",  dot: "bg-indigo-500",  text: "text-indigo-700" },
    absent: { bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-500",    text: "text-rose-700" },
    none:   { bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-300",   text: "text-slate-400" },
    accent: "text-teal-600",
    headerBg: "from-teal-500 to-cyan-500",
  },
  cerezo: {
    name: "Flor de Cerezo",
    ok:     { bg: "bg-pink-50",    border: "border-pink-200",    dot: "bg-pink-500",    text: "text-pink-700" },
    open:   { bg: "bg-fuchsia-50", border: "border-fuchsia-200", dot: "bg-fuchsia-500", text: "text-fuchsia-700" },
    short:  { bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500",   text: "text-amber-700" },
    reg:    { bg: "bg-violet-50",  border: "border-violet-200",  dot: "bg-violet-500",  text: "text-violet-700" },
    absent: { bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-400",     text: "text-red-600" },
    none:   { bg: "bg-gray-50",    border: "border-gray-200",    dot: "bg-gray-300",    text: "text-gray-400" },
    accent: "text-pink-600",
    headerBg: "from-pink-500 to-fuchsia-500",
  },
  obsidiana: {
    name: "Obsidiana",
    ok:     { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700" },
    open:   { bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500",    text: "text-blue-700" },
    short:  { bg: "bg-orange-50",  border: "border-orange-200",  dot: "bg-orange-500",  text: "text-orange-700" },
    reg:    { bg: "bg-purple-50",  border: "border-purple-200",  dot: "bg-purple-500",  text: "text-purple-700" },
    absent: { bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500",     text: "text-red-700" },
    none:   { bg: "bg-zinc-50",    border: "border-zinc-200",    dot: "bg-zinc-300",    text: "text-zinc-400" },
    accent: "text-emerald-600",
    headerBg: "from-zinc-700 to-zinc-900",
  },
  lavanda: {
    name: "Jardin Lavanda",
    ok:     { bg: "bg-lime-50",    border: "border-lime-200",    dot: "bg-lime-500",    text: "text-lime-700" },
    open:   { bg: "bg-sky-50",     border: "border-sky-200",     dot: "bg-sky-500",     text: "text-sky-700" },
    short:  { bg: "bg-yellow-50",  border: "border-yellow-200",  dot: "bg-yellow-500",  text: "text-yellow-700" },
    reg:    { bg: "bg-purple-50",  border: "border-purple-200",  dot: "bg-purple-500",  text: "text-purple-700" },
    absent: { bg: "bg-orange-50",  border: "border-orange-200",  dot: "bg-orange-500",  text: "text-orange-700" },
    none:   { bg: "bg-gray-50",    border: "border-gray-200",    dot: "bg-gray-300",    text: "text-gray-400" },
    accent: "text-purple-600",
    headerBg: "from-purple-400 to-violet-500",
  },
};

function getStatusColors(theme: Theme, status: string | undefined) {
  switch (status) {
    case "OK": case "CLOSED": return theme.ok;
    case "OPEN": return theme.open;
    case "SHORT": case "INCOMPLETE": return theme.short;
    case "REGULARIZED": return theme.reg;
    case "ABSENCE": case "ABSENT": return theme.absent;
    default: return theme.none;
  }
}

/* ------------------------------------------------------------------ */
/*  Calendar Cell                                                     */
/* ------------------------------------------------------------------ */

function CalendarCell({
  day, dateStr, dayData, isToday, isSelected, isWeekend, onClick, theme,
}: {
  day: number | null;
  dateStr: string | null;
  dayData?: HistoryDay;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  onClick: () => void;
  theme: Theme;
}) {
  if (day === null) return <div className="min-h-[80px]" />;

  const c = getStatusColors(theme, dayData?.status);
  const has = !!dayData;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-xl border p-2 min-h-[80px] text-left transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        has ? c.bg : isWeekend ? "bg-gray-50/50" : "bg-background",
        has ? c.border : "border-border/40",
        isSelected && "ring-2 ring-primary shadow-xl -translate-y-0.5 !border-primary/50 z-10",
        isToday && !isSelected && "ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className={cn(
          "text-sm font-bold leading-none",
          isToday && "text-primary",
          has ? c.text : isWeekend ? "text-gray-400" : "text-foreground/60",
        )}>
          {day}
        </span>
        <div className="flex items-center gap-1">
          {has && <span className={cn("size-2.5 rounded-full", c.dot)} />}
          {isToday && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground uppercase leading-none">
              hoy
            </span>
          )}
        </div>
      </div>

      {has && dayData ? (
        <div className="mt-auto space-y-0.5 w-full">
          <div className="flex items-center gap-1 text-[11px] text-foreground/50 tabular-nums">
            <span>{shortTime(dayData.firstInLocal)}</span>
            <span className="text-foreground/30">-</span>
            <span>{shortTime(dayData.lastOutLocal)}</span>
          </div>
          <div className={cn("text-xs font-extrabold tabular-nums", c.text)}>
            {dayData.workedHHMM || fmtMin(dayData.workedMinutes)}
          </div>
        </div>
      ) : !isWeekend ? (
        <div className="mt-auto">
          <span className="text-[11px] text-foreground/20 tabular-nums">--:--</span>
        </div>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Calendar Grid                                                     */
/* ------------------------------------------------------------------ */

function CalendarGrid({
  year, month, days, onSelectDate, selectedDate, theme,
}: {
  year: number; month: number; days: HistoryDay[];
  onSelectDate: (d: string) => void; selectedDate: string | null;
  theme: Theme;
}) {
  const todayStr = new Date().toISOString().split("T")[0];

  const dayMap = useMemo(() => {
    const m = new Map<string, HistoryDay>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const total = new Date(year, month + 1, 0).getDate();
    let start = first.getDay() - 1;
    if (start < 0) start = 6;
    const r: Array<{ day: number | null; dateStr: string | null; isWeekend: boolean }> = [];
    for (let i = 0; i < start; i++) r.push({ day: null, dateStr: null, isWeekend: false });
    for (let d = 1; d <= total; d++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      const dow = new Date(year, month, d).getDay();
      r.push({ day: d, dateStr: `${year}-${mm}-${dd}`, isWeekend: dow === 0 || dow === 6 });
    }
    while (r.length % 7 !== 0) r.push({ day: null, dateStr: null, isWeekend: false });
    return r;
  }, [year, month]);

  const legendItems = [
    { label: "Completo", c: theme.ok.dot },
    { label: "En curso", c: theme.open.dot },
    { label: "Incompleto", c: theme.short.dot },
    { label: "Regularizado", c: theme.reg.dot },
    { label: "Ausencia", c: theme.absent.dot },
    { label: "Sin registro", c: theme.none.dot },
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAYS_H.map((n, i) => (
          <div key={n} className={cn(
            "py-2 text-center text-xs font-bold uppercase tracking-wider",
            i >= 5 ? "text-foreground/30" : "text-foreground/50",
          )}>{n}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, idx) => (
          <CalendarCell
            key={cell.dateStr || `b${idx}`}
            day={cell.day}
            dateStr={cell.dateStr}
            dayData={cell.dateStr ? dayMap.get(cell.dateStr) : undefined}
            isToday={cell.dateStr === todayStr}
            isSelected={cell.dateStr === selectedDate}
            isWeekend={cell.isWeekend}
            onClick={() => cell.dateStr && onSelectDate(cell.dateStr)}
            theme={theme}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4">
        {legendItems.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", it.c)} />
            <span className="text-xs text-foreground/50">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Slide-in Detail Panel                                             */
/* ------------------------------------------------------------------ */

function DetailPanel({
  day, onRegularize, onClose, theme, visible,
}: {
  day: HistoryDay; onRegularize: (d: string) => void; onClose: () => void;
  theme: Theme; visible: boolean;
}) {
  const today = new Date().toISOString().split("T")[0];
  const canReg = REGULARIZABLE.has(day.status) && day.date < today;
  const c = getStatusColors(theme, day.status);
  const delta = day.workedMinutes - 480;
  const pct = Math.min(Math.round((day.workedMinutes / 480) * 100), 100);

  const dateObj = new Date(day.date + "T12:00:00");
  const dayName = dateObj.toLocaleDateString("es-PE", { weekday: "long" });
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString("es-PE", { month: "long" });

  return (
    <div className={cn(
      "flex flex-col rounded-2xl border bg-background shadow-2xl overflow-hidden transition-all duration-300 ease-out",
      visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0",
    )}>
      {/* Header */}
      <div className={cn("relative px-5 py-4 text-white bg-gradient-to-r", theme.headerBg)}>
        <button onClick={onClose} className="absolute top-3 right-3 rounded-full bg-white/20 p-1 hover:bg-white/30 transition-colors">
          <X className="size-4" />
        </button>
        <p className="text-sm font-medium capitalize opacity-80">{dayName}</p>
        <p className="text-3xl font-black tracking-tight">
          {dayNum} <span className="text-lg font-semibold capitalize">{monthName}</span>
        </p>
        <div className="mt-2">
          <StatusBadge status={day.status} />
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={LogIn} label="Entrada" value={shortTime(day.firstInLocal)} color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-100" />
          <InfoCard icon={LogOut} label="Salida" value={shortTime(day.lastOutLocal)} color="text-red-500" bg="bg-red-50" border="border-red-100" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={Coffee} label="Break" value={`${day.breakMinutes} min`} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" />
          <InfoCard icon={Clock} label="Trabajado" value={day.workedHHMM || fmtMin(day.workedMinutes)} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-foreground/50 font-medium">Progreso</span>
            <span className="font-bold">{pct}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Delta */}
        <div className={cn(
          "flex items-center gap-3 rounded-xl p-3.5 border",
          delta >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100",
        )}>
          {delta >= 0 ? <TrendingUp className="size-5 text-emerald-600" /> : <TrendingDown className="size-5 text-red-500" />}
          <div>
            <p className="text-xs font-semibold text-foreground/50 uppercase">Balance</p>
            <p className={cn("text-base font-black", delta >= 0 ? "text-emerald-700" : "text-red-600")}>
              {delta >= 0 ? "+" : ""}{fmtMin(delta)}
            </p>
          </div>
        </div>

        {(day.reasonLabel || day.reasonCode) && (
          <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3 border border-border/50">
            <AlertCircle className="size-4 mt-0.5 text-foreground/40 shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground/50 uppercase">Motivo</p>
              <p className="text-sm">{day.reasonLabel ?? day.reasonCode}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-4 flex gap-2 mt-auto">
        {canReg && (
          <Button size="sm" className="flex-1 gap-1.5" onClick={() => onRegularize(day.date)}>
            <PenLineIcon className="size-4" /> Regularizar
          </Button>
        )}
        <Button variant="outline" size="sm" className={canReg ? "" : "flex-1"} onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, color, bg, border }: {
  icon: typeof Clock; label: string; value: string; color: string; bg: string; border: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 border", bg, border)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("size-3.5", color)} />
        <span className={cn("text-[11px] font-bold uppercase", color)}>{label}</span>
      </div>
      <p className="text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Month Summary                                                     */
/* ------------------------------------------------------------------ */

function MonthSummary({ days }: { days: HistoryDay[] }) {
  const worked = days.reduce((a, d) => a + (d.workedMinutes ?? 0), 0);
  const planned = days.filter(d => {
    const dow = new Date(d.date + "T12:00:00").getDay();
    return dow !== 0 && dow !== 6;
  }).length * 480;
  const delta = worked - planned;
  const ok = days.filter(d => ["OK","CLOSED","REGULARIZED"].includes(d.status)).length;
  const miss = days.filter(d => ["MISSING","NO_RECORD"].includes(d.status)).length;

  return (
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: "Trabajado", value: fmtMin(worked), color: "text-blue-600" },
        { label: "Balance", value: `${delta >= 0 ? "+" : ""}${fmtMin(delta)}`, color: delta >= 0 ? "text-emerald-600" : "text-red-500" },
        { label: "Completos", value: `${ok}`, color: "text-emerald-600" },
        { label: "Sin registro", value: `${miss}`, color: miss > 0 ? "text-amber-600" : "text-foreground/30" },
      ].map((it) => (
        <div key={it.label} className="rounded-xl bg-muted/50 px-3 py-2 text-center border border-border/30">
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">{it.label}</p>
          <p className={cn("text-base font-black tabular-nums", it.color)}>{it.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Theme Picker                                                      */
/* ------------------------------------------------------------------ */

function ThemePicker({ current, onChange }: { current: string; onChange: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const dots: Record<string, string> = {
    aurora: "bg-teal-500", cerezo: "bg-pink-500", obsidiana: "bg-zinc-700", lavanda: "bg-purple-500",
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setOpen(!open)}>
        <Palette className="size-3.5" />
        <span className={cn("size-3 rounded-full", dots[current])} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border bg-background shadow-xl p-2 space-y-1 w-48 animate-in fade-in slide-in-from-top-2 duration-200">
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={cn(
                "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors",
                current === key ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted",
              )}
            >
              <span className={cn("size-3.5 rounded-full", dots[key])} />
              {t.name}
            </button>
          ))}
        </div>
      )}
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
  const [panelVisible, setPanelVisible] = useState(false);
  const [themeKey, setThemeKey] = useState("aurora");

  const theme = THEMES[themeKey] || THEMES.aurora;

  const { from: dateFrom, to: dateTo } = useMemo(() => getMonthRange(calYear, calMonth), [calYear, calMonth]);

  const [listDateFrom, setListDateFrom] = useState(dateFrom);
  const [listDateTo, setListDateTo] = useState(dateTo);
  const [activeTab, setActiveTab] = useState<string | number>("calendar");
  const [regularizeDate, setRegularizeDate] = useState<string | null>(null);

  const calQ = useAttendanceHistory(dateFrom, dateTo);
  const listQ = useAttendanceHistory(listDateFrom, listDateTo);

  const calDays = (calQ.data?.days ?? []) as HistoryDay[];
  const listDays = (listQ.data?.days ?? []) as HistoryDay[];

  const totalWorked = listDays.reduce((a, d) => a + (d.workedMinutes ?? 0), 0);
  const totalBreak = listDays.reduce((a, d) => a + (d.breakMinutes ?? 0), 0);
  const today = new Date().toISOString().split("T")[0];

  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Animate panel slide-in
  useEffect(() => {
    if (selectedDate) {
      setPanelVisible(false);
      const t = setTimeout(() => setPanelVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setPanelVisible(false);
    }
  }, [selectedDate]);

  const navMonth = useCallback((d: number) => {
    let nm = calMonth + d, ny = calYear;
    if (nm < 0) { nm = 11; ny--; } else if (nm > 11) { nm = 0; ny++; }
    setCalMonth(nm); setCalYear(ny); setSelectedDate(null);
  }, [calMonth, calYear]);

  const goToday = useCallback(() => {
    const n = new Date();
    setCalYear(n.getFullYear()); setCalMonth(n.getMonth());
    setSelectedDate(n.toISOString().split("T")[0]);
  }, []);

  const selectDate = useCallback((d: string) => {
    setSelectedDate(prev => prev === d ? null : d);
  }, []);

  const handleTabChange = useCallback((v: string | number | null) => {
    if (v !== null) setActiveTab(v);
    if (v === "list" && selectedDate) {
      setListDateFrom(dateFrom); setListDateTo(dateTo);
      setTimeout(() => {
        const row = rowRefs.current.get(selectedDate);
        if (row) { row.scrollIntoView({ behavior: "smooth", block: "center" }); }
      }, 100);
    }
  }, [selectedDate, dateFrom, dateTo]);

  const selectedDay = useMemo(
    () => selectedDate ? calDays.find(d => d.date === selectedDate) : undefined,
    [selectedDate, calDays]
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historial de Asistencia</h1>
          <p className="text-sm text-muted-foreground">Revisa tu historial de marcaciones</p>
        </div>
        <ThemePicker current={themeKey} onChange={setThemeKey} />
      </div>

      <Tabs defaultValue="calendar" value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="size-4" /> Calendario
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5">
            <List className="size-4" /> Lista
          </TabsTrigger>
        </TabsList>

        {/* ═══════════ CALENDAR ═══════════ */}
        <TabsContent value="calendar" className="mt-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="size-9" onClick={() => navMonth(-1)}>
              <ChevronLeft className="size-5" />
            </Button>
            <div className="text-center">
              <h2 className="text-lg font-bold">{MONTHS[calMonth]} {calYear}</h2>
              <button type="button" onClick={goToday} className="text-xs text-primary hover:underline">Ir a hoy</button>
            </div>
            <Button variant="ghost" size="icon" className="size-9" onClick={() => navMonth(1)}>
              <ChevronRight className="size-5" />
            </Button>
          </div>

          {!calQ.isLoading && calDays.length > 0 && <MonthSummary days={calDays} />}

          {calQ.isLoading && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-foreground/40 animate-pulse">Cargando calendario...</p>
            </div>
          )}

          {calQ.isError && <p className="text-sm text-destructive py-8 text-center">Error al cargar el historial.</p>}

          {!calQ.isLoading && !calQ.isError && (
            <div className="flex gap-4 mt-3 items-start">
              {/* Grid */}
              <div className="flex-1 min-w-0">
                <div className="rounded-2xl border bg-card p-4 shadow-sm">
                  <CalendarGrid
                    year={calYear} month={calMonth} days={calDays}
                    onSelectDate={selectDate} selectedDate={selectedDate}
                    theme={theme}
                  />
                </div>
              </div>

              {/* Side panel with slide animation */}
              <div className={cn(
                "shrink-0 transition-all duration-300 ease-out overflow-hidden",
                selectedDate ? "w-[320px] opacity-100" : "w-0 opacity-0",
              )}>
                {selectedDay ? (
                  <DetailPanel
                    day={selectedDay}
                    onRegularize={setRegularizeDate}
                    onClose={() => setSelectedDate(null)}
                    theme={theme}
                    visible={panelVisible}
                  />
                ) : selectedDate ? (
                  <div className={cn(
                    "rounded-2xl border bg-muted/20 p-6 text-center flex flex-col items-center justify-center min-h-[300px] transition-all duration-300",
                    panelVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0",
                  )}>
                    <CalendarDays className="size-10 text-foreground/15" />
                    <p className="mt-3 text-sm font-medium text-foreground/40">Sin registro</p>
                    {selectedDate < today && (
                      <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setRegularizeDate(selectedDate)}>
                        <PenLineIcon className="size-4" /> Regularizar
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══════════ LIST ═══════════ */}
        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input id="dateFrom" type="date" value={listDateFrom} onChange={e => setListDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input id="dateTo" type="date" value={listDateTo} onChange={e => setListDateTo(e.target.value)} />
            </div>
          </div>

          {listQ.isLoading && <p className="text-sm text-foreground/40">Cargando historial...</p>}
          {listQ.isError && <p className="text-sm text-destructive">Error al cargar el historial.</p>}

          {!listQ.isLoading && !listQ.isError && (
            <div className="rounded-xl border overflow-hidden">
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
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listDays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-foreground/40 py-12">
                        No hay registros en el rango seleccionado
                      </TableCell>
                    </TableRow>
                  ) : listDays.map((day) => {
                    const canR = REGULARIZABLE.has(day.status) && day.date < today;
                    return (
                      <TableRow key={day.date} ref={el => { if (el) rowRefs.current.set(day.date, el); }}>
                        <TableCell className="font-medium">{day.date}</TableCell>
                        <TableCell>{day.firstInLocal ?? "--:--"}</TableCell>
                        <TableCell>{day.lastOutLocal ?? "--:--"}</TableCell>
                        <TableCell>{fmtMin(day.breakMinutes)}</TableCell>
                        <TableCell className="font-semibold">{day.workedHHMM ?? fmtMin(day.workedMinutes)}</TableCell>
                        <TableCell><StatusBadge status={day.status} /></TableCell>
                        <TableCell className="text-foreground/50">{day.reasonLabel ?? day.reasonCode ?? "-"}</TableCell>
                        <TableCell>
                          {canR && (
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setRegularizeDate(day.date)}>
                              <PenLineIcon className="size-3.5" /> Regularizar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                {listDays.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell /><TableCell />
                      <TableCell className="font-bold">{fmtMin(totalBreak)}</TableCell>
                      <TableCell className="font-bold">{fmtMin(totalWorked)}</TableCell>
                      <TableCell /><TableCell /><TableCell />
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
        onOpenChange={open => { if (!open) setRegularizeDate(null); }}
        workDate={regularizeDate ?? ""}
      />
    </div>
  );
}
