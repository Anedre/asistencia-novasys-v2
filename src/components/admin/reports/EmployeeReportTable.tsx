"use client";

/**
 * Per-employee report table — the "reporte por persona" views.
 *
 * One component for Asistencia / Horas / Ausencias / Nómina: the columns come
 * from the shared field catalogue and the picker, not from a hard-coded list
 * per tab, so adding a metric to `report-fields` lights it up in all four.
 */

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import {
  REPORT_FIELD_BY_KEY,
  VIEW_SORT_FIELD,
  addMetrics,
  attendancePct,
  deltaHours,
  emptyMetrics,
  fieldDisplay,
  fieldValue,
  type ReportFieldKey,
  type ReportRow,
  type ReportViewKey,
} from "@/lib/constants/report-fields";
import type { EmployeeRankingEntry, ReportsStats } from "@/lib/services/reports-stats.service";
import { exportUrl, type ReportFilters } from "./report-filters";

type EmployeeView = Extract<ReportViewKey, "attendance" | "hours" | "absences" | "payroll">;

interface Props {
  stats: ReportsStats | undefined;
  isLoading: boolean;
  view: EmployeeView;
  fields: ReportFieldKey[];
  groupByArea: boolean;
  filters: ReportFilters;
}

/** Colour the cells that carry a judgement: good, bad, neutral. */
export function cellColor(key: ReportFieldKey, row: ReportRow): string | undefined {
  if (key === "attendancePct") {
    return attendancePct(row) >= 95 ? "var(--success)" : undefined;
  }
  if (key === "deltaHours") {
    return deltaHours(row) < 0 ? "var(--danger)" : "var(--success)";
  }
  if (key === "absences" || key === "lateDays" || key === "openDays") {
    return Number(fieldValue(key, row)) > 0 ? "var(--danger)" : undefined;
  }
  if (key === "overtimeHours") {
    return Number(fieldValue(key, row)) > 0 ? "var(--success)" : "var(--text-muted)";
  }
  return undefined;
}

export function EmployeeReportTable({
  stats,
  isLoading,
  view,
  fields,
  groupByArea,
  filters,
}: Props) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const list = stats?.employeeRanking ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (e) =>
            e.employeeName.toLowerCase().includes(q) ||
            (e.area ?? "").toLowerCase().includes(q)
        )
      : list.slice();

    const sortKey = VIEW_SORT_FIELD[view];
    return filtered.sort((a, b) => {
      const av = fieldValue(sortKey, a);
      const bv = fieldValue(sortKey, b);
      if (typeof av === "number" && typeof bv === "number") return bv - av;
      return String(av).localeCompare(String(bv), "es");
    });
  }, [stats, search, view]);

  // When grouping by area, the group heading already carries the area name.
  const cols = groupByArea ? fields.filter((f) => f !== "area") : fields;
  const colCount = cols.length + 1;

  const grouped = useMemo(() => {
    if (!groupByArea) return null;
    const map = new Map<string, EmployeeRankingEntry[]>();
    rows.forEach((e) => {
      const label = e.area || "Sin área";
      const list = map.get(label) ?? [];
      list.push(e);
      map.set(label, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [rows, groupByArea]);

  const totals = stats?.totals;

  function renderCells(row: ReportRow) {
    return cols.map((key) => {
      const def = REPORT_FIELD_BY_KEY[key];
      const color = cellColor(key, row);
      return (
        <td
          key={key}
          data-label={def.label}
          className={def.kind === "text" ? "tcell-muted" : "tcell-mono"}
        >
          <span style={{ color, fontWeight: color ? 700 : undefined }}>
            {fieldDisplay(key, row)}
          </span>
        </td>
      );
    });
  }

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <div className="searchbar" style={{ maxWidth: 280 }}>
          <span style={{ color: "var(--text-muted)" }}>
            <IconSvg d={Icons.search} size={14} />
          </span>
          <input
            placeholder="Buscar empleado o área…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
          {rows.length} empleado{rows.length === 1 ? "" : "s"}
          {totals ? ` · ${totals.daysRecorded} días registrados` : ""}
        </span>
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          <a
            className="btn outline btn-sm"
            href={exportUrl(filters, {
              variant: view,
              format: "xlsx",
              cols: fields,
              groupByArea,
            })}
            title="Descargar esta vista en Excel, con las mismas columnas y filtros"
          >
            <IconSvg d={Icons.download} size={13} /> Excel
          </a>
          <a
            className="btn ghost btn-sm"
            href={exportUrl(filters, { variant: view, format: "csv", cols: fields })}
            title="Descargar esta vista en CSV"
          >
            CSV
          </a>
        </div>
      </div>

      <table className="table cards">
        <thead>
          <tr>
            <th>Empleado</th>
            {cols.map((key) => (
              <th key={key}>{REPORT_FIELD_BY_KEY[key].label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={colCount}>
                  <div
                    style={{
                      height: 32,
                      background: "var(--bg-subtle)",
                      borderRadius: 4,
                      margin: "4px 0",
                      opacity: 0.6,
                    }}
                  />
                </td>
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                style={{
                  textAlign: "center",
                  padding: "48px 0",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}
              >
                {search
                  ? "Sin empleados que coincidan con la búsqueda"
                  : "Sin datos de asistencia para los filtros seleccionados"}
              </td>
            </tr>
          ) : grouped ? (
            grouped.map(([area, people]) => {
              const subtotal = people.reduce((acc, e) => addMetrics(acc, e), emptyMetrics());
              return (
                <Fragment key={area}>
                  <tr>
                    <td colSpan={colCount} style={{ background: "var(--bg-subtle)", fontWeight: 700, fontSize: 12 }}>
                      {area}{" "}
                      <span className="tcell-muted" style={{ fontWeight: 400 }}>
                        · {people.length} persona{people.length === 1 ? "" : "s"}
                      </span>
                    </td>
                  </tr>
                  {people.map((e) => (
                    <tr key={e.employeeId}>
                      <td data-label="Empleado">
                        <EmployeeCell entry={e} />
                      </td>
                      {renderCells(e)}
                    </tr>
                  ))}
                  <tr>
                    <td data-label="Subtotal" style={{ fontWeight: 700, fontSize: 12 }}>
                      Subtotal {area}
                    </td>
                    {cols.map((key) => (
                      <td key={key} className="tcell-mono" style={{ fontWeight: 700 }}>
                        {REPORT_FIELD_BY_KEY[key].kind === "text"
                          ? ""
                          : fieldDisplay(key, subtotal)}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })
          ) : (
            rows.map((e) => (
              <tr key={e.employeeId}>
                <td data-label="Empleado">
                  <EmployeeCell entry={e} />
                </td>
                {renderCells(e)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeCell({ entry }: { entry: EmployeeRankingEntry }) {
  return (
    <Link
      href={`/admin/employees/${encodeURIComponent(entry.employeeId)}`}
      style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
    >
      <NovaAvatar name={entry.employeeName} size={26} variant="plain" />
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{entry.employeeName}</span>
    </Link>
  );
}
