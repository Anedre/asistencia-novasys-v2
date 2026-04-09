"use client";

/**
 * Reports Dashboard tab — historical charts with filters.
 * Auto-refreshes every 60s via react-query.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdminEmployees } from "@/hooks/use-employee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Clock,
  TrendingUp,
  UserCheck,
  UserX,
  PenLine,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  MonthlyTrendChart,
  EmployeeRankingChart,
  StatusDistributionChart,
  EntryHeatmapChart,
} from "./ReportsCharts";
import type { ReportsStats } from "@/lib/services/reports-stats.service";
import { cn } from "@/lib/utils";

type RangePreset = "1m" | "3m" | "6m" | "12m" | "custom";

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

function presetRange(preset: RangePreset): { from: string; to: string } {
  const today = new Date();
  const to = toYmd(today);
  const monthsBack: Record<Exclude<RangePreset, "custom">, number> = {
    "1m": -1,
    "3m": -3,
    "6m": -6,
    "12m": -12,
  };
  const from = toYmd(shiftMonths(today, monthsBack[preset as "1m"] ?? -3));
  return { from, to };
}

export function DashboardTab() {
  const [preset, setPreset] = useState<RangePreset>("3m");
  const [customFrom, setCustomFrom] = useState(() => presetRange("3m").from);
  const [customTo, setCustomTo] = useState(() => presetRange("3m").to);
  const [area, setArea] = useState<string>("all");

  const { data: empData } = useAdminEmployees();
  const areas = useMemo(() => {
    const s = new Set<string>();
    (empData?.employees ?? []).forEach((e) => e.area && s.add(e.area));
    return Array.from(s).sort();
  }, [empData]);

  const range =
    preset === "custom"
      ? { from: customFrom, to: customTo }
      : presetRange(preset);

  const { data, isLoading, isRefetching, error, refetch } = useQuery<ReportsStats>({
    queryKey: ["admin", "reports", "stats", range.from, range.to, area],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
      });
      if (area !== "all") params.set("area", area);
      const res = await fetch(`/api/admin/reports/stats?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: 60_000, // 1 min real-time refresh
    refetchOnWindowFocus: true,
  });

  return (
    <div className="space-y-4">
      {/* ── Filter bar ── */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Rango</Label>
            <div className="flex items-center rounded-md border p-0.5">
              {(["1m", "3m", "6m", "12m", "custom"] as RangePreset[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={preset === p ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPreset(p)}
                >
                  {p === "custom"
                    ? "Custom"
                    : p === "1m"
                    ? "1 mes"
                    : p === "3m"
                    ? "3 meses"
                    : p === "6m"
                    ? "6 meses"
                    : "12 meses"}
                </Button>
              ))}
            </div>
          </div>

          {preset === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="from" className="text-xs">
                  Desde
                </Label>
                <Input
                  id="from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to" className="text-xs">
                  Hasta
                </Label>
                <Input
                  id="to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Área</Label>
            <Select value={area} onValueChange={(v) => setArea(v ?? "all")}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9"
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-1.5", isRefetching && "animate-spin")}
            />
            {isRefetching ? "Actualizando…" : "Refrescar"}
          </Button>
        </CardContent>
      </Card>

      {/* ── KPI strip ── */}
      {data && <KpiStrip stats={data} />}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{(error as Error).message}</span>
        </div>
      )}

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando estadísticas…
        </div>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <MonthlyTrendChart data={data.monthlyTrend} />
          <StatusDistributionChart data={data.statusDistribution} />
          <EmployeeRankingChart data={data.employeeRanking} />
          <EntryHeatmapChart matrix={data.entryHeatmap} />
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────── KpiStrip ── */

function KpiStrip({ stats }: { stats: ReportsStats }) {
  const cards = [
    {
      label: "Empleados activos",
      value: stats.totals.totalEmployees,
      icon: UserCheck,
      tint: "text-sky-600 bg-sky-50 dark:bg-sky-950/40",
    },
    {
      label: "Horas trabajadas",
      value: `${stats.totals.totalWorkedHours}h`,
      icon: Clock,
      tint: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Horas planeadas",
      value: `${stats.totals.totalPlannedHours}h`,
      icon: TrendingUp,
      tint: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
    },
    {
      label: "Días registrados",
      value: stats.totals.totalDays,
      icon: Calendar,
      tint: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
    },
    {
      label: "Ausencias",
      value: stats.totals.totalAbsences,
      icon: UserX,
      tint: "text-red-600 bg-red-50 dark:bg-red-950/40",
    },
    {
      label: "Regularizaciones",
      value: stats.totals.totalRegularizations,
      icon: PenLine,
      tint: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="overflow-hidden">
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={cn(
                  "rounded-lg p-2 flex items-center justify-center",
                  c.tint
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                  {c.label}
                </p>
                <p className="text-lg font-semibold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
