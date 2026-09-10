"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { PageHeader } from "@/components/nova/page-header";
import { GenerateReportPanel } from "@/components/admin/reports/GenerateReportPanel";
import { ReportFilterBar } from "@/components/admin/reports/ReportFilterBar";
import { EmployeeReportTable } from "@/components/admin/reports/EmployeeReportTable";
import { AreaReportPanel } from "@/components/admin/reports/AreaReportPanel";
import { MonthlyMatrixPanel } from "@/components/admin/reports/MonthlyMatrixPanel";
import {
  defaultFilters,
  exportUrl,
  statsUrl,
  type ReportFilters,
} from "@/components/admin/reports/report-filters";
import {
  DEFAULT_FIELDS,
  attendancePct,
  type ReportFieldKey,
  type ReportViewKey,
} from "@/lib/constants/report-fields";
import type { ReportsStats } from "@/lib/services/reports-stats.service";

/* ============================================================
   Helpers
   ============================================================ */

type TabKey =
  | "dashboard"
  | "generate"
  | "attendance"
  | "hours"
  | "absences"
  | "payroll"
  | "areas"
  | "monthly";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: Icons.dashboard },
  { key: "generate", label: "Generar PDF", icon: Icons.download },
  { key: "attendance", label: "Asistencia", icon: Icons.clock },
  { key: "hours", label: "Horas trabajadas", icon: Icons.pulse },
  { key: "absences", label: "Ausencias", icon: Icons.alert },
  { key: "payroll", label: "Para nómina", icon: Icons.dollar },
  { key: "areas", label: "Por área", icon: Icons.building },
  { key: "monthly", label: "Mensual / Anual", icon: Icons.calendar },
];

/** Tabs that render a table with a column picker. */
const VIEW_TABS = ["attendance", "hours", "absences", "payroll", "areas", "monthly"] as const;
type ViewTab = (typeof VIEW_TABS)[number];

const isViewTab = (t: TabKey): t is ViewTab =>
  (VIEW_TABS as readonly string[]).includes(t);

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function monthLabel(ym: string): string {
  const [, m] = ym.split("-").map(Number);
  return MONTH_LABELS[m - 1] ?? ym;
}

/* ============================================================
   Big chart — monthly attendance area chart
   ============================================================ */

type ChartMetric = "attendance" | "hours" | "anomalies";

