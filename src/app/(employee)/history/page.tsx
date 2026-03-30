"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useAttendanceHistory } from "@/hooks/use-attendance";
import { StatusBadge } from "@/components/attendance/status-badge";
import { RegularizeDialog } from "@/components/attendance/regularize-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  PenLineIcon, CalendarDays, List, ChevronLeft, ChevronRight, Clock,
  LogIn, LogOut, Coffee, TrendingUp, TrendingDown, AlertCircle, X,
  Sparkles, Cherry, Mountain, Flower2, Briefcase,
} from "lucide-react";

/* ── Helpers ──────────────────────────────────────────────────────── */

function getMonthRange(y: number, m: number) {
  const mm = String(m + 1).padStart(2, "0");
  const last = new Date(y, m + 1, 0).getDate();
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}
function fmtMin(min: number) {
  const h = Math.floor(Math.abs(min) / 60), m = Math.abs(min) % 60;
  return `${min < 0 ? "-" : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function shortT(t: string | null) { return !t ? "--:--" : t.length > 5 ? t.substring(0, 5) : t; }

const REG_OK = new Set(["MISSING", "NO_RECORD", "ABSENT", "SHORT", "INCOMPLETE"]);
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DH = ["LUN","MAR","MIE","JUE","VIE","SAB","DOM"];

interface HDay {
  date: string; firstInLocal: string | null; lastOutLocal: string | null;
  breakMinutes: number; workedMinutes: number; workedHHMM: string;
  status: string; reasonCode?: string; reasonLabel?: string; anomalies?: string[];
}

/* ── Theme System ─────────────────────────────────────────────────── */

type ThemeKey = "aurora" | "cerezo" | "obsidiana" | "lavanda" | "corporativo";

interface StatusColors { bg: string; dot: string; text: string; bar: string }

interface CalTheme {
  key: ThemeKey;
  name: string;
  desc: string;
  icon: typeof Sparkles;
  preview: string; // gradient for preview card
  headerGrad: string;
  // Cell shape & style
  cellBase: string;      // base cell classes
  cellHasData: (c: StatusColors) => string;
  cellEmpty: string;
  cellWeekend: string;
  cellSelected: string;
  cellToday: string;
  // Grid
  gap: string;
  gridBg: string;
  dayHeaderCls: string;
  // Status palette
  ok: StatusColors;
  open: StatusColors;
  short: StatusColors;
  reg: StatusColors;
  absent: StatusColors;
  none: StatusColors;
}

const THEMES: Record<ThemeKey, CalTheme> = {
  /* ─ 1. Aurora Boreal: rounded cards, teal palette, borders + fills ─ */
  aurora: {
    key: "aurora", name: "Aurora Boreal", desc: "Tarjetas redondeadas con bordes suaves",
    icon: Sparkles, preview: "from-teal-400 to-cyan-400", headerGrad: "from-teal-500 to-cyan-500",
    cellBase: "rounded-xl border p-2 min-h-[76px] flex flex-col text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
    cellHasData: (c) => `${c.bg} border-current/20`,
    cellEmpty: "bg-background border-border/30",
    cellWeekend: "bg-gray-50/50 border-border/20",
    cellSelected: "ring-2 ring-primary shadow-xl -translate-y-1 z-10",
    cellToday: "ring-2 ring-primary/40",
    gap: "gap-1.5", gridBg: "rounded-2xl border bg-card p-4 shadow-sm",
    dayHeaderCls: "text-xs font-bold uppercase tracking-wider",
    ok:     { bg: "bg-teal-50",    dot: "bg-teal-500",    text: "text-teal-700",    bar: "bg-teal-500" },
    open:   { bg: "bg-cyan-50",    dot: "bg-cyan-500",    text: "text-cyan-700",    bar: "bg-cyan-500" },
    short:  { bg: "bg-amber-50",   dot: "bg-amber-500",   text: "text-amber-700",   bar: "bg-amber-500" },
    reg:    { bg: "bg-indigo-50",  dot: "bg-indigo-500",  text: "text-indigo-700",  bar: "bg-indigo-500" },
    absent: { bg: "bg-rose-50",    dot: "bg-rose-500",    text: "text-rose-700",    bar: "bg-rose-500" },
    none:   { bg: "bg-slate-50/50",dot: "bg-slate-300",   text: "text-slate-400",   bar: "bg-slate-300" },
  },
  /* ─ 2. Flor de Cerezo: circles, borderless, floaty pink ─ */
  cerezo: {
    key: "cerezo", name: "Flor de Cerezo", desc: "Circulos flotantes sin bordes",
    icon: Cherry, preview: "from-pink-400 to-fuchsia-400", headerGrad: "from-pink-500 to-fuchsia-500",
    cellBase: "rounded-full aspect-square flex flex-col items-center justify-center text-center transition-all duration-200 hover:shadow-xl hover:scale-105 border-0",
    cellHasData: (c) => `${c.bg} shadow-md`,
    cellEmpty: "bg-transparent",
    cellWeekend: "bg-pink-50/30",
    cellSelected: "ring-2 ring-pink-500 shadow-2xl scale-110 z-10",
    cellToday: "ring-2 ring-pink-400/50",
    gap: "gap-2", gridBg: "rounded-3xl bg-gradient-to-br from-pink-50/50 to-fuchsia-50/30 p-5",
    dayHeaderCls: "text-[10px] font-semibold uppercase text-pink-400 tracking-widest",
    ok:     { bg: "bg-pink-100",    dot: "bg-pink-500",    text: "text-pink-700",    bar: "bg-pink-500" },
    open:   { bg: "bg-fuchsia-100", dot: "bg-fuchsia-500", text: "text-fuchsia-700", bar: "bg-fuchsia-500" },
    short:  { bg: "bg-amber-100",   dot: "bg-amber-500",   text: "text-amber-700",   bar: "bg-amber-500" },
    reg:    { bg: "bg-violet-100",  dot: "bg-violet-500",  text: "text-violet-700",  bar: "bg-violet-500" },
    absent: { bg: "bg-red-100",     dot: "bg-red-400",     text: "text-red-600",     bar: "bg-red-400" },
    none:   { bg: "bg-pink-50/50",  dot: "bg-gray-300",    text: "text-gray-400",    bar: "bg-gray-300" },
  },
  /* ─ 3. Obsidiana: square cells, left accent bar, sharp edges ─ */
  obsidiana: {
    key: "obsidiana", name: "Obsidiana", desc: "Celdas cuadradas con barra lateral",
    icon: Mountain, preview: "from-zinc-600 to-zinc-800", headerGrad: "from-zinc-700 to-zinc-900",
    cellBase: "rounded-none border-l-4 border-y border-r border-y-border/20 border-r-border/20 p-2 min-h-[76px] flex flex-col text-left transition-all duration-150 hover:bg-muted/50",
    cellHasData: (c) => `bg-background ${c.bg.replace("bg-", "border-l-")}`,
    cellEmpty: "bg-background border-l-transparent",
    cellWeekend: "bg-zinc-50/50 border-l-zinc-200",
    cellSelected: "!bg-zinc-100 ring-1 ring-zinc-400 z-10",
    cellToday: "!border-l-primary border-l-4",
    gap: "gap-0", gridBg: "rounded-lg border border-zinc-200 bg-card overflow-hidden",
    dayHeaderCls: "text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 bg-zinc-100 py-2",
    ok:     { bg: "bg-emerald-500", dot: "bg-emerald-500", text: "text-emerald-700", bar: "bg-emerald-500" },
    open:   { bg: "bg-blue-500",    dot: "bg-blue-500",    text: "text-blue-700",    bar: "bg-blue-500" },
    short:  { bg: "bg-orange-500",  dot: "bg-orange-500",  text: "text-orange-700",  bar: "bg-orange-500" },
    reg:    { bg: "bg-purple-500",  dot: "bg-purple-500",  text: "text-purple-700",  bar: "bg-purple-500" },
    absent: { bg: "bg-red-500",     dot: "bg-red-500",     text: "text-red-700",     bar: "bg-red-500" },
    none:   { bg: "bg-zinc-200",    dot: "bg-zinc-300",    text: "text-zinc-400",    bar: "bg-zinc-300" },
  },
  /* ─ 4. Jardin Lavanda: pill-shaped cells, no grid, soft shadows ─ */
  lavanda: {
    key: "lavanda", name: "Jardin Lavanda", desc: "Pastillas suaves con sombras flotantes",
    icon: Flower2, preview: "from-violet-400 to-purple-400", headerGrad: "from-violet-400 to-purple-500",
    cellBase: "rounded-2xl p-2 min-h-[72px] flex flex-col text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-0",
    cellHasData: (c) => `${c.bg} shadow-sm`,
    cellEmpty: "bg-transparent",
    cellWeekend: "bg-violet-50/20",
    cellSelected: "ring-2 ring-violet-500 shadow-xl -translate-y-1 z-10",
    cellToday: "ring-2 ring-violet-400/40 shadow-md",
    gap: "gap-2", gridBg: "rounded-3xl bg-gradient-to-b from-violet-50/40 to-purple-50/20 p-5",
    dayHeaderCls: "text-[10px] font-bold uppercase text-violet-400 tracking-widest",
    ok:     { bg: "bg-lime-50",    dot: "bg-lime-500",    text: "text-lime-700",    bar: "bg-lime-500" },
    open:   { bg: "bg-sky-50",     dot: "bg-sky-500",     text: "text-sky-700",     bar: "bg-sky-500" },
    short:  { bg: "bg-yellow-50",  dot: "bg-yellow-500",  text: "text-yellow-700",  bar: "bg-yellow-500" },
    reg:    { bg: "bg-purple-100", dot: "bg-purple-500",  text: "text-purple-700",  bar: "bg-purple-500" },
    absent: { bg: "bg-orange-50",  dot: "bg-orange-500",  text: "text-orange-700",  bar: "bg-orange-500" },
    none:   { bg: "bg-violet-50/40",dot:"bg-gray-300",    text: "text-gray-400",    bar: "bg-gray-300" },
  },
  /* ─ 5. Corporativo: clean office style, blue/gray, thin borders, no color fills ─ */
  corporativo: {
    key: "corporativo", name: "Corporativo", desc: "Limpio y profesional, estilo Office",
    icon: Briefcase, preview: "from-blue-600 to-slate-700", headerGrad: "from-blue-700 to-slate-800",
    cellBase: "rounded-md border border-slate-200 p-2 min-h-[76px] flex flex-col text-left transition-all duration-100 hover:bg-blue-50/50",
    cellHasData: (_c) => "bg-white border-slate-200",
    cellEmpty: "bg-white border-slate-100",
    cellWeekend: "bg-slate-50 border-slate-100",
    cellSelected: "!bg-blue-50 ring-1 ring-blue-500 z-10 border-blue-300",
    cellToday: "border-blue-400 border-2",
    gap: "gap-px", gridBg: "rounded-lg border border-slate-200 bg-slate-100 p-px overflow-hidden",
    dayHeaderCls: "text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 py-2",
    ok:     { bg: "bg-white", dot: "bg-blue-600",    text: "text-slate-700",  bar: "bg-blue-600" },
    open:   { bg: "bg-white", dot: "bg-blue-400",    text: "text-blue-700",   bar: "bg-blue-400" },
    short:  { bg: "bg-white", dot: "bg-amber-500",   text: "text-amber-700",  bar: "bg-amber-500" },
    reg:    { bg: "bg-white", dot: "bg-slate-500",   text: "text-slate-600",  bar: "bg-slate-500" },
    absent: { bg: "bg-white", dot: "bg-red-500",     text: "text-red-600",    bar: "bg-red-500" },
    none:   { bg: "bg-white", dot: "bg-slate-200",   text: "text-slate-300",  bar: "bg-slate-200" },
  },
};

function getS(t: CalTheme, s: string | undefined): StatusColors {
  switch (s) {
    case "OK": case "CLOSED": return t.ok;
    case "OPEN": return t.open;
    case "SHORT": case "INCOMPLETE": return t.short;
    case "REGULARIZED": return t.reg;
    case "ABSENCE": case "ABSENT": return t.absent;
    default: return t.none;
  }
}

/* ── Calendar Cell ────────────────────────────────────────────────── */

function Cell({
  day, dateStr, data, isToday, isSel, isWknd, onClick, t,
}: {
  day: number | null; dateStr: string | null; data?: HDay;
  isToday: boolean; isSel: boolean; isWknd: boolean;
  onClick: () => void; t: CalTheme;
}) {
  if (!day) return <div className={t.key === "cerezo" ? "aspect-square" : "min-h-[76px]"} />;
  const c = getS(t, data?.status);
  const has = !!data;
  const isCircle = t.key === "cerezo";

  return (
    <button
      type="button" onClick={onClick}
      className={cn(
        t.cellBase,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        has ? t.cellHasData(c) : isWknd ? t.cellWeekend : t.cellEmpty,
        isSel && t.cellSelected,
        isToday && !isSel && t.cellToday,
      )}
    >
      {isCircle ? (
        /* Circle layout: number centered, dot below */
        <>
          <span className={cn("text-base font-black leading-none", isToday && "text-primary", has ? c.text : "text-foreground/40")}>
            {day}
          </span>
          {has && <span className={cn("size-1.5 rounded-full mt-0.5", c.dot)} />}
          {isToday && <span className="text-[6px] font-bold text-primary uppercase mt-0.5">hoy</span>}
        </>
      ) : (
        /* Card layouts: top row + bottom info */
        <>
          <div className="flex items-center justify-between w-full">
            <span className={cn("text-sm font-bold", isToday && "text-primary", has ? c.text : isWknd ? "text-foreground/25" : "text-foreground/50")}>
              {day}
            </span>
            <div className="flex items-center gap-1">
              {has && <span className={cn("size-2.5 rounded-full", c.dot)} />}
              {isToday && <span className="rounded bg-primary px-1 py-px text-[7px] font-bold text-primary-foreground uppercase">hoy</span>}
            </div>
          </div>
          {has && data ? (
            <div className="mt-auto space-y-0.5 w-full">
              <div className="text-[11px] text-foreground/45 tabular-nums">{shortT(data.firstInLocal)} - {shortT(data.lastOutLocal)}</div>
              <div className={cn("text-xs font-extrabold tabular-nums", c.text)}>{data.workedHHMM || fmtMin(data.workedMinutes)}</div>
            </div>
          ) : !isWknd ? (
            <div className="mt-auto"><span className="text-[11px] text-foreground/15">--:--</span></div>
          ) : null}
        </>
      )}
    </button>
  );
}

/* ── Calendar Grid ────────────────────────────────────────────────── */

function CalGrid({
  year, month, days, onSelect, sel, t,
}: {
  year: number; month: number; days: HDay[];
  onSelect: (d: string) => void; sel: string | null; t: CalTheme;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const map = useMemo(() => { const m = new Map<string, HDay>(); for (const d of days) m.set(d.date, d); return m; }, [days]);
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const total = new Date(year, month + 1, 0).getDate();
    let s = first.getDay() - 1; if (s < 0) s = 6;
    const r: Array<{ day: number | null; ds: string | null; wk: boolean }> = [];
    for (let i = 0; i < s; i++) r.push({ day: null, ds: null, wk: false });
    for (let d = 1; d <= total; d++) {
      const mm = String(month + 1).padStart(2, "0"); const dd = String(d).padStart(2, "0");
      const dow = new Date(year, month, d).getDay();
      r.push({ day: d, ds: `${year}-${mm}-${dd}`, wk: dow === 0 || dow === 6 });
    }
    while (r.length % 7) r.push({ day: null, ds: null, wk: false });
    return r;
  }, [year, month]);

  const legend = [
    { l: "Completo", c: t.ok.dot }, { l: "En curso", c: t.open.dot },
    { l: "Incompleto", c: t.short.dot }, { l: "Regularizado", c: t.reg.dot },
    { l: "Ausencia", c: t.absent.dot }, { l: "Sin registro", c: t.none.dot },
  ];

  return (
    <div className={t.gridBg}>
      <div className={cn("grid grid-cols-7", t.gap, "mb-1")}>
        {DH.map((n, i) => (
          <div key={n} className={cn("py-2 text-center", t.dayHeaderCls, i >= 5 && "opacity-50")}>{n}</div>
        ))}
      </div>
      <div className={cn("grid grid-cols-7", t.gap)}>
        {cells.map((c, i) => (
          <Cell key={c.ds || `b${i}`} day={c.day} dateStr={c.ds} data={c.ds ? map.get(c.ds) : undefined}
            isToday={c.ds === todayStr} isSel={c.ds === sel} isWknd={c.wk}
            onClick={() => c.ds && onSelect(c.ds)} t={t} />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4">
        {legend.map(it => (
          <div key={it.l} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", it.c)} />
            <span className="text-[11px] text-foreground/50">{it.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Theme Selector (visual cards) ────────────────────────────────── */

function ThemeSelector({ current, onChange }: { current: ThemeKey; onChange: (k: ThemeKey) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm hover:shadow-md transition-all"
      >
        <div className={cn("size-5 rounded-full bg-gradient-to-br", THEMES[current].preview)} />
        <span className="text-sm font-semibold">{THEMES[current].name}</span>
        <ChevronRight className={cn("size-3.5 text-foreground/40 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-72 rounded-2xl border bg-background shadow-2xl p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/40 px-1">Elige un estilo</p>
            {(Object.keys(THEMES) as ThemeKey[]).map(k => {
              const t = THEMES[k];
              const Icon = t.icon;
              const active = current === k;
              return (
                <button key={k} onClick={() => { onChange(k); setOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-xl p-3 transition-all text-left",
                    active ? "bg-gradient-to-r text-white shadow-lg " + t.preview : "hover:bg-muted border border-transparent hover:border-border",
                  )}>
                  <div className={cn(
                    "flex size-10 items-center justify-center rounded-xl shrink-0",
                    active ? "bg-white/20" : "bg-gradient-to-br " + t.preview,
                  )}>
                    <Icon className={cn("size-5", active ? "text-white" : "text-white")} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("text-sm font-bold", !active && "text-foreground")}>{t.name}</p>
                    <p className={cn("text-[11px] truncate", active ? "text-white/70" : "text-foreground/50")}>{t.desc}</p>
                  </div>
                  {active && <span className="ml-auto text-white text-lg">&#10003;</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Detail Panel ─────────────────────────────────────────────────── */

function DetailPanel({
  day, onReg, onClose, t, vis,
}: { day: HDay; onReg: (d: string) => void; onClose: () => void; t: CalTheme; vis: boolean }) {
  const today = new Date().toISOString().split("T")[0];
  const canR = REG_OK.has(day.status) && day.date < today;
  const delta = day.workedMinutes - 480;
  const pct = Math.min(Math.round((day.workedMinutes / 480) * 100), 100);
  const d = new Date(day.date + "T12:00:00");
  const dn = d.toLocaleDateString("es-PE", { weekday: "long" });
  const dm = d.getDate(), mn = d.toLocaleDateString("es-PE", { month: "long" });
  const corp = t.key === "corporativo";

  return (
    <div className={cn(
      "flex flex-col border bg-background shadow-2xl overflow-hidden transition-all duration-300 ease-out",
      corp ? "rounded-lg" : "rounded-2xl",
      vis ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0",
    )}>
      {/* Header */}
      <div className={cn(
        "relative px-5 py-4",
        corp ? "bg-slate-800 text-white" : cn("text-white bg-gradient-to-r", t.headerGrad),
      )}>
        <button onClick={onClose} className={cn(
          "absolute top-3 right-3 rounded-full p-1.5 transition-colors",
          corp ? "bg-slate-700 hover:bg-slate-600" : "bg-white/20 hover:bg-white/30",
        )}>
          <X className="size-4" />
        </button>
        <p className={cn("text-sm font-medium capitalize", corp ? "text-slate-300" : "opacity-80")}>{dn}</p>
        <p className="text-3xl font-black tracking-tight">{dm} <span className="text-lg font-semibold capitalize">{mn}</span></p>
        <div className="mt-2"><StatusBadge status={day.status} /></div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4 flex-1">
        {corp ? (
          /* ── Corporativo: monochrome table-style rows ── */
          <>
            <div className="divide-y border rounded-lg overflow-hidden">
              <CorpRow label="Entrada" value={shortT(day.firstInLocal)} icon={LogIn} />
              <CorpRow label="Salida" value={shortT(day.lastOutLocal)} icon={LogOut} />
              <CorpRow label="Break" value={`${day.breakMinutes} min`} icon={Coffee} />
              <CorpRow label="Trabajado" value={day.workedHHMM || fmtMin(day.workedMinutes)} icon={Clock} bold />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-medium">Progreso</span>
                <span className="font-bold text-slate-700">{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {delta >= 0 ? <TrendingUp className="size-4 text-blue-600" /> : <TrendingDown className="size-4 text-slate-500" />}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Balance del dia</p>
                <p className={cn("text-base font-black", delta >= 0 ? "text-blue-700" : "text-slate-700")}>
                  {delta >= 0 ? "+" : ""}{fmtMin(delta)}
                </p>
              </div>
            </div>
          </>
        ) : (
          /* ── Other themes: colorful cards ── */
          <>
            <div className="grid grid-cols-2 gap-3">
              <ICard icon={LogIn} label="Entrada" value={shortT(day.firstInLocal)} color="text-emerald-600" bg="bg-emerald-50" b="border-emerald-100" />
              <ICard icon={LogOut} label="Salida" value={shortT(day.lastOutLocal)} color="text-red-500" bg="bg-red-50" b="border-red-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ICard icon={Coffee} label="Break" value={`${day.breakMinutes} min`} color="text-amber-600" bg="bg-amber-50" b="border-amber-100" />
              <ICard icon={Clock} label="Trabajado" value={day.workedHHMM || fmtMin(day.workedMinutes)} color="text-blue-600" bg="bg-blue-50" b="border-blue-100" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-foreground/50 font-medium">Progreso</span>
                <span className="font-bold">{pct}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-500",
                  pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400"
                )} style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className={cn("flex items-center gap-3 rounded-xl p-3.5 border",
              delta >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100")}>
              {delta >= 0 ? <TrendingUp className="size-5 text-emerald-600" /> : <TrendingDown className="size-5 text-red-500" />}
              <div>
                <p className="text-xs font-semibold text-foreground/50 uppercase">Balance</p>
                <p className={cn("text-base font-black", delta >= 0 ? "text-emerald-700" : "text-red-600")}>{delta >= 0 ? "+" : ""}{fmtMin(delta)}</p>
              </div>
            </div>
          </>
        )}

        {(day.reasonLabel || day.reasonCode) && (
          <div className={cn(
            "flex items-start gap-2.5 p-3 border",
            corp ? "rounded-lg bg-slate-50 border-slate-200" : "rounded-xl bg-muted/50 border-border/50",
          )}>
            <AlertCircle className={cn("size-4 mt-0.5 shrink-0", corp ? "text-slate-400" : "text-foreground/40")} />
            <div>
              <p className={cn("text-xs font-bold uppercase", corp ? "text-slate-400" : "text-foreground/50")}>Motivo</p>
              <p className="text-sm">{day.reasonLabel ?? day.reasonCode}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-4 flex gap-2 mt-auto">
        {canR && <Button size="sm" className="flex-1 gap-1.5" onClick={() => onReg(day.date)}><PenLineIcon className="size-4" /> Regularizar</Button>}
        <Button variant="outline" size="sm" className={canR ? "" : "flex-1"} onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

/* Corporativo row for detail panel */
function CorpRow({ label, value, icon: Icon, bold }: { label: string; value: string; icon: typeof Clock; bold?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 bg-white">
      <Icon className="size-4 text-slate-400 shrink-0" />
      <span className="text-xs font-medium text-slate-500 w-20">{label}</span>
      <span className={cn("text-base tabular-nums ml-auto", bold ? "font-black text-slate-800" : "font-semibold text-slate-700")}>{value}</span>
    </div>
  );
}

/* Colorful card for non-corp themes */
function ICard({ icon: Icon, label, value, color, bg, b }: {
  icon: typeof Clock; label: string; value: string; color: string; bg: string; b: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 border", bg, b)}>
      <div className="flex items-center gap-1.5 mb-1"><Icon className={cn("size-3.5", color)} /><span className={cn("text-[11px] font-bold uppercase", color)}>{label}</span></div>
      <p className="text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}

/* ── Month Summary ────────────────────────────────────────────────── */

function MSummary({ days }: { days: HDay[] }) {
  const w = days.reduce((a, d) => a + (d.workedMinutes ?? 0), 0);
  const p = days.filter(d => { const dw = new Date(d.date + "T12:00:00").getDay(); return dw !== 0 && dw !== 6; }).length * 480;
  const dt = w - p, ok = days.filter(d => ["OK","CLOSED","REGULARIZED"].includes(d.status)).length;
  const ms = days.filter(d => ["MISSING","NO_RECORD"].includes(d.status)).length;
  return (
    <div className="grid grid-cols-4 gap-2">
      {[{ l:"Trabajado", v:fmtMin(w), c:"text-blue-600" }, { l:"Balance", v:`${dt>=0?"+":""}${fmtMin(dt)}`, c:dt>=0?"text-emerald-600":"text-red-500" },
        { l:"Completos", v:`${ok}`, c:"text-emerald-600" }, { l:"Sin registro", v:`${ms}`, c:ms>0?"text-amber-600":"text-foreground/30" }
      ].map(it => (
        <div key={it.l} className="rounded-xl bg-muted/50 px-3 py-2 text-center border border-border/30">
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">{it.l}</p>
          <p className={cn("text-base font-black tabular-nums", it.c)}>{it.v}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────── */

export default function HistoryPage() {
  const now = new Date();
  const [cy, setCy] = useState(now.getFullYear());
  const [cm, setCm] = useState(now.getMonth());
  const [sel, setSel] = useState<string | null>(null);
  const [pVis, setPVis] = useState(false);
  const [tk, setTk] = useState<ThemeKey>("aurora");
  const t = THEMES[tk];

  const { from: df, to: dt } = useMemo(() => getMonthRange(cy, cm), [cy, cm]);
  const [lf, setLf] = useState(df); const [lt, setLt] = useState(dt);
  const [tab, setTab] = useState<string | number>("calendar");
  const [regDate, setRegDate] = useState<string | null>(null);

  const cQ = useAttendanceHistory(df, dt); const lQ = useAttendanceHistory(lf, lt);
  const cDays = (cQ.data?.days ?? []) as HDay[]; const lDays = (lQ.data?.days ?? []) as HDay[];
  const tw = lDays.reduce((a, d) => a + (d.workedMinutes ?? 0), 0);
  const tb = lDays.reduce((a, d) => a + (d.breakMinutes ?? 0), 0);
  const today = new Date().toISOString().split("T")[0];
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    if (sel) { setPVis(false); const t = setTimeout(() => setPVis(true), 60); return () => clearTimeout(t); }
    else setPVis(false);
  }, [sel]);

  const nav = useCallback((d: number) => {
    let nm = cm + d, ny = cy;
    if (nm < 0) { nm = 11; ny--; } else if (nm > 11) { nm = 0; ny++; }
    setCm(nm); setCy(ny); setSel(null);
  }, [cm, cy]);

  const selDay = useMemo(() => sel ? cDays.find(d => d.date === sel) : undefined, [sel, cDays]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historial de Asistencia</h1>
          <p className="text-sm text-muted-foreground">Revisa tu historial de marcaciones</p>
        </div>
        <ThemeSelector current={tk} onChange={setTk} />
      </div>

      <Tabs defaultValue="calendar" value={tab} onValueChange={v => { if (v) setTab(v); }}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5"><CalendarDays className="size-4" /> Calendario</TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5"><List className="size-4" /> Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="size-9" onClick={() => nav(-1)}><ChevronLeft className="size-5" /></Button>
            <div className="text-center">
              <h2 className="text-lg font-bold">{MONTHS[cm]} {cy}</h2>
              <button type="button" onClick={() => { setCy(now.getFullYear()); setCm(now.getMonth()); setSel(today); }}
                className="text-xs text-primary hover:underline">Ir a hoy</button>
            </div>
            <Button variant="ghost" size="icon" className="size-9" onClick={() => nav(1)}><ChevronRight className="size-5" /></Button>
          </div>

          {!cQ.isLoading && cDays.length > 0 && <MSummary days={cDays} />}
          {cQ.isLoading && <div className="flex items-center justify-center py-20"><p className="text-sm text-foreground/40 animate-pulse">Cargando...</p></div>}
          {cQ.isError && <p className="text-sm text-destructive py-8 text-center">Error al cargar.</p>}

          {!cQ.isLoading && !cQ.isError && (
            <div className="flex gap-4 mt-3 items-start">
              <div className="flex-1 min-w-0">
                <CalGrid year={cy} month={cm} days={cDays} onSelect={d => setSel(p => p === d ? null : d)} sel={sel} t={t} />
              </div>
              <div className={cn("shrink-0 transition-all duration-300 ease-out overflow-hidden", sel ? "w-[320px] opacity-100" : "w-0 opacity-0")}>
                {selDay ? (
                  <DetailPanel day={selDay} onReg={setRegDate} onClose={() => setSel(null)} t={t} vis={pVis} />
                ) : sel ? (
                  <div className={cn("rounded-2xl border bg-muted/20 p-6 text-center flex flex-col items-center justify-center min-h-[300px] transition-all duration-300",
                    pVis ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0")}>
                    <CalendarDays className="size-10 text-foreground/15" />
                    <p className="mt-3 text-sm font-medium text-foreground/40">Sin registro</p>
                    {sel < today && <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => setRegDate(sel)}><PenLineIcon className="size-4" /> Regularizar</Button>}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5"><Label htmlFor="df">Desde</Label><Input id="df" type="date" value={lf} onChange={e => setLf(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="dt">Hasta</Label><Input id="dt" type="date" value={lt} onChange={e => setLt(e.target.value)} /></div>
          </div>
          {lQ.isLoading && <p className="text-sm text-foreground/40">Cargando...</p>}
          {lQ.isError && <p className="text-sm text-destructive">Error al cargar.</p>}
          {!lQ.isLoading && !lQ.isError && (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Entrada</TableHead><TableHead>Salida</TableHead>
                  <TableHead>Break</TableHead><TableHead>Trabajo</TableHead><TableHead>Estado</TableHead>
                  <TableHead>Razon</TableHead><TableHead className="w-[90px]" />
                </TableRow></TableHeader>
                <TableBody>
                  {lDays.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-foreground/40 py-12">Sin registros</TableCell></TableRow>
                  ) : lDays.map(d => {
                    const cr = REG_OK.has(d.status) && d.date < today;
                    return (<TableRow key={d.date} ref={el => { if (el) rowRefs.current.set(d.date, el); }}>
                      <TableCell className="font-medium">{d.date}</TableCell>
                      <TableCell>{d.firstInLocal ?? "--:--"}</TableCell><TableCell>{d.lastOutLocal ?? "--:--"}</TableCell>
                      <TableCell>{fmtMin(d.breakMinutes)}</TableCell>
                      <TableCell className="font-semibold">{d.workedHHMM ?? fmtMin(d.workedMinutes)}</TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell className="text-foreground/50">{d.reasonLabel ?? d.reasonCode ?? "-"}</TableCell>
                      <TableCell>{cr && <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setRegDate(d.date)}><PenLineIcon className="size-3.5" /> Regularizar</Button>}</TableCell>
                    </TableRow>);
                  })}
                </TableBody>
                {lDays.length > 0 && <TableFooter><TableRow>
                  <TableCell className="font-bold">Total</TableCell><TableCell /><TableCell />
                  <TableCell className="font-bold">{fmtMin(tb)}</TableCell><TableCell className="font-bold">{fmtMin(tw)}</TableCell>
                  <TableCell /><TableCell /><TableCell />
                </TableRow></TableFooter>}
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RegularizeDialog open={regDate !== null} onOpenChange={o => { if (!o) setRegDate(null); }} workDate={regDate ?? ""} />
    </div>
  );
}
