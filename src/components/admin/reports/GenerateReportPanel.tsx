"use client";

/**
 * Generate-report panel (Nova design system).
 *
 * Replaces the old shadcn `GeneratePdfTab`, which was orphaned by the Nova
 * redesign (e204d1b) — the reports page stopped importing it, so admins lost
 * every way to produce a PDF for someone other than themselves.
 *
 * Same proven backend contract as before: one POST /api/reports/generate per
 * selected employee, weekly ("YYYY-Www") or monthly ("YYYY-MM"), which invokes
 * the Python PDF Lambda and returns a presigned S3 URL.
 */

import { useMemo, useState } from "react";
import { useAdminEmployees } from "@/hooks/use-employee";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { Spinner } from "@/components/nova/spinner";
import { NovaWeekPicker, currentISOWeek } from "@/components/nova/week-picker";
import { NovaMonthPicker, currentMonth } from "@/components/nova/month-picker";

type Period = "weekly" | "monthly";

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
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("monthly");
  const [week, setWeek] = useState(currentISOWeek());
  const [month, setMonth] = useState(currentMonth());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<GenerateResult[]>([]);
  const [runningAll, setRunningAll] = useState(false);
  const [allResult, setAllResult] = useState<ConsolidatedResult | null>(null);

  const areas = useMemo(
    () => Array.from(new Set(employees.map((e) => e.area).filter(Boolean))).sort(),
    [employees]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (areaFilter !== "all" && e.area !== areaFilter) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.area ?? "").toLowerCase().includes(q)
      );
    });
  }, [employees, search, areaFilter]);

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

  /** Whole company — ignores the active search/area filter on purpose. */
  function selectEveryone() {
    setSelectedIds(new Set(employees.map((e) => e.employeeId)));
    setSearch("");
    setAreaFilter("all");
  }

  async function handleGenerate() {
    if (selectedIds.size === 0 || running) return;
    const targets = employees.filter((e) => selectedIds.has(e.employeeId));

    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: targets.length });

    const collected: GenerateResult[] = [];

    // Sequential on purpose: the PDF Lambda is invoked once per employee and a
    // 40-person burst would hit concurrency limits. Progress is surfaced live.
    for (const emp of targets) {
      const body =
        period === "weekly"
          ? { employeeId: emp.employeeId, reportType: "weekly", week }
          : { employeeId: emp.employeeId, reportType: "monthly", month };

      try {
        const res = await fetch("/api/reports/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
   * Company-wide monthly register: ONE PDF with every employee, no per-employee
   * loop. Always monthly — it is the document presented to SUNAFIL, and the
   * inspection unit is the month.
   */
  async function handleGenerateAll() {
    if (runningAll || running || !month) return;

    setRunningAll(true);
    setAllResult(null);

    try {
      const res = await fetch("/api/reports/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
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
  const periodValid = period === "weekly" ? !!week : !!month;

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
              className={`chip ${areaFilter === "all" ? "active" : ""}`}
              onClick={() => setAreaFilter("all")}
            >
              Todas
            </button>
            {areas.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${areaFilter === a ? "active" : ""}`}
                onClick={() => setAreaFilter(a)}
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
            <div className="panel-sub">PDF de asistencia por empleado</div>
          </div>
        </div>

        <div className="tabs" style={{ margin: "0 0 12px" }}>
          <button
            type="button"
            className={`tab ${period === "weekly" ? "active" : ""}`}
            onClick={() => setPeriod("weekly")}
            disabled={running}
          >
            <IconSvg d={Icons.calendar} size={13} /> Semanal
          </button>
          <button
            type="button"
            className={`tab ${period === "monthly" ? "active" : ""}`}
            onClick={() => setPeriod("monthly")}
            disabled={running}
          >
            <IconSvg d={Icons.calendar} size={13} /> Mensual
          </button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            htmlFor={period === "weekly" ? "reportWeek" : "reportMonth"}
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 6,
            }}
          >
            {period === "weekly" ? "Semana" : "Mes"}
          </label>
          {period === "weekly" ? (
            <NovaWeekPicker id="reportWeek" value={week} onChange={setWeek} />
          ) : (
            <NovaMonthPicker id="reportMonth" value={month} onChange={setMonth} />
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
              Generar {period === "weekly" ? "semanal" : "mensual"}
              {selectedIds.size > 0 && ` · ${selectedIds.size}`}
            </>
          )}
        </button>

        {selectedIds.size === 0 && !running && (
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
            Selecciona al menos un empleado.
          </p>
        )}

        {/* ── Company-wide register (SUNAFIL) ──────────────── */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2 }}>
            Registro mensual de toda la empresa
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
            Un solo PDF con todos los empleados, listo para imprimir. Sin columnas
            de estado ni observaciones. No depende de la selección de arriba.
          </p>

          <button
            type="button"
            className="btn outline btn-md"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={handleGenerateAll}
            disabled={runningAll || running || !month}
          >
            {runningAll ? (
              <>
                <Spinner size={14} />
                Generando registro…
              </>
            ) : (
              <>
                <IconSvg d={Icons.users} size={14} />
                Generar registro · {month}
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
