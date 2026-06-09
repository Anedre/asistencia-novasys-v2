"use client";

/**
 * Regularizar asistencia — admin page (rediseño completo).
 *
 * Layout: 2 columns. Left = form steps (employee → date(s) → details).
 * Right = sticky summary card with live preview ("qué va a pasar") and
 * the primary CTA.
 *
 * Three modes selected via a top-card switcher:
 *   • single  — regularize ONE day for one employee
 *   • range   — regularize a DATE RANGE for one employee (with
 *               weekday/past-only/overwrite toggles)
 *   • clean   — DELETE the existing record for a specific day (the
 *               destructive action, paint red + inline confirm, no
 *               native confirm() dialog)
 *
 * The reason picker is a visual grid of chips with category icons
 * (medical, vacation, work-trip, training, ...) instead of a plain
 * <select>. Schedule shows a live preview ("8.0h trabajadas + 1h
 * break") computed from the time fields.
 *
 * Toast notifications via sonner replace the inline success/error
 * banners that the old version used.
 *
 * API contracts are UNCHANGED:
 *   POST /api/regularization
 *   POST /api/regularization/range
 *   DELETE /api/admin/daily-summary/:empId/:date
 */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminEmployees } from "@/hooks/use-employee";
import { REASON_LABELS, ALL_REASON_OPTIONS, ABSENCE_REASONS } from "@/lib/constants/reason-codes";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { PageHeader } from "@/components/nova/page-header";
import { NovaDatePicker, todayISO } from "@/components/nova/date-picker";
import { NovaDateRangePicker } from "@/components/nova/date-range-picker";

/* -------------------------------------------------------------------- types */

type EmployeeItem = {
  employeeId: string;
  fullName: string;
  email: string;
  area: string;
};

type Mode = "single" | "range" | "clean";

/* ---------------------------------------------------------- reason metadata */
// Map each reason to a category icon + intent ("absence" vs "workday").

const REASON_ICON: Record<string, React.ReactNode> = {
  VACACIONES: Icons.beach,
  DESCANSO_MEDICO: Icons.heart,
  DESCANSO_PRENATAL: Icons.heart,
  DESCANSO_POSTNATAL: Icons.heart,
  VIAJE_TRABAJO: Icons.briefcase,
  VISITA_CLIENTE: Icons.users,
  COMISION_SERVICIO: Icons.briefcase,
  OLVIDO_MARCACION: Icons.clock,
  FALLA_SISTEMA: Icons.alert,
  CAPACITACION: Icons.cake,
  PERMISO: Icons.calendar,
  OTRO: Icons.more,
  CARGA_INICIAL: Icons.upload,
};

/* ---------------------------------------------------------------- helpers */

function diffMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const total = eh * 60 + em - (sh * 60 + sm);
  return total > 0 ? total : 0;
}