function BigChart({ stats, metric }: { stats: ReportsStats | undefined; metric: ChartMetric }) {
  const points = stats?.monthlyTrend ?? [];
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 220;

  if (points.length === 0) {
    return (
      <div className="chart-empty" style={{ minHeight: H }}>
        <div className="chart-empty-wave" aria-hidden>
          <span /><span /><span /><span /><span /><span /><span />
        </div>
        <div className="chart-empty-text">
          Sin datos para el rango seleccionado.<br />
          Prueba con un periodo más amplio.
        </div>
      </div>
    );
  }

  // Pick series based on metric
  const seriesPrimary = points.map((p) => {
    if (metric === "attendance") {
      // Cap at 100 — attendance is "did you meet your planned hours";
      // working overtime (workedHours > plannedHours) does NOT make
      // attendance exceed 100%. Overtime is shown separately in the
      // tooltip when present.
      return Math.round(attendancePct(p));
    }
    if (metric === "hours") return Math.round(p.workedHours * 10) / 10;
    // anomalies — derived: difference vs planned (negative is bad)
    return Math.round(Math.max(0, p.plannedHours - p.workedHours) * 10) / 10;
  });
  // Per-point overtime hours — only shown in tooltip when > 0.
  const overtime = points.map((p) => Math.max(0, p.workedHours - p.plannedHours));

  // niceMax = a "nice" round number ≥ actual max. Attendance is capped
  // at 100% so niceMax stays at 100 there; other metrics scale up.
  const rawMax = Math.max(0, ...seriesPrimary);
  const niceMax = (() => {
    if (metric === "attendance") return 100;
    if (rawMax <= 4) return 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    return Math.ceil(rawMax / mag) * mag;
  })();

  const unit = metric === "attendance" ? "%" : "h";
  const label = metric === "attendance" ? "Asistencia" : metric === "hours" ? "Trabajadas" : "Faltantes";

  // 5 Y-axis ticks: 0, 25, 50, 75, 100% of niceMax
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));

  // Top inset (% of H) — keeps the maximum-value dot from sitting on
  // the very top edge of the chart.
  const TOP_PCT = 6;
  const toY = (v: number) => TOP_PCT + ((niceMax - v) / niceMax) * (100 - TOP_PCT);
  const toSvgY = (v: number) => (toY(v) / 100) * H;

  // Horizontal inset — keeps first/last dots away from the plot edges.
  const PAD = 4; // percent
  const lerp = (i: number) =>
    points.length === 1 ? 50 : PAD + (i / (points.length - 1)) * (100 - 2 * PAD);
  const xAt = (i: number) => (lerp(i) / 100) * W;

  const ptsWorked = seriesPrimary
    .map((v, i) => `${xAt(i)},${toSvgY(v)}`)
    .join(" ");

  // Area polygon extends to BOTH SVG horizontal edges via horizontal
  // extrapolation from first/last data point — no empty band on the
  // right side of the panel.
  const firstY = toSvgY(seriesPrimary[0]);
  const lastY = toSvgY(seriesPrimary[seriesPrimary.length - 1]);
  const area = `0,${H} 0,${firstY} ${ptsWorked} ${W},${lastY} ${W},${H}`;

  // Layout: 44px reserved on the left for Y-axis labels, ~8px right
  // breathing room. Chart and X-labels share the same horizontal inset
  // so dots and labels stay aligned with the grid lines.
  const Y_AXIS_W = 44;
  const RIGHT_PAD = 8;

  return (
    <div>
      <div style={{ position: "relative", height: H }}>
        {/* Y-axis labels (left gutter) */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: Y_AXIS_W,
            height: "100%",
            pointerEvents: "none",
          }}
          aria-hidden
        >
          {yTicks
            .slice()
            .reverse()
            .map((t, idx) => (
              <span
                key={t + "_" + idx}
                style={{
                  position: "absolute",
                  right: 8,
                  top: `${TOP_PCT + idx * ((100 - TOP_PCT) / (yTicks.length - 1))}%`,
                  transform: "translateY(-50%)",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {t}{unit}
              </span>
            ))}
        </div>

        {/* Plot area — chart + dots live here. width:auto overrides the
            base .chart-container class's width:100% so that left+right
            actually constrain the box (else the SVG spills past the panel). */}
        <div
          className="chart-container"
          style={{ position: "absolute", left: Y_AXIS_W, right: RIGHT_PAD, top: 0, bottom: 0, width: "auto" }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%", display: "block" }}
            className="chart-rise"
            aria-hidden
          >
            <defs>
              <linearGradient id="reportsAreaA" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Horizontal gridlines aligned with each Y tick */}
            {yTicks.map((_t, idx) => {
              const yPct = TOP_PCT + ((yTicks.length - 1 - idx) * (100 - TOP_PCT)) / (yTicks.length - 1);
              const yPx = (yPct / 100) * H;
              return (
                <line
                  key={idx}
                  x1="0"
                  x2={W}
                  y1={yPx}
                  y2={yPx}
                  stroke="var(--border)"
                  strokeDasharray="2 3"
                  strokeWidth="0.5"
                />
              );
            })}
            <polygon points={area} fill="url(#reportsAreaA)" className="chart-area-breath" />
            <polyline points={ptsWorked} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            {/* Continuous comet traveling along the worked-hours line */}
            <polyline points={ptsWorked} className="chart-shimmer" strokeWidth="3.5" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* HTML-overlaid dots — round, hoverable, aligned with line */}
          {seriesPrimary.map((v, i) => (
            <button
              key={i}
              type="button"
              className="chart-dot"
              style={{ left: `${lerp(i)}%`, top: `${toY(v)}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${monthLabel(points[i].month)}: ${v}${unit}`}
            />
          ))}
          {hover !== null && (
            <div
              className="chart-tooltip"
              style={{ left: `${lerp(hover)}%`, top: `${toY(seriesPrimary[hover])}%` }}
            >
              <strong>{seriesPrimary[hover]}{unit}</strong>
              {label} · {monthLabel(points[hover].month)}
              {metric === "attendance" && overtime[hover] > 0 && (
                <span style={{ display: "block", color: "var(--text-muted)", fontWeight: 400, marginTop: 2 }}>
                  +{overtime[hover].toFixed(1)}h extra
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* X-axis labels — share the same left gutter + right padding so
          they align EXACTLY with the dots above. */}
      <div style={{ position: "relative", height: 16, marginTop: 4, marginLeft: Y_AXIS_W, marginRight: RIGHT_PAD }}>
        {points.map((p, i) => (
          <span
            key={p.month}
            style={{
              position: "absolute",
              left: `${lerp(i)}%`,
              transform: "translateX(-50%)",
              fontSize: 10,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {monthLabel(p.month)}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11, marginTop: 12 }}>
        <span>
          <span className="legend-dot accent" />{" "}
          {metric === "attendance" ? "% Asistencia real" : metric === "hours" ? "Horas trabajadas" : "Horas faltantes"}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   Area breakdown — % attendance per area
   ============================================================ */

function AreaBreakdown({
  stats,
  onPickArea,
}: {
  stats: ReportsStats | undefined;
  onPickArea: (area: string) => void;
}) {
  // Aggregation (and the accent-variant collapsing that goes with it) happens
  // server-side now, so this is a plain read of areaBreakdown.
  const byArea = (stats?.areaBreakdown ?? [])
    .map((a) => ({
      areaId: a.areaId,
      area: a.area,
      count: a.headcount,
      value: Math.round(attendancePct(a)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (byArea.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Sin datos
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {byArea.map((i) => (
        <div key={i.areaId}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <button
              type="button"
              onClick={() => onPickArea(i.area)}
              title="Ver el reporte de esta área"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: "var(--text-primary)",
                textAlign: "left",
              }}
            >
              {i.area} <span className="tcell-muted">({i.count})</span>
            </button>
            <span className="tcell-mono">{i.value}%</span>
          </div>
          <div style={{ height: 8, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, i.value)}%`,
                height: "100%",
                background:
                  "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--success)))",
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Week heatmap — hour x day grid
   ============================================================ */

function WeekHeatmap({ stats }: { stats: ReportsStats | undefined }) {
  const heatmap = stats?.entryHeatmap;
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const hours = ["7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18"];

  const max = useMemo(() => {
    if (!heatmap) return 1;
    let m = 0;
    heatmap.forEach((row) => row.forEach((v) => { if (v > m) m = v; }));
    return Math.max(1, m);
  }, [heatmap]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `24px repeat(${hours.length}, 1fr)`, gap: 2, fontSize: 10 }}>
      <span />
      {hours.map((h, i) => (
        <span key={`h-${i}`} style={{ textAlign: "center", color: "var(--text-muted)" }}>
          {h}
        </span>
      ))}
      {days.map((d, di) => (
        <Fragment key={`day-${di}`}>
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{d}</span>
          {hours.map((h, hi) => {
            const hour = parseInt(h, 10);
            const value = heatmap?.[di]?.[hour] ?? 0;
            const intensity = max > 0 ? value / max : 0;
            return (
              <div
                key={`c-${di}-${hi}`}
                style={{
                  aspectRatio: "1",
                  borderRadius: 2,
                  background: `color-mix(in srgb, var(--accent) ${intensity * 90}%, var(--bg-subtle))`,
                }}
                title={`${d} ${h}h: ${value} marcaciones`}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/* ============================================================
   Top employees list
   ============================================================ */

function TopList({ stats }: { stats: ReportsStats | undefined }) {
  const ranking = stats?.employeeRanking ?? [];
  const top = ranking
    .slice()
    .sort((a, b) => attendancePct(b) - attendancePct(a))
    .slice(0, 6);

  if (top.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
        Sin empleados con datos en el rango
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {top.map((e, i) => {
        const pct = Math.round(attendancePct(e));
        return (
          <Link
            key={e.employeeId}
            href={`/admin/employees/${encodeURIComponent(e.employeeId)}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-muted)",
                width: 18,
              }}
            >
              #{i + 1}
            </span>
            <NovaAvatar name={e.employeeName} size={28} variant="plain" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {e.employeeName}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{e.area || "—"}</div>
            </div>
            <span
              className="tcell-mono"
              style={{ fontSize: 12, fontWeight: 700, color: pct >= 95 ? "var(--success)" : "var(--text-primary)" }}
            >
              {pct}%
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function AdminReportsPage() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("attendance");
  const [filters, setFilters] = useState<ReportFilters>(defaultFilters);
  const [groupByArea, setGroupByArea] = useState(false);
  // Column selection is per view: the columns that make "Ausencias" readable
  // are not the ones you want in "Para nómina".
  const [fieldsByView, setFieldsByView] = useState<Record<ReportViewKey, ReportFieldKey[]>>(
    () => ({ ...DEFAULT_FIELDS })
  );

  const view: ReportViewKey | undefined = isViewTab(tab) ? tab : undefined;
  const fields = view ? fieldsByView[view] : undefined;

  const url = statsUrl(filters);
  const { data: stats, isLoading } = useQuery<ReportsStats>({
    queryKey: ["admin", "reports", "stats", url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Error al cargar reportes");
      }
      return res.json();
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  function pickArea(area: string) {
    setFilters((f) => ({ ...f, areas: [area] }));
    setTab("areas");
  }

  return (
    <>
      {/* PageHeader */}
      <PageHeader
        title="Reportes"
        subtitle="Genera, visualiza y exporta análisis de asistencia."
        actions={
          <>
            <a
              className="btn outline btn-md"
              href={exportUrl(filters, { variant: "all", format: "xlsx" })}
              title="Libro de Excel con resumen, asistencia, horas, ausencias, nómina, áreas, matriz mensual y anual"
            >
              <IconSvg d={Icons.download} size={14} /> Exportar Excel
            </a>
            <button
              type="button"
              className="btn primary btn-md"
              onClick={() => setTab("generate")}
            >
              <IconSvg d={Icons.download} size={14} /> Generar PDF
            </button>
          </>
        }
      />

      <div className="tabs" role="tablist" aria-label="Secciones de reportes">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`tab-panel-${t.key}`}
            id={`tab-${t.key}`}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <IconSvg d={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "generate" && (
        <ReportFilterBar
          filters={filters}
          onChange={setFilters}
          availableAreas={stats?.availableAreas ?? []}
          view={view}
          fields={fields}
          onFieldsChange={
            view
              ? (next) => setFieldsByView((prev) => ({ ...prev, [view]: next }))
              : undefined
          }
          groupByArea={groupByArea}
          onGroupByAreaChange={setGroupByArea}
          isLoading={isLoading}
        />
      )}

      {tab === "generate" && (
        <div id="tab-panel-generate" role="tabpanel" aria-labelledby="tab-generate">
          <GenerateReportPanel />
        </div>
      )}

      {(tab === "attendance" || tab === "hours" || tab === "absences" || tab === "payroll") && (
        <div id={`tab-panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          <EmployeeReportTable
            stats={stats}
            isLoading={isLoading}
            view={tab}
            fields={fieldsByView[tab]}
            groupByArea={groupByArea}
            filters={filters}
          />
        </div>
      )}

      {tab === "areas" && (
        <div id="tab-panel-areas" role="tabpanel" aria-labelledby="tab-areas">
          <AreaReportPanel
            stats={stats}
            isLoading={isLoading}
            fields={fieldsByView.areas}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      )}

      {tab === "monthly" && (
        <div id="tab-panel-monthly" role="tabpanel" aria-labelledby="tab-monthly">
          <MonthlyMatrixPanel
            stats={stats}
            isLoading={isLoading}
            fields={fieldsByView.monthly}
            filters={filters}
          />
        </div>
      )}

      {tab === "dashboard" && (
      <div id="tab-panel-dashboard" role="tabpanel" aria-labelledby="tab-dashboard">
      {/* Row 1: BigChart + AreaBreakdown */}
      <div className="row two-thirds" style={{ marginTop: 0 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Asistencia mensual</div>
              <div className="panel-sub">
                {chartMetric === "attendance"
                  ? "% promedio del rango"
                  : chartMetric === "hours"
                  ? "Horas trabajadas vs. planificadas"
                  : "Horas faltantes por mes"}
              </div>
            </div>
            <div className="tabs" style={{ margin: 0 }}>
              <button
                type="button"
                className={`tab ${chartMetric === "attendance" ? "active" : ""}`}
                onClick={() => setChartMetric("attendance")}
              >
                % Asistencia
              </button>
              <button
                type="button"
                className={`tab ${chartMetric === "hours" ? "active" : ""}`}
                onClick={() => setChartMetric("hours")}
              >
                Horas
              </button>
              <button
                type="button"
                className={`tab ${chartMetric === "anomalies" ? "active" : ""}`}
                onClick={() => setChartMetric("anomalies")}
              >
                Anomalías
              </button>
            </div>
          </div>
          <BigChart stats={stats} metric={chartMetric} />
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Por área</div>
              <div className="panel-sub">Asistencia promedio</div>
            </div>
            <button type="button" className="btn ghost btn-sm" onClick={() => setTab("areas")}>
              Ver detalle
            </button>
          </div>
          <AreaBreakdown stats={stats} onPickArea={pickArea} />
        </div>
      </div>

      {/* Row 2: Heatmap + TopList */}
      <div className="row half" style={{ marginTop: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Heatmap semanal</div>
              <div className="panel-sub">Marcaciones por hora y día</div>
            </div>
          </div>
          <WeekHeatmap stats={stats} />
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">Top empleados</div>
              <div className="panel-sub">Mejor asistencia en el rango</div>
            </div>
          </div>
          <TopList stats={stats} />
        </div>
      </div>
      </div>
      )}
    </>
  );
}
