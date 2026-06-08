"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconSvg, Icons } from "@/components/nova/icons";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/nova/page-header";
import type {
  AuditEntry,
  AuditEntityType,
  AuditListResult,
} from "@/lib/types/audit";

const ENTITY_LABELS: Record<AuditEntityType | "ALL", string> = {
  ALL: "Todas las entidades",
  DAILY_SUMMARY: "Asistencia / Regularización",
  APPROVAL_REQUEST: "Solicitudes",
  EMPLOYEE: "Empleados",
  INVITATION: "Invitaciones",
  HR_EVENT: "RRHH",
  HR_DOCUMENT: "Documentos RRHH",
  TENANT_SETTINGS: "Configuración",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Creado",
  UPDATE: "Modificado",
  DELETE: "Eliminado",
  APPROVE: "Aprobado",
  REJECT: "Rechazado",
  BULK_REGULARIZE: "Regularización en bloque",
  REVERT: "Revertido",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function actionTagClass(action: string): string {
  if (action === "DELETE" || action === "REJECT") return "danger";
  if (action === "REVERT") return "muted";
  if (action === "APPROVE") return "success";
  if (action === "CREATE") return "accent";
  return "warn";
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entityFilter, setEntityFilter] = useState<AuditEntityType | "ALL">(
    "ALL"
  );
  const [hideReverted, setHideReverted] = useState(false);

  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (cursor?: string) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (entityFilter !== "ALL") params.set("entityType", entityFilter);
        if (hideReverted) params.set("hideReverted", "true");
        if (cursor) params.set("cursor", cursor);
        params.set("limit", "50");

        const res = await fetch(`/api/admin/audit?${params.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }
        const data = (await res.json()) as AuditListResult;
        if (cursor) {
          setEntries((prev) => [...prev, ...data.items]);
        } else {
          setEntries(data.items);
        }
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [entityFilter, hideReverted]
  );

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const grouped = useMemo(() => {
    // Collapse rows that share a groupId under the summary row, so the table
    // shows one "bulk" entry instead of N children.
    const seenGroups = new Set<string>();
    const out: AuditEntry[] = [];
    for (const e of entries) {
      if (e.groupId && !e.isGroupSummary) {
        if (seenGroups.has(e.groupId)) continue;
        // If we haven't seen the summary yet, still show this child.
      }
      if (e.groupId && e.isGroupSummary) {
        seenGroups.add(e.groupId);
      }
      out.push(e);
    }
    return out;
  }, [entries]);

  async function handleRevert() {
    if (!selected) return;
    setReverting(true);
    setRevertError(null);
    try {
      const url = selected.isGroupSummary && selected.groupId
        ? `/api/admin/audit/group/${encodeURIComponent(selected.groupId)}/revert`
        : `/api/admin/audit/${encodeURIComponent(selected.AuditID)}/revert`;

      const res = await fetch(url, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || body.message || `Error ${res.status}`);
      }
      setConfirmOpen(false);
      setSelected(null);
      await loadPage();
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : "Error al revertir");
    } finally {
      setReverting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Historial de cambios"
        subtitle="Revisa y deshace acciones de administración. Se guardan los últimos 90 días."
      />

      <div className="panel">
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div className="form-group" style={{ marginBottom: 0, minWidth: 240 }}>
              <label className="form-label" htmlFor="entity-filter">
                Entidad
              </label>
              <select
                id="entity-filter"
                className="form-select"
                value={entityFilter}
                onChange={(e) =>
                  setEntityFilter(e.target.value as AuditEntityType | "ALL")
                }
              >
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <label
              htmlFor="hide-reverted"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--text-secondary)",
                cursor: "pointer",
                marginBottom: 6,
              }}
            >
              <span
                id="hide-reverted"
                className={`toggle ${hideReverted ? "on" : ""}`}
                onClick={() => setHideReverted((v) => !v)}
                role="switch"
                aria-checked={hideReverted}
                tabIndex={0}
              >
                <span className="toggle-knob" />
              </span>
              Ocultar revertidos
            </label>
          </div>
          <button
            type="button"
            className="btn outline btn-sm"
            onClick={() => loadPage()}
            disabled={loading}
          >
            {loading && <IconSvg d={Icons.history} size={13} />}
            Refrescar
          </button>
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: "var(--r)",
              border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--danger)",
              marginBottom: 12,
            }}
          >
            <IconSvg d={Icons.alert} size={14} />
            {error}
          </div>
        )}

        {loading && entries.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 0",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            Cargando…
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={Icons.history}
            title="Sin entradas"
            description="No hay entradas que coincidan con los filtros. Prueba ampliar el rango de fechas o quitar la entidad seleccionada."
          />
        ) : (
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {grouped.map((e) => (
              <AuditRow
                key={e.AuditID}
                entry={e}
                onSelect={() => setSelected(e)}
              />
            ))}
          </div>
        )}

        {nextCursor && (
          <div style={{ paddingTop: 16, textAlign: "center" }}>
            <button
              type="button"
              className="btn outline btn-sm"
              onClick={() => loadPage(nextCursor)}
              disabled={loadingMore}
            >
              {loadingMore ? "Cargando…" : "Cargar más"}
            </button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && !confirmOpen && (
        <div
          className="sheet-backdrop"
          onClick={() => setSelected(null)}
        >
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 600 }}
          >
            <div className="sheet-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className={`type-tag ${actionTagClass(selected.action)}`}>
                  {ACTION_LABELS[selected.action] ?? selected.action}
                </span>
                <h3 className="sheet-title">{selected.entityLabel}</h3>
              </div>
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={() => setSelected(null)}
                aria-label="Cerrar"
              >
                <IconSvg d={Icons.x} size={14} />
              </button>
            </div>
            <div className="sheet-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                Por <strong style={{ color: "var(--text-primary)" }}>{selected.actorName}</strong> ·{" "}
                {formatDate(selected.createdAt)}
              </p>

              {selected.reason && (
                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Motivo
                  </p>
                  <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {selected.reason}
                  </p>
                </div>
              )}

              {selected.revertedAt && (
                <div
                  style={{
                    borderRadius: "var(--r)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle)",
                    padding: "10px 12px",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  Esta entrada ya fue revertida el {formatDate(selected.revertedAt)}.
                </div>
              )}

              {selected.isGroupSummary ? (
                <div
                  style={{
                    borderRadius: "var(--r)",
                    border: "1px solid var(--border)",
                    padding: "12px",
                    fontSize: 13,
                    marginBottom: 16,
                  }}
                >
                  Operación en bloque con {selected.groupSize ?? "varias"}{" "}
                  entradas. Al revertir, se deshace todo el grupo en conjunto.
                </div>
              ) : (
                <DiffPanel diff={selected.diff} />
              )}
            </div>
            <div className="sheet-foot">
              <button
                type="button"
                className="btn outline"
                onClick={() => setSelected(null)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={!!selected.revertedAt}
                onClick={() => setConfirmOpen(true)}
              >
                <IconSvg d={Icons.history} size={13} />
                Revertir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmOpen && (
        <div
          className="sheet-backdrop"
          onClick={() => {
            setConfirmOpen(false);
            setRevertError(null);
          }}
        >
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <div className="sheet-head">
              <h3 className="sheet-title">Confirmar revert</h3>
              <button
                type="button"
                className="btn ghost btn-sm"
                onClick={() => {
                  setConfirmOpen(false);
                  setRevertError(null);
                }}
                aria-label="Cerrar"
              >
                <IconSvg d={Icons.x} size={14} />
              </button>
            </div>
            <div className="sheet-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                Esta acción restaurará el estado anterior del registro. Se
                creará una nueva entrada en el historial indicando el revert.
                Esta operación también puede ser deshecha.
              </p>

              {revertError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    borderRadius: "var(--r)",
                    border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                    background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "var(--danger)",
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: 2 }}>
                    <IconSvg d={Icons.alert} size={14} />
                  </span>
                  <span>{revertError}</span>
                </div>
              )}
            </div>
            <div className="sheet-foot">
              <button
                type="button"
                className="btn outline"
                onClick={() => setConfirmOpen(false)}
                disabled={reverting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={handleRevert}
                disabled={reverting}
              >
                {reverting ? "Revirtiendo…" : "Sí, revertir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

function AuditRow({
  entry,
  onSelect,
}: {
  entry: AuditEntry;
  onSelect: () => void;
}) {
  const reverted = !!entry.revertedAt;
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: 12,
        padding: "12px 8px",
        textAlign: "left",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer",
        transition: "background 0.12s",
        fontFamily: "inherit",
        color: "inherit",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div
        style={{
          width: 96,
          flexShrink: 0,
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        {formatDate(entry.createdAt)}
      </div>
      <div style={{ width: 156, flexShrink: 0 }}>
        <span className={`type-tag ${actionTagClass(entry.action)}`}>
          {ACTION_LABELS[entry.action] ?? entry.action}
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.entityLabel}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.actorName}
          {entry.isGroupSummary && entry.groupSize
            ? ` · ${entry.groupSize} día(s)`
            : ""}
          {entry.reason ? ` · ${entry.reason}` : ""}
        </p>
      </div>
      {reverted && (
        <span className="type-tag muted" style={{ flexShrink: 0 }}>
          Revertido
        </span>
      )}
    </button>
  );
}

// ─── Diff ───────────────────────────────────────────────────────────────────

function DiffPanel({ diff }: { diff: AuditEntry["diff"] }) {
  const entries = Object.entries(diff);
  if (entries.length === 0) {
    return (
      <div
        style={{
          borderRadius: "var(--r)",
          border: "1px solid var(--border)",
          padding: 12,
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        Sin cambios detectables entre el antes y el después.
      </div>
    );
  }
  return (
    <div
      style={{
        overflow: "hidden",
        borderRadius: "var(--r)",
        border: "1px solid var(--border)",
      }}
    >
      <table className="table cards" style={{ fontSize: 12 }}>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Antes</th>
            <th>Después</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([field, change]) => (
            <tr key={field}>
              <td className="tcell-mono" data-label="Campo" style={{ fontSize: 11 }}>
                {field}
              </td>
              <td data-label="Antes" style={{ fontSize: 11, color: "var(--danger)" }}>
                {formatValue(change.from)}
              </td>
              <td data-label="Después" style={{ fontSize: 11, color: "var(--success)" }}>
                {formatValue(change.to)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
