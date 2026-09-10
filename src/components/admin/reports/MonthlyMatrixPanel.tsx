"use client";

/**
 * "Mensual / Anual" — the employee × period grid.
 *
 * Answers the question the per-person tabs cannot: how did these specific
 * people evolve across these specific months? Rows are the picked employees,
 * columns the picked months (or years), and the metric shown is one of the
 * columns from the field picker.
 *
 * A month with no records renders empty rather than as a zero: "worked nothing"
 * and "was not on staff yet" must not look the same in a payroll review.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import {
  REPORT_FIELD_BY_KEY,
  addMetrics,
  emptyMetrics,
  fieldDisplay,
  fieldValue,
  type ReportFieldKey,
  type ReportMetrics,
} from "@/lib/constants/report-fields";
import type { ReportsStats } from "@/lib/services/reports-stats.service";
import { exportUrl, monthShort, type ReportFilters } from "./report-filters";

type Granularity = "month" | "year";

interface Props {
  stats: ReportsStats | undefined;
  isLoading: boolean;
  fields: ReportFieldKey[];
  filters: ReportFilters;
}

export function MonthlyMatrixPanel({ stats, isLoading, fields, filters }: Props) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [metric, setMetric] = useState<ReportFieldKey>("workedHours");
  const [search, setSearch] = useState("");

  const numericFields = useMemo(
    () => fields.filter((f) => REPORT_FIELD_BY_KEY[f].kind !== "text"),
    [fields]
  );
  const activeMetric = numericFields.includes(metric) ? metric : numericFields[0] ?? "workedHours";

  const months = useMemo(() => stats?.months ?? [], [stats]);
  const years = useMemo(
    () => Array.from(new Set(months.map((m) => m.slice(0, 4)))).sort(),
    [months]
  );
  const buckets = granularity === "month" ? months : years;

  /** Metrics of one employee for one bucket, or null when there is no record. */
  function cellFor(
    byMonth: Record<string, ReportMetrics>,
    bucket: string
  ): ReportMetrics | null {
    if (granularity === "month") return byMonth[bucket] ?? null;
    const acc = emptyMetrics();
    let seen = false;
    for (const [m, cell] of Object.entries(byMonth)) {
      if (m.startsWith(bucket)) {
        addMetrics(acc, cell);
        seen = true;
      }
    }
    return seen ? acc : null;
  }

  const rows = useMemo(() => {
    const list = stats?.employeeMonthly ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (r) =>
            r.employeeName.toLowerCase().includes(q) || (r.area ?? "").toLowerCase().includes(q)
        )
      : list.slice();
    return filtered.sort(
      (a, b) => Number(fieldValue(activeMetric, b.total)) - Number(fieldValue(activeMetric, a.total))
    );
  }, [stats, search, activeMetric]);

  // Column footer — what the whole selection did in each bucket.
  const columnTotals = useMemo(() => {
    const out = new Map<string, ReportMetrics>();
    buckets.forEach((bucket) => {
      const acc = emptyMetrics();
      rows.forEach((r) => {
        const cell = cellFor(r.byMonth, bucket);
        if (cell) addMetrics(acc, cell);
      });
      out.set(bucket, acc);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, buckets, granularity]);

  const grandTotal = useMemo(
    () => rows.reduce((acc, r) => addMetrics(acc, r.total), emptyMetrics()),
    [rows]
  );

  const bucketLabel = (b: string) => (granularity === "month" ? monthShort(b) : b);
  const def = REPORT_FIELD_BY_KEY[activeMetric];

  // Colour scale across the grid, so the heavy and the light months pop out.
  const maxCell = useMemo(() => {
    let m = 0;
    rows.forEach((r) => {
      buckets.forEach((b) => {
        const cell = cellFor(r.byMonth, b);
        if (cell) m = Math.max(m, Number(fieldValue(activeMetric, cell)));
      });
    });
    return Math.max(1, m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, buckets, activeMetric, granularity]);

  return (
    <div className="table-wrap">
      <div className="table-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="searchbar" style={{ maxWidth: 240 }}>
          <span style={{ color: "var(--text-muted)" }}>
            <IconSvg d={Icons.search} size={14} />
          </span>
          <input
            placeholder="Buscar empleado o área…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="tabs" style={{ margin: 0 }}>
          <button
            type="button"
            className={`tab ${granularity === "month" ? "active" : ""}`}
            onClick={() => setGranularity("month")}
          >
            Por mes
          </button>
          <button
            type="button"
            className={`tab ${granularity === "year" ? "active" : ""}`}
            onClick={() => setGranularity("year")}
            disabled={years.length === 0}
          >
            Por año
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {numericFields.slice(0, 5).map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${activeMetric === f ? "active" : ""}`}
              onClick={() => setMetric(f)}
            >
              {REPORT_FIELD_BY_KEY[f].label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <a
            className="btn outline btn-sm"
            href={exportUrl(filters, {
              variant: granularity === "month" ? "monthly" : "yearly",
              format: "xlsx",
              cols: fields,
            })}
            title="Una hoja por métrica: empleados en filas, períodos en columnas"
          >
            <IconSvg d={Icons.download} size={13} /> Excel
          </a>
          <a
            className="btn ghost btn-sm"
            href={exportUrl(filters, {
              variant: granularity === "month" ? "monthly" : "yearly",
              format: "csv",
              cols: [activeMetric],
            })}
          >
            CSV
          </a>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{ height: 30, background: "var(--bg-subtle)", borderRadius: 4, opacity: 0.6 }}
            />
          ))}
        </div>
      ) : rows.length === 0 || buckets.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Sin datos para los filtros seleccionados. Prueba con otros meses o quita filtros.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: "var(--bg-panel)", zIndex: 1 }}>
                  Empleado
                </th>
                {buckets.map((b) => (
                  <th key={b} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {bucketLabel(b)}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <td style={{ position: "sticky", left: 0, background: "var(--bg-panel)", zIndex: 1 }}>
                    <Link
                      href={`/admin/employees/${encodeURIComponent(r.employeeId)}`}
                      style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
                    >
                      <NovaAvatar name={r.employeeName} size={24} variant="plain" />
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            fontSize: 12,
                            display: "block",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.employeeName}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {r.area || "—"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  {buckets.map((b) => {
                    const cell = cellFor(r.byMonth, b);
                    const value = cell ? Number(fieldValue(activeMetric, cell)) : null;
                    const intensity = value === null ? 0 : Math.min(1, value / maxCell);
                    return (
                      <td
                        key={b}
                        className="tcell-mono"
                        style={{
                          textAlign: "right",
                          background:
                            value === null || value === 0
                              ? undefined
                              : `color-mix(in srgb, var(--accent) ${Math.round(intensity * 22)}%, transparent)`,
                        }}
                        title={cell ? `${r.employeeName} · ${bucketLabel(b)}` : "Sin registros"}
                      >
                        {cell ? fieldDisplay(activeMetric, cell) : "—"}
                      </td>
                    );
                  })}
                  <td className="tcell-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                    {fieldDisplay(activeMetric, r.total)}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  style={{
                    position: "sticky",
                    left: 0,
                    background: "var(--bg-subtle)",
                    fontWeight: 700,
                    fontSize: 12,
                    zIndex: 1,
                  }}
                >
                  TOTAL · {def.label}
                </td>
                {buckets.map((b) => (
                  <td
                    key={b}
                    className="tcell-mono"
                    style={{ textAlign: "right", fontWeight: 700, background: "var(--bg-subtle)" }}
                  >
                    {fieldDisplay(activeMetric, columnTotals.get(b) ?? emptyMetrics())}
                  </td>
                ))}
                <td
                  className="tcell-mono"
                  style={{ textAlign: "right", fontWeight: 700, background: "var(--bg-subtle)" }}
                >
                  {fieldDisplay(activeMetric, grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
