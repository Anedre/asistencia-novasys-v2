"use client";

/**
 * Filter bar for /admin/reports.
 *
 * One row of controls driving every data tab: the period (quick presets, a
 * multi-month picker or a multi-year picker), the areas, the people, and the
 * columns the current view shows. Everything writes into a single
 * `ReportFilters` object so the on-screen table and the export links can never
 * disagree about what is being reported.
 */

import { useMemo, useState } from "react";
import { useAdminEmployees } from "@/hooks/use-employee";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { areaKey } from "@/lib/utils/area";
import {
  DEFAULT_FIELDS,
  REPORT_FIELDS,
  REPORT_GROUP_LABELS,
  type ReportFieldGroup,
  type ReportFieldKey,
  type ReportViewKey,
} from "@/lib/constants/report-fields";
import { FilterPopover, PopoverCheck, PopoverGroup } from "./FilterPopover";
import {
  activeFilterCount,
  monthShort,
  monthsBack,
  periodLabel,
  type ReportFilters,
} from "./report-filters";

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  filters: ReportFilters;
  onChange: (next: ReportFilters) => void;
  /** Areas of the tenant, from the stats payload. */
  availableAreas: { id: string; label: string; headcount: number }[];
  /** Present only on views that carry a column picker. */
  view?: ReportViewKey;
  fields?: ReportFieldKey[];
  onFieldsChange?: (next: ReportFieldKey[]) => void;
  groupByArea?: boolean;
  onGroupByAreaChange?: (next: boolean) => void;
  isLoading?: boolean;
}

export function ReportFilterBar({
  filters,
  onChange,
  availableAreas,
  view,
  fields,
  onFieldsChange,
  groupByArea,
  onGroupByAreaChange,
  isLoading,
}: Props) {
  const patch = (p: Partial<ReportFilters>) => onChange({ ...filters, ...p });

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        marginBottom: 16,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <PeriodControls filters={filters} patch={patch} />

      <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} aria-hidden />

      <AreaFilter filters={filters} patch={patch} availableAreas={availableAreas} />
      <EmployeeFilter filters={filters} patch={patch} />

      {view && fields && onFieldsChange && (
        <FieldPicker
          view={view}
          fields={fields}
          onChange={onFieldsChange}
          groupByArea={groupByArea}
          onGroupByAreaChange={onGroupByAreaChange}
        />
      )}

      {activeFilterCount(filters) > 0 && (
        <button
          type="button"
          className="btn ghost btn-sm"
          onClick={() => patch({ areas: [], employeeIds: [] })}
        >
          Limpiar filtros
        </button>
      )}

      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
        {isLoading ? "Cargando…" : periodLabel(filters)}
      </span>
    </div>
  );
}

/* ── Period ──────────────────────────────────────────────────────────────── */

function PeriodControls({
  filters,
  patch,
}: {
  filters: ReportFilters;
  patch: (p: Partial<ReportFilters>) => void;
}) {
  const presetActive = (n: number) =>
    filters.mode === "range" && filters.from === monthsBack(n).from;

  return (
    <>
      {[1, 3, 6, 12].map((n) => (
        <button
          key={n}
          type="button"
          className={`chip ${presetActive(n) ? "active" : ""}`}
          onClick={() => patch({ mode: "range", ...monthsBack(n) })}
        >
          {n === 1 ? "1 mes" : `${n} meses`}
        </button>
      ))}

      <MonthMultiPicker filters={filters} patch={patch} />
      <YearMultiPicker filters={filters} patch={patch} />
    </>
  );
}

