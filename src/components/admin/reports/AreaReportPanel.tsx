"use client";

/**
 * "Reporte por área" — Ventas vs Consultoría vs the rest, side by side.
 *
 * Three things in one tab, because an area question is never only one of them:
 *   • a ranked bar comparison on the metric you care about
 *   • the numbers table, with the same column picker as every other view
 *   • a shortcut that turns any area into the active filter, so the per-person
 *     tabs and the PDF panel narrow to it without re-picking people by hand
 */

import { useMemo, useState } from "react";
import { IconSvg, Icons } from "@/components/nova/icons";
import {
  REPORT_FIELD_BY_KEY,
  addMetrics,
  emptyMetrics,
  fieldDisplay,
  fieldValue,
  type ReportFieldKey,
} from "@/lib/constants/report-fields";
import { areaKey } from "@/lib/utils/area";
import type { AreaBreakdownEntry, ReportsStats } from "@/lib/services/reports-stats.service";
import { cellColor } from "./EmployeeReportTable";
import { exportUrl, type ReportFilters } from "./report-filters";

interface Props {
  stats: ReportsStats | undefined;
  isLoading: boolean;
  fields: ReportFieldKey[];
  filters: ReportFilters;
  onFiltersChange: (next: ReportFilters) => void;
}

export function AreaReportPanel({ stats, isLoading, fields, filters, onFiltersChange }: Props) {
  const numericFields = useMemo(
    () => fields.filter((f) => REPORT_FIELD_BY_KEY[f].kind !== "text"),
    [fields]
  );
  const [metric, setMetric] = useState<ReportFieldKey>("workedHours");

  // Keep the chart metric inside the picked columns: charting a column the
  // admin just hid would be confusing.
  const chartMetric = numericFields.includes(metric) ? metric : numericFields[0] ?? "workedHours";

  const areas = useMemo(() => stats?.areaBreakdown ?? [], [stats]);
  const sorted = useMemo(
    () =>
      areas
        .slice()
        .sort((a, b) => Number(fieldValue(chartMetric, b)) - Number(fieldValue(chartMetric, a))),
    [areas, chartMetric]
  );

  const max = Math.max(1, ...sorted.map((a) => Number(fieldValue(chartMetric, a))));
  const total = useMemo(
    () => areas.reduce((acc, a) => addMetrics(acc, a), emptyMetrics()),
    [areas]
  );
  const selectedKeys = new Set(filters.areas.map(areaKey));

  function toggleArea(entry: AreaBreakdownEntry) {
    const next = filters.areas.filter((a) => areaKey(a) !== entry.areaId);
    if (next.length === filters.areas.length) next.push(entry.area);
    onFiltersChange({ ...filters, areas: next });
  }

  if (isLoading) {
    return (
      <div className="panel">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{ height: 30, background: "var(--bg-subtle)", borderRadius: 4, opacity: 0.6 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="panel">
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          Sin datos por área para los filtros seleccionados.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel" style={{ marginTop: 0 }}>
        <div className="panel-head">
          <div>
            <div className="panel-title">Comparativa entre áreas</div>
            <div className="panel-sub">
              {sorted.length} área{sorted.length === 1 ? "" : "s"} ·{" "}
              {REPORT_FIELD_BY_KEY[chartMetric].label}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {numericFields.slice(0, 5).map((f) => (
              <button
                key={f}
                type="button"
                className={`chip ${chartMetric === f ? "active" : ""}`}
                onClick={() => setMetric(f)}
              >
                {REPORT_FIELD_BY_KEY[f].label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((a) => {
            const value = Number(fieldValue(chartMetric, a));
            const on = selectedKeys.has(a.areaId);
            return (
              <div key={a.areaId}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => toggleArea(a)}
                    title={on ? "Quitar del filtro" : "Filtrar el reporte por esta área"}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "var(--text-primary)",
                      fontWeight: on ? 700 : 500,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {on && <IconSvg d={Icons.check} size={12} />}
                    {a.area}
                    <span className="tcell-muted" style={{ fontWeight: 400 }}>
                      ({a.headcount})
                    </span>
                  </button>
                  <span className="tcell-mono">{fieldDisplay(chartMetric, a)}</span>
                </div>
                <div style={{ height: 10, background: "var(--bg-subtle)", borderRadius: 5, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.max(2, (value / max) * 100)}%`,
                      height: "100%",
                      background:
                        "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--success)))",
                      borderRadius: 5,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 14, marginBottom: 0 }}>
          Haz clic en el nombre de un área para acotar todo el reporte a ella — las demás
          pestañas, el Excel y el PDF siguen ese filtro.
        </p>
      </div>

      <div className="table-wrap" style={{ marginTop: 16 }}>
        <div className="table-toolbar">
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Totales por área · {total.daysRecorded} días registrados
          </span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <a
              className="btn outline btn-sm"
              href={exportUrl(filters, { variant: "areas", format: "xlsx", cols: fields })}
              title="Descargar la comparativa por área en Excel"
            >
              <IconSvg d={Icons.download} size={13} /> Excel
            </a>
            <a
              className="btn ghost btn-sm"
              href={exportUrl(filters, { variant: "areas", format: "csv", cols: fields })}
            >
              CSV
            </a>
          </div>
        </div>

        <table className="table cards">
          <thead>
            <tr>
              <th>Área</th>
              <th>Personas</th>
              {numericFields.map((f) => (
                <th key={f}>{REPORT_FIELD_BY_KEY[f].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.areaId}>
                <td data-label="Área" style={{ fontWeight: 600 }}>
                  {a.area}
                </td>
                <td data-label="Personas" className="tcell-mono">
                  {a.headcount}
                  {a.withRecords < a.headcount && (
                    <span className="tcell-muted" title="Personas con al menos un registro">
                      {" "}
                      ({a.withRecords} con datos)
                    </span>
                  )}
                </td>
                {numericFields.map((f) => {
                  const color = cellColor(f, a);
                  return (
                    <td key={f} data-label={REPORT_FIELD_BY_KEY[f].label} className="tcell-mono">
                      <span style={{ color, fontWeight: color ? 700 : undefined }}>
                        {fieldDisplay(f, a)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td data-label="Área" style={{ fontWeight: 700 }}>
                TOTAL
              </td>
              <td data-label="Personas" className="tcell-mono" style={{ fontWeight: 700 }}>
                {areas.reduce((n, a) => n + a.headcount, 0)}
              </td>
              {numericFields.map((f) => (
                <td key={f} className="tcell-mono" style={{ fontWeight: 700 }}>
                  {fieldDisplay(f, total)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
