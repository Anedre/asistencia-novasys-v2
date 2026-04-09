"use client";

/**
 * Four chart components for the Reports dashboard.
 * All rely on recharts (v3) for interactivity/animations out of the box,
 * plus a hand-rolled heatmap because recharts doesn't ship one.
 */

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  MonthlyTrendPoint,
  EmployeeRankingEntry,
  StatusDistribution,
} from "@/lib/services/reports-stats.service";

/* ─────────────────────────────────────────────────────────── helpers ── */

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

function monthLabel(ym: string): string {
  try {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
  } catch {
    return ym;
  }
}

/* ─────────────────────────────────────────────── MonthlyTrendChart ── */

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  const pretty = data.map((d) => ({
    ...d,
    label: monthLabel(d.month),
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Tendencia mensual</CardTitle>
        <p className="text-xs text-muted-foreground">
          Horas trabajadas vs. planeadas por mes
        </p>
      </CardHeader>
      <CardContent>
        {pretty.length === 0 ? (
          <EmptyChartState />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pretty} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="workedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="plannedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} />
                <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    `${value}h`,
                    name === "workedHours" ? "Trabajadas" : "Planeadas",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(v) => (v === "workedHours" ? "Trabajadas" : "Planeadas")}
                />
                <Area
                  type="monotone"
                  dataKey="plannedHours"
                  stroke="#6366f1"
                  fill="url(#plannedGrad)"
                  strokeWidth={2}
                  animationDuration={900}
                />
                <Area
                  type="monotone"
                  dataKey="workedHours"
                  stroke="#10b981"
                  fill="url(#workedGrad)"
                  strokeWidth={2}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────── EmployeeRankingChart ── */

export function EmployeeRankingChart({
  data,
}: {
  data: EmployeeRankingEntry[];
}) {
  // Keep top 10 so the chart stays readable
  const top = data.slice(0, 10).map((e) => ({
    ...e,
    shortName:
      e.employeeName.length > 18
        ? `${e.employeeName.slice(0, 16)}…`
        : e.employeeName,
  }));

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Ranking por horas trabajadas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Top 10 del periodo seleccionado
        </p>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <EmptyChartState />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ top: 5, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} />
                <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={110}
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    `${value}h`,
                    name === "workedHours" ? "Trabajadas" : String(name),
                  ]}
                  labelFormatter={(label, payload) =>
                    payload?.[0]?.payload?.employeeName ?? label
                  }
                />
                <Bar
                  dataKey="workedHours"
                  fill="#0ea5e9"
                  radius={[0, 6, 6, 0]}
                  animationDuration={900}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────────────────── StatusDistributionChart ── */

export function StatusDistributionChart({
  data,
}: {
  data: StatusDistribution;
}) {
  const entries = Object.entries(data).map(([status, count]) => ({
    status,
    count,
    color: STATUS_COLORS[status] ?? "#64748b",
  }));
  const total = entries.reduce((s, e) => s + e.count, 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Distribución de estados</CardTitle>
        <p className="text-xs text-muted-foreground">
          {total} días registrados en total
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <EmptyChartState />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={entries}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  animationDuration={900}
                >
                  {entries.map((e) => (
                    <Cell key={e.status} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [
                    `${value} días`,
                    String(name),
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────── EntryHeatmap ── */

export function EntryHeatmapChart({
  matrix,
}: {
  /** matrix[dayOfWeek 0-6 Mon..Sun][hour 0-23] */
  matrix: number[][];
}) {
  // Compact the hour range to the active window to keep cells large.
  const firstHour = 6;
  const lastHour = 20;
  const hours = Array.from(
    { length: lastHour - firstHour + 1 },
    (_, i) => firstHour + i
  );
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Find the max to normalize cell intensity.
  let max = 0;
  for (const row of matrix) {
    for (let h = firstHour; h <= lastHour; h++) {
      if (row[h] > max) max = row[h];
    }
  }

  const hasData = max > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Patrón de entradas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Día de la semana vs. hora de marcación
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyChartState />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {/* Header: hours */}
              <div
                className="grid gap-0.5"
                style={{
                  gridTemplateColumns: `42px repeat(${hours.length}, minmax(22px, 1fr))`,
                }}
              >
                <div />
                {hours.map((h) => (
                  <div
                    key={h}
                    className="text-center text-[9px] text-muted-foreground py-1"
                  >
                    {h}h
                  </div>
                ))}
              </div>

              {/* Rows: one per day */}
              {days.map((d, dow) => (
                <div
                  key={d}
                  className="grid gap-0.5 mt-0.5"
                  style={{
                    gridTemplateColumns: `42px repeat(${hours.length}, minmax(22px, 1fr))`,
                  }}
                >
                  <div className="text-[10px] font-medium text-muted-foreground py-1.5 pl-1">
                    {d}
                  </div>
                  {hours.map((h) => {
                    const v = matrix[dow]?.[h] ?? 0;
                    const intensity = max > 0 ? v / max : 0;
                    return (
                      <div
                        key={h}
                        title={`${d} ${h}:00 — ${v} marcación${v === 1 ? "" : "es"}`}
                        className={cn(
                          "aspect-square rounded-sm transition-all",
                          v > 0 && "hover:scale-110 hover:ring-2 hover:ring-sky-400"
                        )}
                        style={{
                          background:
                            v === 0
                              ? "hsl(var(--muted) / 0.4)"
                              : `rgba(14, 165, 233, ${0.15 + intensity * 0.85})`,
                        }}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Legend */}
              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Menos</span>
                {[0, 0.25, 0.5, 0.75, 1].map((i) => (
                  <div
                    key={i}
                    className="h-2.5 w-5 rounded-sm"
                    style={{
                      background:
                        i === 0
                          ? "hsl(var(--muted) / 0.4)"
                          : `rgba(14, 165, 233, ${0.15 + i * 0.85})`,
                    }}
                  />
                ))}
                <span>Más</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────────────────────── shared empty state ── */

function EmptyChartState() {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      Sin datos para el periodo seleccionado
    </div>
  );
}