function MonthMultiPicker({
  filters,
  patch,
}: {
  filters: ReportFilters;
  patch: (p: Partial<ReportFilters>) => void;
}) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const selected = new Set(filters.months);
  const active = filters.mode === "months" && filters.months.length > 0;

  function toggle(ym: string) {
    const next = new Set(selected);
    if (next.has(ym)) next.delete(ym);
    else next.add(ym);
    const months = Array.from(next).sort();
    patch({ mode: months.length > 0 ? "months" : "range", months });
  }

  function toggleWholeYear() {
    const all = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
    const hasAll = all.every((m) => selected.has(m));
    const next = new Set(selected);
    all.forEach((m) => (hasAll ? next.delete(m) : next.add(m)));
    const months = Array.from(next).sort();
    patch({ mode: months.length > 0 ? "months" : "range", months });
  }

  const label = active
    ? filters.months.length === 1
      ? monthShort(filters.months[0])
      : `${filters.months.length} meses`
    : "Meses";

  return (
    <FilterPopover
      label={label}
      icon={Icons.calendar}
      width={280}
      maxHeight={280}
      title="Elegir uno o varios meses, incluso de años distintos"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <button type="button" className="ndp-nav" onClick={() => setYear((y) => y - 1)} aria-label="Año anterior">
          <IconSvg d="M15 18l-6-6 6-6" size={16} />
        </button>
        <strong style={{ fontSize: 13 }}>{year}</strong>
        <button type="button" className="ndp-nav" onClick={() => setYear((y) => y + 1)} aria-label="Año siguiente">
          <IconSvg d="M9 18l6-6-6-6" size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {MONTHS_SHORT.map((m, i) => {
          const ym = `${year}-${pad(i + 1)}`;
          const on = selected.has(ym);
          return (
            <button
              key={ym}
              type="button"
              className={`chip ${on ? "active" : ""}`}
              style={{ justifyContent: "center" }}
              onClick={() => toggle(ym)}
            >
              {m}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button type="button" className="btn outline btn-sm" style={{ flex: 1 }} onClick={toggleWholeYear}>
          Todo {year}
        </button>
        {filters.months.length > 0 && (
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={() => patch({ mode: "range", months: [] })}
          >
            Limpiar
          </button>
        )}
      </div>

      {filters.months.length > 0 && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.4 }}>
          {filters.months.length} seleccionado{filters.months.length === 1 ? "" : "s"}:{" "}
          {[...filters.months].sort().map(monthShort).join(", ")}
        </p>
      )}
    </FilterPopover>
  );
}

function YearMultiPicker({
  filters,
  patch,
}: {
  filters: ReportFilters;
  patch: (p: Partial<ReportFilters>) => void;
}) {
  const thisYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => String(thisYear - i)),
    [thisYear]
  );
  const selected = new Set(filters.years);
  const active = filters.mode === "years" && filters.years.length > 0;

  function toggle(y: string) {
    const next = new Set(selected);
    if (next.has(y)) next.delete(y);
    else next.add(y);
    const list = Array.from(next).sort();
    patch({ mode: list.length > 0 ? "years" : "range", years: list });
  }

  const label = active
    ? filters.years.length === 1
      ? filters.years[0]
      : `${filters.years.length} años`
    : "Años";

  return (
    <FilterPopover
      label={label}
      icon={Icons.calendar}
      width={200}
      maxHeight={240}
      title="Reporte anual — uno o varios años completos"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {years.map((y) => (
          <PopoverCheck
            key={y}
            checked={selected.has(y)}
            onChange={() => toggle(y)}
            label={`Año ${y}`}
            hint={y === String(thisYear) ? "En curso" : undefined}
          />
        ))}
      </div>
      {filters.years.length > 0 && (
        <button
          type="button"
          className="btn ghost btn-sm"
          style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
          onClick={() => patch({ mode: "range", years: [] })}
        >
          Limpiar
        </button>
      )}
    </FilterPopover>
  );
}

/* ── Areas ───────────────────────────────────────────────────────────────── */

function AreaFilter({
  filters,
  patch,
  availableAreas,
}: {
  filters: ReportFilters;
  patch: (p: Partial<ReportFilters>) => void;
  availableAreas: { id: string; label: string; headcount: number }[];
}) {
  // Compare by normalized key so "Consultoria" typed in one record still
  // matches the "Consultoría" chip.
  const selectedKeys = new Set(filters.areas.map(areaKey));

  function toggle(label: string) {
    const key = areaKey(label);
    const next = filters.areas.filter((a) => areaKey(a) !== key);
    if (next.length === filters.areas.length) next.push(label);
    patch({ areas: next });
  }

  const label =
    filters.areas.length === 0
      ? "Todas las áreas"
      : filters.areas.length === 1
      ? filters.areas[0]
      : `${filters.areas.length} áreas`;

  return (
    <FilterPopover
      label={label}
      icon={Icons.building}
      badge={filters.areas.length}
      width={260}
      maxHeight={300}
      title="Acotar el reporte a una o varias áreas"
    >
      {availableAreas.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 8 }}>
          Sin áreas registradas todavía.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {availableAreas.map((a) => (
            <PopoverCheck
              key={a.id}
              checked={selectedKeys.has(a.id)}
              onChange={() => toggle(a.label)}
              label={a.label}
              hint={`${a.headcount} persona${a.headcount === 1 ? "" : "s"}`}
            />
          ))}
        </div>
      )}
      {filters.areas.length > 0 && (
        <button
          type="button"
          className="btn ghost btn-sm"
          style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
          onClick={() => patch({ areas: [] })}
        >
          Quitar filtro de área
        </button>
      )}
    </FilterPopover>
  );
}

/* ── Employees ───────────────────────────────────────────────────────────── */

