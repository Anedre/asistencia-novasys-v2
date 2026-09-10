"use client";

/**
 * Generate-report panel (Nova design system).
 *
 * Produces the PDFs: one per employee, or a single consolidated register. The
 * period is no longer limited to one week or one month — an admin can pick
 * several months (even non-contiguous, and across years), whole years, or a
 * free date range, and the register can be narrowed by area, grouped by area
 * and given a chosen set of summary columns.
 *
 * Backend contract: POST /api/reports/generate per selected employee, and
 * POST /api/reports/generate-all for the register. Both invoke the Python PDF
 * Lambda, which owns the period interpretation (`resolve_period`).
 */

import { useMemo, useState } from "react";
import { useAdminEmployees } from "@/hooks/use-employee";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { Spinner } from "@/components/nova/spinner";
import { NovaWeekPicker, currentISOWeek } from "@/components/nova/week-picker";
import { NovaDateRangePicker } from "@/components/nova/date-range-picker";
import { areaKey, buildAreaCanon } from "@/lib/utils/area";
import {
  DEFAULT_FIELDS,
  REPORT_FIELDS,
  REPORT_GROUP_LABELS,
  type ReportFieldGroup,
  type ReportFieldKey,
} from "@/lib/constants/report-fields";
import { FilterPopover, PopoverCheck, PopoverGroup } from "./FilterPopover";
import { monthLong, monthShort, monthsBack } from "./report-filters";

