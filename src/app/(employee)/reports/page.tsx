"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PageHeader } from "@/components/nova/page-header";
import { NovaWeekPicker, currentISOWeek } from "@/components/nova/week-picker";
import { NovaMonthPicker, currentMonth } from "@/components/nova/month-picker";

type TabKey = "weekly" | "monthly";

export default function ReportsPage() {
  const { data: session } = useSession();
  const employeeId = (session?.user as { employeeId?: string })?.employeeId ?? "";

  const [tab, setTab] = useState<TabKey>("weekly");
  const [week, setWeek] = useState(currentISOWeek());
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep last generated URL for fallback if popup was blocked
  const [lastReportUrl, setLastReportUrl] = useState<string | null>(null);
  const [lastReportLabel, setLastReportLabel] = useState<string>("");

  async function handleGenerate(type: TabKey) {
    setLoading(true);
    setError(null);
    setLastReportUrl(null);

    const body =
      type === "weekly"
        ? { employeeId, reportType: "weekly", week }
        : { employeeId, reportType: "monthly", month };

    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al generar el reporte");
      }

      if (data.url) {
        const win = window.open(data.url, "_blank");
        // Save URL regardless so a manual fallback is always available
        setLastReportUrl(data.url);
        setLastReportLabel(type === "weekly" ? `Semana ${week}` : `Mes ${month}`);
        if (!win) {
          setError("El navegador bloqueó la descarga. Usa el botón de descarga manual abajo.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* PageHeader */}
      <PageHeader
        title="Reportes"
        subtitle="Descarga tus reportes de asistencia en PDF."
      />

      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="panel-title">Generar Reporte</div>
        <div className="panel-sub" style={{ marginBottom: 16 }}>
          Elige el periodo y descarga tu reporte.
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === "weekly" ? "active" : ""}`}
            onClick={() => setTab("weekly")}
          >
            Semanal
          </button>
          <button
            type="button"
            className={`tab ${tab === "monthly" ? "active" : ""}`}
            onClick={() => setTab("monthly")}
          >
            Mensual
          </button>
        </div>

        {tab === "weekly" && (
          <>
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label className="form-label" htmlFor="weekSelect">
                Semana
              </label>
              <NovaWeekPicker id="weekSelect" value={week} onChange={setWeek} />
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => handleGenerate("weekly")}
              disabled={loading || !week}
            >
              <IconSvg d={Icons.download} size={14} />
              {loading ? "Generando…" : "Generar Reporte Semanal"}
            </button>
          </>
        )}

        {tab === "monthly" && (
          <>
            <div className="form-group" style={{ maxWidth: 280 }}>
              <label className="form-label" htmlFor="monthSelect">
                Mes
              </label>
              <NovaMonthPicker id="monthSelect" value={month} onChange={setMonth} />
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => handleGenerate("monthly")}
              disabled={loading || !month}
            >
              <IconSvg d={Icons.download} size={14} />
              {loading ? "Generando…" : "Generar Reporte Mensual"}
            </button>
          </>
        )}

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: "var(--r)",
              border:
                "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
              background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              color: "var(--danger)",
              fontSize: 13,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <IconSvg d={Icons.alert} size={15} />
            <div style={{ flex: 1 }}>
              <div>{error}</div>
              <button
                type="button"
                onClick={() => handleGenerate(tab)}
                disabled={loading}
                style={{
                  marginTop: 8,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: "var(--danger)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {loading ? "Reintentando…" : "Reintentar"}
              </button>
            </div>
          </div>
        )}

        {/* Manual download fallback (popup blocked) */}
        {lastReportUrl && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              borderRadius: "var(--r)",
              border: "1px solid color-mix(in srgb, var(--success) 40%, transparent)",
              background: "color-mix(in srgb, var(--success) 8%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <IconSvg d={Icons.download} size={16} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Reporte listo: {lastReportLabel}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Click para descargar</div>
              </div>
            </div>
            <a
              href={lastReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn primary btn-sm"
              style={{ textDecoration: "none" }}
            >
              <IconSvg d={Icons.download} size={13} /> Descargar
            </a>
          </div>
        )}
      </div>
    </>
  );
}