function EmployeeFilter({
  filters,
  patch,
}: {
  filters: ReportFilters;
  patch: (p: Partial<ReportFilters>) => void;
}) {
  const { data, isLoading } = useAdminEmployees();
  const [search, setSearch] = useState("");
  const employees = useMemo(() => data?.employees ?? [], [data]);
  const selected = new Set(filters.employeeIds);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.area ?? "").toLowerCase().includes(q)
    );
  }, [employees, search]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    patch({ employeeIds: Array.from(next) });
  }

  const label =
    filters.employeeIds.length === 0
      ? "Todos los empleados"
      : `${filters.employeeIds.length} empleado${filters.employeeIds.length === 1 ? "" : "s"}`;

  return (
    <FilterPopover
      label={label}
      icon={Icons.users}
      badge={filters.employeeIds.length}
      width={320}
      maxHeight={340}
      title="Elegir exactamente qué personas entran al reporte"
    >
      <div className="searchbar" style={{ marginBottom: 8 }}>
        <span style={{ color: "var(--text-muted)" }}>
          <IconSvg d={Icons.search} size={14} />
        </span>
        <input
          placeholder="Buscar empleado…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button
          type="button"
          className="btn outline btn-sm"
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => patch({ employeeIds: filtered.map((e) => e.employeeId) })}
          disabled={filtered.length === 0}
        >
          Seleccionar {filtered.length}
        </button>
        {filters.employeeIds.length > 0 && (
          <button type="button" className="btn ghost btn-sm" onClick={() => patch({ employeeIds: [] })}>
            Limpiar
          </button>
        )}
      </div>

      {isLoading ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 8 }}>Cargando empleados…</p>
      ) : filtered.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", padding: 8 }}>
          Sin empleados que coincidan.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((e) => {
            const on = selected.has(e.employeeId);
            return (
              <label
                key={e.employeeId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 6px",
                  borderRadius: "var(--r)",
                  cursor: "pointer",
                  background: on ? "var(--accent-soft)" : "transparent",
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(e.employeeId)}
                  style={{ accentColor: "var(--accent)" }}
                />
                <NovaAvatar name={e.fullName} size={22} variant="plain" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontSize: 12,
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {e.fullName}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{e.area || "Sin área"}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </FilterPopover>
  );
}

/* ── Column picker ───────────────────────────────────────────────────────── */

const GROUP_ORDER: ReportFieldGroup[] = ["identidad", "dias", "horas", "cumplimiento"];

function FieldPicker({
  view,
  fields,
  onChange,
  groupByArea,
  onGroupByAreaChange,
}: {
  view: ReportViewKey;
  fields: ReportFieldKey[];
  onChange: (next: ReportFieldKey[]) => void;
  groupByArea?: boolean;
  onGroupByAreaChange?: (next: boolean) => void;
}) {
  const selected = new Set(fields);
  // The "Por área" view aggregates people away, so a name or a DNI column
  // would have nothing to show.
  const usable = REPORT_FIELDS.filter((f) => view !== "areas" || f.kind !== "text");

  function toggle(key: ReportFieldKey) {
    const next = new Set(selected);
    if (next.has(key)) {
      // Never leave a table with no columns but the employee name.
      if (next.size === 1) return;
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(REPORT_FIELDS.filter((f) => next.has(f.key)).map((f) => f.key));
  }

  return (
    <FilterPopover
      label="Datos"
      icon={Icons.filter}
      badge={fields.length}
      width={320}
      maxHeight={400}
      align="right"
      title="Elegir qué columnas muestra y exporta este reporte"
    >
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
        Las columnas marcadas salen en la tabla, en el Excel y en el CSV.
      </p>

      {GROUP_ORDER.map((group) => {
        const items = usable.filter((f) => f.group === group);
        if (items.length === 0) return null;
        return (
          <PopoverGroup key={group} title={REPORT_GROUP_LABELS[group]}>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {items.map((f) => (
                <PopoverCheck
                  key={f.key}
                  checked={selected.has(f.key)}
                  onChange={() => toggle(f.key)}
                  label={f.label}
                  hint={f.hint}
                />
              ))}
            </div>
          </PopoverGroup>
        );
      })}

      {onGroupByAreaChange && view !== "areas" && (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
          <PopoverCheck
            checked={Boolean(groupByArea)}
            onChange={() => onGroupByAreaChange(!groupByArea)}
            label="Agrupar por área"
            hint="Cada área con su encabezado y su subtotal"
          />
        </div>
      )}

      <button
        type="button"
        className="btn ghost btn-sm"
        style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
        onClick={() => onChange(DEFAULT_FIELDS[view])}
      >
        Volver a las columnas por defecto
      </button>
    </FilterPopover>
  );
}
