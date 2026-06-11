"use client";

import { useMemo, useState } from "react";
import { useMyRequests, useCancelRequest } from "@/hooks/use-requests";
import { useMyProfile } from "@/hooks/use-employee";
import { REASON_LABELS } from "@/lib/constants/reason-codes";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PageHeader } from "@/components/nova/page-header";
import { NovaModal } from "@/components/nova/modal";
import { NewRequestSheet } from "@/components/requests/new-request-sheet";
import type { ApprovalRequest } from "@/lib/types";
import { toast } from "sonner";

/* ============================================================
   Helpers
   ============================================================ */

function formatDate(s: string | undefined): string {
  if (!s) return "—";
  const d = s.length === 10 ? new Date(s + "T12:00:00") : new Date(s);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatShortDate(s: string | undefined): string {
  if (!s) return "";
  const d = s.length === 10 ? new Date(s + "T12:00:00") : new Date(s);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

/** Calculate inclusive workday count between two dates (Mon-Fri). */
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
    if (r.dateFrom === r.dateTo) return formatDate(r.dateFrom);
    return `${formatShortDate(r.dateFrom)} – ${formatShortDate(r.dateTo)}`;
  }
  if (r.effectiveDate) {
    if (r.startTime && r.endTime) {
      return `${formatShortDate(r.effectiveDate)} · ${r.startTime}-${r.endTime}`;
    }
    return formatDate(r.effectiveDate);
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
  { label: string; icon: React.ReactNode; iconBg: string; iconColor: string; cat: "vacation" | "leave" | "regularize" }
> = {
  VACATION: {
    label: "Vacaciones",
    icon: Icons.beach,
    iconBg: "var(--accent-soft)",
    iconColor: "var(--accent-strong)",
    cat: "vacation",
  },
  PERMISSION: {
    label: "Permiso",
    icon: Icons.coffee,
    iconBg: "color-mix(in srgb, var(--warn) 14%, transparent)",
    iconColor: "var(--warn)",
    cat: "leave",
  },
  REGULARIZATION_SINGLE: {
    label: "Regularización",
    icon: Icons.edit,
    iconBg: "var(--bg-subtle)",
    iconColor: "var(--text-secondary)",
    cat: "regularize",
  },
  REGULARIZATION_RANGE: {
    label: "Regularización",
    icon: Icons.edit,
    iconBg: "var(--bg-subtle)",
    iconColor: "var(--text-secondary)",
    cat: "regularize",
  },
};

const STATUS_META: Record<
  ApprovalRequest["status"],
  { label: string; pill: "success" | "warn" | "danger" | "muted" }
> = {
  PENDING: { label: "Pendiente", pill: "warn" },
  APPROVED: { label: "Aprobada", pill: "success" },
  REJECTED: { label: "Rechazada", pill: "danger" },
  CANCELLED: { label: "Cancelada", pill: "muted" },
};

/* ============================================================
   Request card — matches design's .approval-card
   ============================================================ */

function RequestCard({ r }: { r: ApprovalRequest }) {
  const cancel = useCancelRequest();
  const t = TYPE_META[r.requestType];
  const s = STATUS_META[r.status];
  const reason = REASON_LABELS[r.reasonCode] ?? r.reasonCode;
  const createdAt = r.createdAt ? formatShortDate(r.createdAt) : "";
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleCancel() {
    setConfirmOpen(false);
    try {
      await cancel.mutateAsync(r.RequestID);
      toast.success("Solicitud cancelada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar");
    }
  }

  return (
    <div className="approval-card">
      <div
        style={{
          width: 48,
          height: 48,
          background: t.iconBg,
          color: t.iconColor,
          borderRadius: "var(--r-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <IconSvg d={t.icon} size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{t.label}</span>
          <span className={`type-tag ${s.pill}`}>{s.label}</span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginTop: 4,
          }}
        >
          {dateRangeLabel(r)} ·{" "}
          <strong style={{ color: "var(--text-primary)" }}>{durationLabel(r)}</strong>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginTop: 4,
          }}
        >
          {r.reasonNote ? `"${r.reasonNote}"` : reason}
          {createdAt && ` · Solicitada el ${createdAt}`}
          {r.reviewedByName && ` · ${r.reviewedByName}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {r.status === "PENDING" && (
          <button
            type="button"
            className="btn outline btn-sm"
            onClick={() => setConfirmOpen(true)}
            disabled={cancel.isPending}
          >
            <IconSvg d={Icons.x} size={13} />
            {cancel.isPending ? "Cancelando…" : "Cancelar"}
          </button>
        )}
        <button type="button" className="btn ghost btn-sm" aria-label="Ver detalle">
          <IconSvg d={Icons.arrow} size={14} />
        </button>
      </div>

      <NovaModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cancelar solicitud"
        footer={
          <>
            <button type="button" className="btn outline" onClick={() => setConfirmOpen(false)}>
              Volver
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              <IconSvg d={Icons.x} size={14} /> Sí, cancelar
            </button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.55 }}>
          ¿Seguro que quieres cancelar tu solicitud de{" "}
          <strong style={{ color: "var(--text-primary)" }}>{t.label.toLowerCase()}</strong>?
        </p>
      </NovaModal>
    </div>
  );
}

/* ============================================================
   Tabs + counts
   ============================================================ */

type TabKey = "all" | "vacation" | "leave" | "regularize";

interface TabDef {
  key: TabKey;
  label: string;
  count: number;
}

/* ============================================================
   Page
   ============================================================ */

export default function MyRequestsPage() {
  const { data, isLoading } = useMyRequests();
  const { data: profile } = useMyProfile();
  const [tab, setTab] = useState<TabKey>("all");
  const [newOpen, setNewOpen] = useState(false);

  const requests = data?.requests ?? [];

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

  const tabs: TabDef[] = [
    { key: "all", label: "Todas", count: counts.all },
    { key: "vacation", label: "Vacaciones", count: counts.vacation },
    { key: "leave", label: "Permisos", count: counts.leave },
    { key: "regularize", label: "Regularizaciones", count: counts.regularize },
  ];

  // KPIs
  const vacationTotal = profile?.employee?.vacationTotal ?? 22;
  const vacationBalance = profile?.employee?.vacationBalance ?? 12;
  const currentYear = new Date().getFullYear();
  const permitsThisYear = requests.filter((r) => {
    if (r.requestType !== "PERMISSION") return false;
    if (r.status !== "APPROVED") return false;
    const d = r.effectiveDate ?? r.dateFrom;
    return d?.startsWith(String(currentYear));
  }).length;
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  // Permits total hours this year
  const permitsHoursTotal = requests
    .filter((r) => r.requestType === "PERMISSION" && r.status === "APPROVED" && r.startTime && r.endTime)
    .reduce((sum, r) => {
      const [sh, sm] = r.startTime!.split(":").map(Number);
      const [eh, em] = r.endTime!.split(":").map(Number);
      const mins = eh * 60 + em - sh * 60 - sm;
      return sum + Math.max(0, mins);
    }, 0);

  return (
    <>
      {/* Cap the content column so the header, KPIs, tabs and request rows
          don't stretch full-bleed on wide screens (the rows were sparse —
          content on the left, arrow shoved to the far right). */}
      <div className="rq-col">
      {/* PageHeader */}
      <PageHeader
        title="Mis solicitudes"
        subtitle="Historial completo y nuevas peticiones."
        actions={
          <button type="button" className="btn primary btn-md" onClick={() => setNewOpen(true)}>
            <IconSvg d={Icons.plus} size={14} /> Nueva solicitud
          </button>
        }
      />

      {/* 3 stat-mini KPIs */}
      <div className="fill-grid min-280" style={{ marginBottom: 20 }}>
        <div className="stat-mini">
          <div className="stat-mini-label">Vacaciones disponibles</div>
          <div className="stat-mini-value">
            {vacationBalance}
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
              /{vacationTotal}d
            </span>
          </div>
          <div
            style={{
              height: 5,
              background: "var(--bg-subtle)",
              borderRadius: 3,
              overflow: "hidden",
              marginTop: 8,
            }}
          >
            <div
              style={{
                width: vacationTotal > 0 ? `${(vacationBalance / vacationTotal) * 100}%` : "0%",
                height: "100%",
                background: "var(--accent)",
              }}
            />
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Permisos este año</div>
          <div className="stat-mini-value">{permitsThisYear}</div>
          <div className="stat-mini-delta" style={{ color: "var(--text-muted)" }}>
            {permitsHoursTotal > 0
              ? `${Math.round(permitsHoursTotal / 60)}h en total`
              : "—"}
          </div>
        </div>
        <div className="stat-mini">
          <div className="stat-mini-label">Pendientes de respuesta</div>
          <div className="stat-mini-value">{pendingCount}</div>
          <div className="stat-mini-delta" style={{ color: pendingCount > 0 ? "var(--warn)" : "var(--text-muted)" }}>
            {pendingCount > 0 ? "Esperando aprobación" : "Al día"}
          </div>
        </div>
      </div>

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

      {/* Request cards — self-filling grid (2–3 per row on wide screens)
          instead of one full-width row each (was: flex column). */}
      {isLoading ? (
        <div className="fill-grid min-440">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="approval-card"
              style={{ opacity: 0.5, animation: "pulse 1.5s infinite" }}
            >
              <div style={{ width: 48, height: 48, background: "var(--bg-subtle)", borderRadius: "var(--r-sm)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
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
          <div
            style={{
              padding: "60px 24px",
              textAlign: "center",
              background: "var(--bg-elevated)",
              border: "1px dashed var(--border)",
              borderRadius: "var(--r-lg)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--bg-subtle)",
                color: "var(--text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <IconSvg d={Icons.doc} size={22} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              {tab === "all" ? "Sin solicitudes" : "Nada en esta categoría"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, maxWidth: 360, margin: "4px auto 0" }}>
              {tab === "all"
                ? "Aún no has creado ninguna solicitud."
                : "Cambia de pestaña o crea una nueva solicitud."}
            </div>
            <button
              type="button"
              className="btn primary btn-md"
              style={{ marginTop: 18 }}
              onClick={() => setNewOpen(true)}
            >
              <IconSvg d={Icons.plus} size={14} /> Nueva solicitud
            </button>
          </div>
      ) : (
        <div className="fill-grid min-440">
          {filtered.map((r) => <RequestCard key={r.RequestID} r={r} />)}
        </div>
      )}

      </div>

      <NewRequestSheet open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  );
}