function fmtHours(min: number): string {
  if (min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

function countDays(from: string, to: string, weekdaysOnly: boolean): number {
  if (!from || !to) return 0;
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || t < f) return 0;
  let n = 0;
  const cur = new Date(f);
  while (cur <= t) {
    const dow = cur.getDay();
    if (!weekdaysOnly || (dow !== 0 && dow !== 6)) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

/* ============================================================ Page */

export default function RegularizePage() {
  const queryClient = useQueryClient();
  const { data, isLoading: loadingEmployees } = useAdminEmployees();
  const employees: EmployeeItem[] = data?.employees ?? [];

  const [mode, setMode] = useState<Mode>("single");

  // Form state — shared across modes when sensible.
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeArea, setEmployeeArea] = useState("");
  const [empSearch, setEmpSearch] = useState("");

  const [workDate, setWorkDate] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMinutes, setBreakMinutes] = useState(60);

  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");

  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [pastDatesOnly, setPastDatesOnly] = useState(true);
  const [overwrite, setOverwrite] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [confirmingClean, setConfirmingClean] = useState(false);

  // Reset confirmation when key inputs change.
  useEffect(() => setConfirmingClean(false), [employeeId, workDate, mode]);

  // Default the single-day date to today on mount (deferred to rAF so it's not
  // a synchronous setState in the effect body, and SSR-safe — starts empty).
  useEffect(() => {
    const id = requestAnimationFrame(() => setWorkDate((w) => w || todayISO()));
    return () => cancelAnimationFrame(id);
  }, []);

  function invalidateAttendanceCaches(empId?: string) {
    queryClient.invalidateQueries({ queryKey: ["admin", "attendance"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    if (empId) queryClient.invalidateQueries({ queryKey: ["admin", "employee", empId] });
  }

  /* ------------------------------------------- derived (live preview) */
  const isAbsence = reasonCode ? ABSENCE_REASONS.has(reasonCode) : false;
  const grossMin = diffMinutes(startTime, endTime);
  const workedMin = Math.max(0, grossMin - (breakMinutes || 0));
  const dayCount =
    mode === "range"
      ? countDays(dateFrom, dateTo, weekdaysOnly)
      : workDate
      ? 1
      : 0;
  const totalWorkedMin = isAbsence ? 0 : workedMin * dayCount;

  /* ----------------------------------- validity for the submit button */
  const validSingle = !!employeeId && !!workDate && !!reasonCode;
  const validRange =
    !!employeeId && !!dateFrom && !!dateTo && !!reasonCode && dayCount > 0;
  const validClean = !!employeeId && !!workDate;
  const isValid =
    mode === "single" ? validSingle : mode === "range" ? validRange : validClean;

  /* ---------------------------------------------- submit handlers */
  async function submitSingle() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          workDate,
          startTime,
          endTime,
          breakMinutes,
          reasonCode,
          reasonNote,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error al regularizar");
      toast.success(body.message || "Regularización aplicada");
      invalidateAttendanceCaches(employeeId);
      // Soft reset: clear date + note, keep employee & schedule for batch flow
      setWorkDate("");
      setReasonNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al regularizar");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRange() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/regularization/range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          dateFrom,
          dateTo,
          startTime,
          endTime,
          breakMinutes,
          reasonCode,
          reasonNote,
          weekdaysOnly,
          pastDatesOnly,
          overwrite,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Error al regularizar rango");
      const processed = (body.totalCreated ?? 0) + (body.totalOverwritten ?? 0);
      const parts = [`${processed} día(s) regularizados`];
      if (body.totalIgnoredHolidays) parts.push(`${body.totalIgnoredHolidays} feriado(s) respetado(s)`);
      if (body.totalIgnoredWeekends) parts.push(`${body.totalIgnoredWeekends} fin de semana omitido(s)`);
      if (body.totalSkipped) parts.push(`${body.totalSkipped} ya existente(s) sin sobrescribir`);
      toast.success(parts.join(" · "));
      invalidateAttendanceCaches(employeeId);
      setDateFrom("");
      setDateTo("");
      setReasonNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al regularizar rango");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitClean() {
    setSubmitting(true);
    try {
      const url = `/api/admin/daily-summary/${encodeURIComponent(employeeId)}/${encodeURIComponent(workDate)}`;
      const res = await fetch(url, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      toast.success(
        body.deleted
          ? "Registro eliminado. Puedes deshacerlo en Historial."
          : "No había registro para ese día."
      );
      invalidateAttendanceCaches(employeeId);
      setWorkDate("");
      setConfirmingClean(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    if (mode === "single") return submitSingle();
    if (mode === "range") return submitRange();
    // clean — show inline confirmation first
    if (!confirmingClean) {
      setConfirmingClean(true);
      return;
    }
    return submitClean();
  }

  /* ----------------------------------------------------- render */
  return (
    <>
      <PageHeader
        title="Regularizar asistencia"
        subtitle="Aplica una jornada a uno o varios días, o limpia un registro erróneo."
      />

      <div className="rg-layout">
        {/* ─── Left column — form steps ─── */}
        <div>
          <ModeSwitcher mode={mode} onChange={setMode} />

          {mode === "clean" && (
            <div className="rg-warn-banner">
              <IconSvg d={Icons.alert} size={14} />
              <div>
                Esta acción elimina por completo el registro del día. Se usa
                cuando hay un registro erróneo que no debería existir. Todo
                borrado queda auditado y puedes revertirlo desde{" "}
                <a href="/admin/audit">Historial</a>. Si sólo necesitas corregir
                campos puntuales, ve a <strong>Empleados → Asistencia</strong>.
              </div>
            </div>
          )}

          {/* Steps 1 & 2 sit side by side so the employee picker stays compact */}
          <div className="rg-toprow">
          {/* Step 1 — empleado */}
          <StepBlock num={1} title="Empleado" done={!!employeeId}>
            {employeeId ? (
              <div className="rg-emp-selected">
                <NovaAvatar name={employeeName} size={40} variant="plain" />
                <div className="rg-emp-selected-main">
                  <div className="rg-emp-selected-name">{employeeName}</div>
                  <div className="rg-emp-selected-meta">{employeeArea}</div>
                </div>
                <button
                  type="button"
                  className="btn outline btn-sm"
                  onClick={() => {
                    setEmployeeId("");
                    setEmployeeName("");
                    setEmployeeArea("");
                  }}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <EmployeeList
                employees={employees}
                loading={loadingEmployees}
                search={empSearch}
                setSearch={setEmpSearch}
                onPick={(e) => {
                  setEmployeeId(e.employeeId);
                  setEmployeeName(e.fullName);
                  setEmployeeArea(e.area || "Sin área");
                }}
              />
            )}
          </StepBlock>

          {/* Step 2 — fechas */}
          <StepBlock
            num={2}
            title={mode === "range" ? "Rango de fechas" : "Fecha"}
            done={mode === "range" ? !!dateFrom && !!dateTo : !!workDate}
            hint={mode === "range" && dayCount > 0 ? `${dayCount} día(s)` : undefined}
          >
            {mode === "range" ? (
              <div className="rg-field">
                <label className="rg-label">
                  Rango de fechas<span className="req">*</span>
                </label>
                <NovaDateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
                />
              </div>
            ) : (
              <div className="rg-field">
                <label className="rg-label" htmlFor="workDate">
                  Fecha a {mode === "clean" ? "eliminar" : "regularizar"}
                  <span className="req">*</span>
                </label>
                <NovaDatePicker
                  id="workDate"
                  value={workDate}
                  onChange={setWorkDate}
                />
              </div>
            )}
          </StepBlock>
          </div>

          {/* Step 3 — jornada + motivo (no aplica al modo clean) */}
          {mode !== "clean" && (
            <StepBlock num={3} title="Jornada y motivo" done={!!reasonCode}>
              <div className="rg-row cols-3">
                <div className="rg-field">
                  <label className="rg-label" htmlFor="startTime">
                    Entrada<span className="req">*</span>
                  </label>
                  <input
                    id="startTime"
                    type="time"
                    className="rg-input"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="rg-field">
                  <label className="rg-label" htmlFor="endTime">
                    Salida<span className="req">*</span>
                  </label>
                  <input
                    id="endTime"
                    type="time"
                    className="rg-input"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
                <div className="rg-field">
                  <label className="rg-label" htmlFor="breakMinutes">
                    Break (min)
                  </label>
                  <input
                    id="breakMinutes"
                    type="number"
                    min={0}
                    max={480}
                    className="rg-input"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="rg-sched-preview">
                <IconSvg d={Icons.clock} size={14} />
                {grossMin > 0 ? (
                  <>
                    <strong>{fmtHours(workedMin)}</strong> trabajadas
                    {breakMinutes > 0 ? <> + {breakMinutes}min break</> : null}
                    {isAbsence && (
                      <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                        — el motivo seleccionado no descuenta horas
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>
                    Define la hora de entrada y salida
                  </span>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <label className="rg-label" style={{ display: "block", marginBottom: 8 }}>
                  Motivo<span className="req">*</span>
                </label>
                <div className="rg-reason-grid">
                  {ALL_REASON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`rg-reason${reasonCode === opt.value ? " active" : ""}`}
                      onClick={() => setReasonCode(opt.value)}
                      aria-pressed={reasonCode === opt.value}
                    >
                      <span className="rg-reason-icon">
                        <IconSvg d={REASON_ICON[opt.value] ?? Icons.more} size={14} />
                      </span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rg-field" style={{ marginTop: 16 }}>
                <label className="rg-label" htmlFor="reasonNote">
                  Nota adicional
                </label>
                <textarea
                  id="reasonNote"
                  className="rg-textarea"
                  placeholder="Detalle opcional (visible en el historial)…"
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  rows={3}
                />
              </div>
            </StepBlock>
          )}

          {/* Step 4 — opciones del rango */}
          {mode === "range" && (
            <StepBlock num={4} title="Opciones" optional>
              <div className="rg-toggles">
                <ToggleRow
                  id="weekdaysOnly"
                  label="Solo días laborales (lun-vie)"
                  checked={weekdaysOnly}
                  onChange={setWeekdaysOnly}
                />
                <ToggleRow
                  id="pastDatesOnly"
                  label="Solo fechas pasadas"
                  checked={pastDatesOnly}
                  onChange={setPastDatesOnly}
                />
                <ToggleRow
                  id="overwrite"
                  label="Sobrescribir registros existentes"
                  checked={overwrite}
                  onChange={setOverwrite}
                />
              </div>
            </StepBlock>
          )}
        </div>

        {/* ─── Right column — sticky summary ─── */}
        <aside>
          <div className="rg-summary">
            <div className="rg-summary-title">Resumen</div>

            {employeeId ? (
              <div className="rg-summary-emp">
                <NovaAvatar name={employeeName} size={36} variant="plain" />
                <div className="rg-summary-emp-main">
                  <div className="rg-summary-emp-name">{employeeName}</div>
                  <div className="rg-summary-emp-area">{employeeArea}</div>
                </div>
              </div>
            ) : (
              <div className="rg-summary-empty">
                Selecciona un empleado para empezar
              </div>
            )}

            <div className="rg-summary-stats">
              <div className="rg-stat">
                <span>Días afectados</span>
                <span className={`rg-stat-value${dayCount > 0 ? " accent" : ""}`}>
                  {dayCount}
                </span>
              </div>
              {mode !== "clean" && (
                <>
                  <div className="rg-stat">
                    <span>Horas por día</span>
                    <span className="rg-stat-value">
                      {grossMin > 0 ? fmtHours(workedMin) : "—"}
                    </span>
                  </div>
                  <div className="rg-stat">
                    <span>Horas totales</span>
                    <span className="rg-stat-value accent">
                      {isAbsence ? "0h (ausencia)" : fmtHours(totalWorkedMin)}
                    </span>
                  </div>
                  <div className="rg-stat">
                    <span>Motivo</span>
                    <span className="rg-stat-value" style={{ fontSize: 12 }}>
                      {reasonCode ? REASON_LABELS[reasonCode] : "—"}
                    </span>
                  </div>
                </>
              )}
              {mode === "range" && weekdaysOnly && (
                <div className="rg-stat" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  Fines de semana omitidos automáticamente
                </div>
              )}
              {mode === "clean" && (
                <div className="rg-stat">
                  <span>Acción</span>
                  <span className="rg-stat-value danger" style={{ fontSize: 12 }}>
                    Eliminar registro
                  </span>
                </div>
              )}
            </div>

            {confirmingClean ? (
              <div className="rg-confirm">
                <div className="rg-confirm-text">
                  ¿Eliminar el registro de <strong>{employeeName}</strong> del{" "}
                  <strong>{workDate}</strong>? El día volverá a estar sin registro.
                </div>
                <div className="rg-confirm-actions">
                  <button
                    type="button"
                    className="rg-confirm-cancel"
                    onClick={() => setConfirmingClean(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="rg-confirm-yes"
                    onClick={submitClean}
                    disabled={submitting}
                  >
                    {submitting ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`rg-cta${mode === "clean" ? " danger" : ""}`}
                onClick={handleSubmit}
                disabled={!isValid || submitting}
              >
                {submitting && mode !== "clean" ? (
                  "Procesando…"
                ) : (
                  <>
                    <IconSvg
                      d={mode === "clean" ? Icons.trash : Icons.check}
                      size={14}
                    />
                    {mode === "clean"
                      ? "Eliminar registro"
                      : mode === "range"
                      ? `Regularizar ${dayCount > 0 ? `${dayCount} día(s)` : "rango"}`
                      : "Aplicar regularización"}
                  </>
                )}
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

/* ============================================================ Pieces */

function ModeSwitcher({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const items: { key: Mode; icon: React.ReactNode; title: string; desc: string; tone: string }[] = [
    { key: "single", icon: Icons.calendar, title: "Día único", desc: "Regularizar un solo día", tone: "#6366F1" },
    { key: "range", icon: Icons.history, title: "Rango", desc: "Aplicar a varios días seguidos", tone: "#14B8A6" },
    { key: "clean", icon: Icons.trash, title: "Limpiar día", desc: "Eliminar un registro erróneo", tone: "var(--danger)" },
  ];
  return (
    <div className="rg-modes">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`rg-mode${mode === it.key ? " active" : ""}`}
          style={{ "--mtone": it.tone } as React.CSSProperties}
          onClick={() => onChange(it.key)}
          aria-pressed={mode === it.key}
        >
          <span className="rg-mode-icon">
            <IconSvg d={it.icon} size={16} />
          </span>
          <span className="rg-mode-text">
            <span className="rg-mode-title">{it.title}</span>
            <span className="rg-mode-desc">{it.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function StepBlock({
  num,
  title,
  done,
  hint,
  optional,
  children,
}: {
  num: number;
  title: string;
  done?: boolean;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rg-step">
      <div className="rg-step-head">
        <span className={`rg-step-num${done ? " done" : ""}`}>
          {done ? <IconSvg d={Icons.check} size={12} /> : num}
        </span>
        <span className="rg-step-title">{title}</span>
        {hint && <span className="rg-step-hint">{hint}</span>}
        {optional && <span className="rg-step-hint">opcional</span>}
      </div>
      {children}
    </section>
  );
}

function EmployeeList({
  employees,
  loading,
  search,
  setSearch,
  onPick,
}: {
  employees: EmployeeItem[];
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  onPick: (e: EmployeeItem) => void;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.area.toLowerCase().includes(q)
    );
  }, [employees, search]);

  return (
    <>
      <div className="rg-emp-search">
        <IconSvg d={Icons.search} size={14} />
        <input
          placeholder="Buscar por nombre, correo o área…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      {loading ? (
        <div className="rg-emp-empty">Cargando empleados…</div>
      ) : (
        <div className="rg-emp-list">
          {filtered.length === 0 ? (
            <div className="rg-emp-empty">No se encontraron empleados</div>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp.employeeId}
                type="button"
                className="rg-emp-row"
                onClick={() => onPick(emp)}
              >
                <NovaAvatar name={emp.fullName} size={32} variant="plain" />
                <div className="rg-emp-row-main">
                  <div className="rg-emp-row-name">{emp.fullName}</div>
                  <div className="rg-emp-row-meta">{emp.email}</div>
                </div>
                {emp.area && <span className="rg-emp-chip">{emp.area}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="rg-toggle-row">
      <span>{label}</span>
      <span
        id={id}
        className={`toggle ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
      >
        <span className="toggle-knob" />
      </span>
    </label>
  );
}
