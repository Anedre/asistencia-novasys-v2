"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { usePendingRequests, useReviewRequest } from "@/hooks/use-requests";
import { REASON_LABELS } from "@/lib/constants/reason-codes";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { NovaModal } from "@/components/nova/modal";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/nova/page-header";
import type { ApprovalRequest } from "@/lib/types";

type Decision = { action: "APPROVE" | "REJECT"; reviewerNote?: string };

/* ============================================================
   Helpers
   ============================================================ */

function formatShortDate(s: string | undefined): string {
  if (!s) return "—";
  const d = s.length === 10 ? new Date(s + "T12:00:00") : new Date(s);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function workdaysBetween(from: string, to: string): number {
  const start = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function dateRangeLabel(r: ApprovalRequest): string {
  if (r.dateFrom && r.dateTo) {
    if (r.dateFrom === r.dateTo) return formatShortDate(r.dateFrom);
    return `${formatShortDate(r.dateFrom)} – ${formatShortDate(r.dateTo)}`;
  }
  if (r.effectiveDate) {
    if (r.startTime && r.endTime) {
      return `${formatShortDate(r.effectiveDate)} · ${r.startTime}-${r.endTime}`;
    }
    return formatShortDate(r.effectiveDate);
  }
  return "—";
}

function durationLabel(r: ApprovalRequest): string {
  if (r.requestType === "VACATION" && r.dateFrom && r.dateTo) {
    const d = workdaysBetween(r.dateFrom, r.dateTo);
    return d === 1 ? "1 día hábil" : `${d} días hábiles`;
  }
  if (r.requestType === "PERMISSION") {
    if (r.startTime && r.endTime) {
      const [sh, sm] = r.startTime.split(":").map(Number);
      const [eh, em] = r.endTime.split(":").map(Number);
      const mins = eh * 60 + em - sh * 60 - sm;
      if (mins > 0 && mins < 600) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h} horas`) : `${m} min`;
      }
    }
    return "1 día";
  }
  if (r.requestType === "REGULARIZATION_SINGLE") return "1 día";
  if (r.requestType === "REGULARIZATION_RANGE" && r.dateFrom && r.dateTo) {
    const d = workdaysBetween(r.dateFrom, r.dateTo);
    return `${d} días`;
  }
  return "—";
}

const TYPE_META: Record<
  ApprovalRequest["requestType"],
  { label: string; cls: string; cat: "vacation" | "leave" | "regularize" }
> = {
  VACATION: { label: "Vacaciones", cls: "accent", cat: "vacation" },
  PERMISSION: { label: "Permiso", cls: "warn", cat: "leave" },
  REGULARIZATION_SINGLE: { label: "Regularización", cls: "muted", cat: "regularize" },
  REGULARIZATION_RANGE: { label: "Regularización", cls: "muted", cat: "regularize" },
};

type TabKey = "all" | "vacation" | "leave" | "regularize";

/* ============================================================
   Approval card
   ============================================================ */

function ApprovalCard({
  r,
  onDecide,
}: {
  r: ApprovalRequest;
  onDecide: (r: ApprovalRequest, action: "APPROVE" | "REJECT", reviewerNote?: string) => void;
}) {
  const meta = TYPE_META[r.requestType];
  const reason = REASON_LABELS[r.reasonCode] ?? r.reasonCode;
  const isVacationLong =
    r.requestType === "VACATION" &&
    r.dateFrom &&
    r.dateTo &&
    workdaysBetween(r.dateFrom, r.dateTo) >= 5;
  const isUrgent = isVacationLong;
  const area = (r as ApprovalRequest & { area?: string }).area ?? "";

  const [mode, setMode] = useState<null | "approve" | "reject">(null);
  const [note, setNote] = useState("");

  function closeModal() {
    setMode(null);
    setNote("");
  }
  function confirmApprove() {
    setMode(null);
    onDecide(r, "APPROVE");
  }
  function confirmReject() {
    const n = note.trim();
    if (!n) return;
    closeModal();
    onDecide(r, "REJECT", n);
  }

  return (
    <div className="approval-card">
      <NovaAvatar name={r.employeeName} size={44} variant="accent" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
          <span className="pending-who" style={{ fontSize: 14 }}>
            {r.employeeName}
          </span>
          <span className={`type-tag ${meta.cls}`}>{meta.label}</span>
          {isUrgent && <span className="type-tag danger">Urgente</span>}
          {area && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{area}</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
          {dateRangeLabel(r)} · <strong>{durationLabel(r)}</strong>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginTop: 4,
            fontStyle: "italic",
          }}
        >
          &quot;{r.reasonNote ?? reason}&quot;
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          className="btn outline btn-sm"
          onClick={() => setMode("reject")}
        >
          <IconSvg d={Icons.x} size={13} /> Rechazar
        </button>
        <button
          type="button"
          className="btn primary btn-sm"
          onClick={() => setMode("approve")}
        >
          <IconSvg d={Icons.check} size={13} /> Aprobar
        </button>
      </div>

      {/* Approve confirmation */}
      <NovaModal
        open={mode === "approve"}
        onClose={closeModal}
        title="Aprobar solicitud"
        footer={
          <>
            <button type="button" className="btn outline" onClick={closeModal}>
              Cancelar
            </button>
            <button type="button" className="btn success" onClick={confirmApprove}>
              <IconSvg d={Icons.check} size={14} /> Aprobar
            </button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>
          ¿Confirmas aprobar la solicitud de{" "}
          <strong style={{ color: "var(--text-primary)" }}>{r.employeeName}</strong>{" "}
          ({meta.label.toLowerCase()} · {dateRangeLabel(r)})?
        </p>
      </NovaModal>

      {/* Reject reason */}
      <NovaModal
        open={mode === "reject"}
        onClose={closeModal}
        title="Rechazar solicitud"
        footer={
          <>
            <button type="button" className="btn outline" onClick={closeModal}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={confirmReject}
              disabled={!note.trim()}
            >
              <IconSvg d={Icons.x} size={14} /> Rechazar
            </button>
          </>
        }
      >
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor={`reject-${r.RequestID}`}>
            Motivo del rechazo <span className="req">*</span>
          </label>
          <textarea
            id={`reject-${r.RequestID}`}
            className="form-textarea"
            autoFocus
            placeholder="Explica brevemente por qué se rechaza…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />
          <span className="form-hint">El empleado verá este motivo. Es obligatorio.</span>
        </div>
      </NovaModal>
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */

export default function AdminApprovalsPage() {
  const { data, isLoading } = usePendingRequests();
  const review = useReviewRequest();
  const [tab, setTab] = useState<TabKey>("all");

  // Decisions taken but still inside the "Deshacer" window — optimistically
  // hidden from the list and only committed to the server once it elapses.
  const [pending, setPending] = useState<Record<string, Decision>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const decisionsRef = useRef(pending);
  decisionsRef.current = pending;

  const commit = useCallback(
    (id: string, action: "APPROVE" | "REJECT", reviewerNote?: string) => {
      review.mutate(
        { requestId: id, action, reviewerNote },
        {
          onError: (e) =>
            toast.error(e instanceof Error ? e.message : "No se pudo guardar la decisión"),
        }
      );
    },
    [review]
  );

  const scheduleDecision = useCallback(
    (r: ApprovalRequest, action: "APPROVE" | "REJECT", reviewerNote?: string) => {
      const id = r.RequestID;
      setPending((p) => ({ ...p, [id]: { action, reviewerNote } }));
      if (timers.current[id]) clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => {
        delete timers.current[id];
        setPending((p) => {
          const n = { ...p };
          delete n[id];
          return n;
        });
        commit(id, action, reviewerNote);
      }, 5000);
      toast(action === "APPROVE" ? "Solicitud aprobada" : "Solicitud rechazada", {
        description: r.employeeName,
        duration: 5000,
        action: {
          label: "Deshacer",
          onClick: () => {
            if (timers.current[id]) {
              clearTimeout(timers.current[id]);
              delete timers.current[id];
            }
            setPending((p) => {
              const n = { ...p };
              delete n[id];
              return n;
            });
          },
        },
      });
    },
    [commit]
  );

  // Flush still-pending decisions on unmount so navigating away doesn't drop them.
  useEffect(() => {
    return () => {
      Object.entries(decisionsRef.current).forEach(([id, dec]) => {
        if (timers.current[id]) clearTimeout(timers.current[id]);
        commit(id, dec.action, dec.reviewerNote);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requests = useMemo(
    () => (data?.requests ?? []).filter((r) => !pending[r.RequestID]),
    [data, pending]
  );

  const filtered = useMemo(() => {
    if (tab === "all") return requests;
    return requests.filter((r) => TYPE_META[r.requestType].cat === tab);
  }, [requests, tab]);

  const counts = useMemo(() => {
    const c = { all: requests.length, vacation: 0, leave: 0, regularize: 0 };
    requests.forEach((r) => {
      const cat = TYPE_META[r.requestType].cat;
      c[cat]++;
    });
    return c;
  }, [requests]);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "Todas", count: counts.all },
    { key: "vacation", label: "Vacaciones", count: counts.vacation },
    { key: "leave", label: "Permisos", count: counts.leave },
    { key: "regularize", label: "Regularizaciones", count: counts.regularize },
  ];

  return (
    <>
      {/* PageHeader */}
      <PageHeader
        title="Aprobaciones"
        subtitle="Solicitudes pendientes de tu decisión."
      />

      {/* Tabs */}
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* List — self-filling grid so cards pack 2–3 per row on wide screens
          instead of one full-width row each (was: flex column). */}
      {isLoading ? (
        <div className="fill-grid min-440">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="approval-card" style={{ opacity: 0.5 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: "var(--bg-subtle)",
                  borderRadius: "50%",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, width: "30%", background: "var(--bg-subtle)", borderRadius: 4 }} />
                <div
                  style={{
                    height: 10,
                    width: "60%",
                    background: "var(--bg-subtle)",
                    borderRadius: 4,
                    marginTop: 8,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Icons.check}
          title={tab === "all" ? "¡Todo al día!" : "Sin solicitudes en esta categoría"}
          description={
            tab === "all"
              ? "No hay solicitudes pendientes de aprobación. Cuando tu equipo cree solicitudes, aparecerán aquí."
              : "Cambia de pestaña para ver otras solicitudes (vacaciones, permisos o regularizaciones)."
          }
        />
      ) : (
        <div className="fill-grid min-440">
          {filtered.map((r) => (
            <ApprovalCard key={r.RequestID} r={r} onDecide={scheduleDecision} />
          ))}
        </div>
      )}
    </>
  );
}