type Period = "weekly" | "monthly" | "yearly" | "range";
type DetailMode = "auto" | "on" | "off";

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const GROUP_ORDER: ReportFieldGroup[] = ["identidad", "dias", "horas", "cumplimiento"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Current month as "YYYY-MM" — client-only, same contract as NovaMonthPicker. */
function thisMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}`;
}

interface GenerateResult {
  employeeId: string;
  name: string;
  status: "ok" | "error";
  message?: string;
  url?: string;
}

interface ConsolidatedResult {
  status: "ok" | "error";
  message?: string;
  url?: string;
  employeeCount?: number;
}

export function GenerateReportPanel() {
  const { data, isLoading: loadingEmployees } = useAdminEmployees();
  const employees = useMemo(() => data?.employees ?? [], [data]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState<string[]>([]);

  const [period, setPeriod] = useState<Period>("monthly");
  const [week, setWeek] = useState(currentISOWeek());
  const [months, setMonths] = useState<string[]>(() => [thisMonth()]);
  const [years, setYears] = useState<string[]>(() => [String(new Date().getFullYear())]);
  const [range, setRange] = useState(() => monthsBack(1));

  const [cols, setCols] = useState<ReportFieldKey[]>(DEFAULT_FIELDS.payroll);
  const [groupByArea, setGroupByArea] = useState(false);
  const [detail, setDetail] = useState<DetailMode>("auto");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<GenerateResult[]>([]);
  const [runningAll, setRunningAll] = useState(false);
  const [allResult, setAllResult] = useState<ConsolidatedResult | null>(null);

  /** Canonical area labels, so accent variants collapse into one chip. */
  const areas = useMemo(() => {
    const canon = buildAreaCanon(employees.map((e) => e.area));
    return Array.from(canon.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [employees]);

  const areaKeys = useMemo(() => new Set(areaFilter.map(areaKey)), [areaFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (areaKeys.size > 0 && !areaKeys.has(areaKey(e.area))) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.area ?? "").toLowerCase().includes(q)
      );
    });
  }, [employees, search, areaKeys]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selectedIds.has(e.employeeId));

  function toggleAllFiltered() {
    const next = new Set(selectedIds);
    if (allFilteredSelected) filtered.forEach((e) => next.delete(e.employeeId));
    else filtered.forEach((e) => next.add(e.employeeId));
    setSelectedIds(next);
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleArea(label: string) {
    const key = areaKey(label);
    const next = areaFilter.filter((a) => areaKey(a) !== key);
    if (next.length === areaFilter.length) next.push(label);
    setAreaFilter(next);
  }

  /** Whole company — clears every narrowing filter on purpose. */
  function selectEveryone() {
    setSelectedIds(new Set(employees.map((e) => e.employeeId)));
    setSearch("");
    setAreaFilter([]);
  }

  /* ── Period ─────────────────────────────────────────────── */

  const periodValid =
    period === "weekly"
      ? Boolean(week)
      : period === "monthly"
      ? months.length > 0
      : period === "yearly"
      ? years.length > 0
      : Boolean(range.from && range.to && range.from <= range.to);

  /**
   * Period fields for the request body — exactly one family, never two.
   *
   * A single month goes out as `month`, not as a one-element `months`: that is
   * the shape the previously deployed Lambda understands, so the everyday
   * one-month report keeps working even before the new Lambda is rolled out.
   */
  function periodBody(): Record<string, unknown> {
    if (period === "weekly") return { week };
    if (period === "monthly") {
      const sorted = [...months].sort();
      return sorted.length === 1 ? { month: sorted[0] } : { months: sorted };
    }
    if (period === "yearly") return { years: [...years].sort() };
    return { from: range.from, to: range.to };
  }

  const periodSummary =
    period === "weekly"
      ? week
      : period === "monthly"
      ? months.length === 1
        ? monthLong(months[0])
        : `${months.length} meses`
      : period === "yearly"
      ? years.length === 1
        ? years[0]
        : `${years.length} años`
      : `${range.from} → ${range.to}`;

  function toggleMonth(ym: string) {
    setMonths((prev) =>
      prev.includes(ym) ? prev.filter((m) => m !== ym) : [...prev, ym].sort()
    );
  }

  function toggleYear(y: string) {
    setYears((prev) => (prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y].sort()));
  }

  /* ── Actions ────────────────────────────────────────────── */

  async function handleGenerate() {
    if (selectedIds.size === 0 || running || !periodValid) return;
    const targets = employees.filter((e) => selectedIds.has(e.employeeId));

    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: targets.length });

    const collected: GenerateResult[] = [];
    const scope = periodBody();

    // Sequential on purpose: the PDF Lambda is invoked once per employee and a
    // 40-person burst would hit concurrency limits. Progress is surfaced live.
    // One call covers the WHOLE selected period, however many months it spans.
    for (const emp of targets) {
      try {
        const res = await fetch("/api/reports/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employeeId: emp.employeeId, ...scope }),
        });
        const payload = await res.json();
        if (!res.ok || !payload.url) {
          collected.push({
            employeeId: emp.employeeId,
            name: emp.fullName,
            status: "error",
            message: payload?.error || "No se pudo generar",
          });
        } else {
          collected.push({
            employeeId: emp.employeeId,
            name: emp.fullName,
            status: "ok",
            url: payload.url,
          });
        }
      } catch (err) {
        collected.push({
          employeeId: emp.employeeId,
          name: emp.fullName,
          status: "error",
          message: err instanceof Error ? err.message : "Error de red",
        });
      }

      setProgress({ done: collected.length, total: targets.length });
      setResults([...collected]);
    }

    setRunning(false);
    setProgress(null);

    // Single report → open it straight away. For a batch we leave the list of
    // links on screen instead: opening 30 tabs trips the popup blocker.
    if (collected.length === 1 && collected[0].status === "ok" && collected[0].url) {
      window.open(collected[0].url, "_blank", "noopener");
    }
  }

  /**
   * Consolidated register: ONE PDF covering several people, no per-employee
   * loop. Follows the period above, narrows to the checked employees and/or
   * the active area chips, and carries the chosen summary columns.
   */
  async function handleGenerateAll() {
    if (runningAll || running || !periodValid) return;

    setRunningAll(true);
    setAllResult(null);

    const picked = Array.from(selectedIds);

    try {
      const res = await fetch("/api/reports/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...periodBody(),
          ...(picked.length > 0 && { employeeIds: picked }),
          ...(areaFilter.length > 0 && { areas: areaFilter }),
          cols,
          groupByArea,
          ...(detail !== "auto" && { detail: detail === "on" }),
        }),
      });
      const payload = await res.json();

      if (!res.ok || !payload.url) {
        setAllResult({ status: "error", message: payload?.error || "No se pudo generar" });
      } else {
        setAllResult({
          status: "ok",
          url: payload.url,
          employeeCount: payload.employeeCount,
        });
        window.open(payload.url, "_blank", "noopener");
      }
    } catch (err) {
      setAllResult({
        status: "error",
        message: err instanceof Error ? err.message : "Error de red",
      });
    } finally {
      setRunningAll(false);
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  const errCount = results.filter((r) => r.status === "error").length;

  const scopeNote =
    selectedIds.size > 0
      ? `Incluirá solo a los ${selectedIds.size} seleccionados arriba.`
      : areaFilter.length > 0
      ? `Incluirá a todo el personal de ${areaFilter.join(", ")}.`
      : "Sin selección incluye a toda la empresa; marca empleados o áreas arriba para acotarlo.";

  return (
    <div className="row two-thirds" style={{ marginTop: 0, alignItems: "start" }}>
      {/* ── Employee picker ───────────────────────────────── */}
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Empleados</div>
            <div className="panel-sub">
              {selectedIds.size === 0
                ? "Selecciona a quién incluir en el reporte"
                : `${selectedIds.size} de ${employees.length} seleccionados`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="btn outline btn-sm"
              onClick={selectEveryone}
              disabled={running || employees.length === 0}
            >
              <IconSvg d={Icons.users} size={13} /> Toda la empresa
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={() => setSelectedIds(new Set())}
                disabled={running}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="table-toolbar" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="searchbar" style={{ maxWidth: 280 }}>
            <span style={{ color: "var(--text-muted)" }}>
              <IconSvg d={Icons.search} size={14} />
            </span>
            <input
              placeholder="Buscar por nombre, email o área…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={running}
            />
          </div>
          <div style={{ display: "flex", gap: 4, marginLeft: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`chip ${areaFilter.length === 0 ? "active" : ""}`}
              onClick={() => setAreaFilter([])}
            >
              Todas
            </button>
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${areaKeys.has(areaKey(a)) ? "active" : ""}`}
                onClick={() => toggleArea(a)}
                title="Puedes marcar varias áreas"
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {loadingEmployees ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "32px 0",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            <Spinner size={16} /> Cargando empleados…
          </div>
        ) : (
          <>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: "var(--r)",
                background: "var(--bg-subtle)",
                fontSize: 12,
                cursor: "pointer",
                marginBottom: 6,
              }}
            >
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                disabled={running || filtered.length === 0}
                style={{ accentColor: "var(--accent)" }}
              />
              Seleccionar los {filtered.length} visibles
            </label>

            <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {filtered.map((emp) => {
                const checked = selectedIds.has(emp.employeeId);
                return (
                  <label
                    key={emp.employeeId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: "var(--r)",
                      cursor: running ? "default" : "pointer",
                      background: checked ? "var(--accent-soft)" : "transparent",
                      border: `1px solid ${checked ? "color-mix(in srgb, var(--accent) 35%, transparent)" : "transparent"}`,
                      transition: "background .15s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(emp.employeeId)}
                      disabled={running}
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <NovaAvatar name={emp.fullName} size={28} variant="plain" />
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
                        {emp.fullName}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {emp.email}
                        {emp.area ? ` · ${emp.area}` : ""}
                      </div>
                    </div>
                    {emp.position && (
                      <span className="pill" style={{ fontSize: 10, flexShrink: 0 }}>
                        {emp.position}
                      </span>
                    )}
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div
                  style={{
                    padding: "40px 0",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  No se encontraron empleados con esos filtros.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Generate ──────────────────────────────────────── */}
      <div className="panel" style={{ position: "sticky", top: 16 }}>
        <div className="panel-head">
          <div>
            <div className="panel-title">Generar reporte</div>
            <div className="panel-sub">PDF de asistencia · {periodSummary}</div>
          </div>
        </div>

        <div className="tabs" style={{ margin: "0 0 12px", flexWrap: "wrap" }}>
          {(
            [
              ["weekly", "Semanal"],
              ["monthly", "Mensual"],
              ["yearly", "Anual"],
              ["range", "Rango"],
            ] as [Period, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`tab ${period === key ? "active" : ""}`}
              onClick={() => setPeriod(key)}
              disabled={running || runningAll}
            >
              <IconSvg d={Icons.calendar} size={13} /> {label}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          {period === "weekly" && (
            <>
              <FieldLabel htmlFor="reportWeek">Semana</FieldLabel>
              <NovaWeekPicker id="reportWeek" value={week} onChange={setWeek} />
            </>
          )}

          {period === "monthly" && (
            <MonthGrid months={months} onToggle={toggleMonth} onSet={setMonths} disabled={running} />
          )}

          {period === "yearly" && (
            <YearGrid years={years} onToggle={toggleYear} disabled={running} />
          )}

          {period === "range" && (
            <>
              <FieldLabel htmlFor="reportRange">Rango de fechas</FieldLabel>
              <NovaDateRangePicker
                id="reportRange"
                from={range.from}
                to={range.to}
                onChange={(from, to) => setRange({ from, to })}
              />
            </>
          )}
        </div>

        <button
          type="button"
          className="btn primary btn-md"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={handleGenerate}
          disabled={running || selectedIds.size === 0 || !periodValid}
        >
          {running ? (
            <>
              <Spinner size={14} />
              {progress ? `Generando ${progress.done}/${progress.total}…` : "Generando…"}
            </>
          ) : (
            <>
              <IconSvg d={Icons.download} size={14} />
              Generar por empleado
              {selectedIds.size > 0 && ` · ${selectedIds.size}`}
            </>
          )}
        </button>

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
          {selectedIds.size === 0
            ? "Selecciona al menos un empleado."
            : `Un PDF por persona, cubriendo ${periodSummary}.`}
        </p>

        {/* ── Company-wide register (SUNAFIL) ──────────────── */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>
            Registro consolidado
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
            Un solo PDF con el detalle de varias personas, listo para imprimir. {scopeNote}
          </p>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <SummaryColumnPicker cols={cols} onChange={setCols} />
            <button
              type="button"
              className={`chip ${groupByArea ? "active" : ""}`}
              onClick={() => setGroupByArea((v) => !v)}
              title="Cada área con su encabezado y su subtotal"
            >
              {groupByArea ? "Agrupado por área" : "Agrupar por área"}
            </button>
            <DetailPicker detail={detail} onChange={setDetail} />
          </div>

          <button
            type="button"
            className="btn outline btn-md"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleGenerateAll}
            disabled={runningAll || running || !periodValid}
          >
            {runningAll ? (
              <>
                <Spinner size={14} />
                Generando registro…
              </>
            ) : (
              <>
                <IconSvg d={Icons.users} size={14} />
                Generar registro · {periodSummary}
                {selectedIds.size > 0 && ` · ${selectedIds.size}`}
              </>
            )}
          </button>

          {allResult && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                borderRadius: "var(--r)",
                fontSize: 11,
                background:
                  allResult.status === "ok"
                    ? "color-mix(in srgb, var(--success) 12%, transparent)"
                    : "color-mix(in srgb, var(--danger) 12%, transparent)",
              }}
            >
              {allResult.status === "ok" ? (
                <a href={allResult.url} target="_blank" rel="noopener noreferrer">
                  Registro generado{allResult.employeeCount ? ` · ${allResult.employeeCount} empleados` : ""} — abrir PDF
                </a>
              ) : (
                <span style={{ color: "var(--danger)" }}>{allResult.message}</span>
              )}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11,
                color: "var(--text-secondary)",
                marginBottom: 8,
              }}
            >
              <span style={{ color: "var(--success)", fontWeight: 600 }}>{okCount} generados</span>
              {errCount > 0 && (
                <span style={{ color: "var(--danger)", fontWeight: 600 }}>{errCount} con error</span>
              )}
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {results.map((r) => (
                <div
                  key={r.employeeId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: "var(--r)",
                    fontSize: 11,
                    background:
                      r.status === "ok"
                        ? "color-mix(in srgb, var(--success) 12%, transparent)"
                        : "color-mix(in srgb, var(--danger) 12%, transparent)",
                    color: r.status === "ok" ? "var(--success)" : "var(--danger)",
                  }}
                >
                  <IconSvg d={r.status === "ok" ? Icons.check : Icons.x} size={12} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={r.message}
                  >
                    {r.name}
                    {r.message ? ` — ${r.message}` : ""}
                  </span>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontWeight: 600, textDecoration: "underline", flexShrink: 0, color: "inherit" }}
                    >
                      Abrir
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Small pieces ────────────────────────────────────────── */

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--text-secondary)",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

/** Year navigation + 12 toggles: pick any set of months, across any years. */
function MonthGrid({
  months,
  onToggle,
  onSet,
  disabled,
}: {
  months: string[];
  onToggle: (ym: string) => void;
  onSet: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const selected = new Set(months);
  const allOfYear = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
  const wholeYearOn = allOfYear.every((m) => selected.has(m));

  return (
    <>
      <FieldLabel>Meses · puedes elegir varios</FieldLabel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <button type="button" className="ndp-nav" onClick={() => setYear((y) => y - 1)} aria-label="Año anterior">
          <IconSvg d="M15 18l-6-6 6-6" size={16} />
        </button>
        <strong style={{ fontSize: 13 }}>{year}</strong>
        <button type="button" className="ndp-nav" onClick={() => setYear((y) => y + 1)} aria-label="Año siguiente">
          <IconSvg d="M9 18l6-6-6-6" size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
        {MONTHS_SHORT.map((label, i) => {
          const ym = `${year}-${pad(i + 1)}`;
          return (
            <button
              key={ym}
              type="button"
              className={`chip ${selected.has(ym) ? "active" : ""}`}
              style={{ justifyContent: "center" }}
              onClick={() => onToggle(ym)}
              disabled={disabled}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          className="btn outline btn-sm"
          style={{ flex: 1, justifyContent: "center" }}
          disabled={disabled}
          onClick={() =>
            onSet(
              wholeYearOn
                ? months.filter((m) => !m.startsWith(`${year}-`))
                : Array.from(new Set([...months, ...allOfYear])).sort()
            )
          }
        >
          {wholeYearOn ? `Quitar ${year}` : `Todo ${year}`}
        </button>
        {months.length > 0 && (
          <button type="button" className="btn ghost btn-sm" disabled={disabled} onClick={() => onSet([])}>
            Limpiar
          </button>
        )}
      </div>

      {months.length > 0 && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.4 }}>
          {months.length === 1
            ? monthLong(months[0])
            : `${months.length} meses: ${[...months].sort().map(monthShort).join(", ")}`}
        </p>
      )}
    </>
  );
}

function YearGrid({
  years,
  onToggle,
  disabled,
}: {
  years: string[];
  onToggle: (y: string) => void;
  disabled?: boolean;
}) {
  const thisYear = new Date().getFullYear();
  const options = Array.from({ length: 6 }, (_, i) => String(thisYear - i));
  const selected = new Set(years);

  return (
    <>
      <FieldLabel>Años completos · puedes elegir varios</FieldLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {options.map((y) => (
          <button
            key={y}
            type="button"
            className={`chip ${selected.has(y) ? "active" : ""}`}
            style={{ justifyContent: "center" }}
            onClick={() => onToggle(y)}
            disabled={disabled}
          >
            {y}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.4 }}>
        En períodos largos el registro sale como resumen; el detalle día por día se puede
        forzar con la opción &quot;Detalle&quot;.
      </p>
    </>
  );
}

function SummaryColumnPicker({
  cols,
  onChange,
}: {
  cols: ReportFieldKey[];
  onChange: (next: ReportFieldKey[]) => void;
}) {
  const selected = new Set(cols);

  function toggle(key: ReportFieldKey) {
    const next = new Set(selected);
    if (next.has(key)) {
      if (next.size === 1) return; // never leave the table with just the name
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(REPORT_FIELDS.filter((f) => next.has(f.key)).map((f) => f.key));
  }

  return (
    <FilterPopover
      label="Columnas"
      icon={Icons.filter}
      badge={cols.length}
      width={320}
      maxHeight={380}
      title="Qué columnas lleva el resumen del registro consolidado"
    >
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
        Columnas del resumen por empleado. En A4 entran hasta 8: las que sobren se
        descartan de derecha a izquierda.
      </p>
      {GROUP_ORDER.map((group) => {
        const items = REPORT_FIELDS.filter((f) => f.group === group);
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
      <button
        type="button"
        className="btn ghost btn-sm"
        style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
        onClick={() => onChange(DEFAULT_FIELDS.payroll)}
      >
        Volver a las columnas por defecto
      </button>
    </FilterPopover>
  );
}

function DetailPicker({
  detail,
  onChange,
}: {
  detail: DetailMode;
  onChange: (next: DetailMode) => void;
}) {
  const label =
    detail === "auto" ? "Detalle: automático" : detail === "on" ? "Con detalle diario" : "Solo resumen";

  return (
    <FilterPopover
      label={label}
      icon={Icons.doc}
      width={280}
      maxHeight={200}
      title="Incluir o no el bloque día por día de cada empleado"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <PopoverCheck
          checked={detail === "auto"}
          onChange={() => onChange("auto")}
          label="Automático"
          hint="Con detalle hasta ~2 meses; más largo, solo resumen"
        />
        <PopoverCheck
          checked={detail === "on"}
          onChange={() => onChange("on")}
          label="Siempre con detalle diario"
          hint="Un año de 40 personas son miles de filas"
        />
        <PopoverCheck
          checked={detail === "off"}
          onChange={() => onChange("off")}
          label="Solo resumen"
          hint="Resumen por empleado y horas por período"
        />
      </div>
    </FilterPopover>
  );
}
