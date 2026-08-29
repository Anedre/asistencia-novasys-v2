"use client";

/**
 * Email diagnostics.
 *
 * SES metrics are aggregate counters, so when invitations reported success but
 * never arrived there was no way to tell one message from another. This sends
 * one email to the admin's own address and shows the SES MessageId, the sender
 * actually used and the real recipient — enough to trace a single message
 * instead of guessing from totals.
 */

import { useState } from "react";
import { IconSvg, Icons } from "@/components/nova/icons";
import { Spinner } from "@/components/nova/spinner";

interface TestResult {
  sent?: boolean;
  messageId?: string;
  error?: string;
  from?: string;
  to?: string;
  region?: string;
  sentAt?: string;
  failure?: string;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  fontSize: 11,
  lineHeight: 1.7,
  wordBreak: "break-all",
};

const labelStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  minWidth: 78,
  flexShrink: 0,
};

export function EmailTestPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function handleTest() {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email-test", { method: "POST" });
      const payload = await res.json();
      if (!res.ok) {
        setResult({ failure: payload?.error || `HTTP ${res.status}` });
      } else {
        setResult(payload);
      }
    } catch (err) {
      setResult({ failure: err instanceof Error ? err.message : "Error de red" });
    } finally {
      setRunning(false);
    }
  }

  const ok = result?.sent === true;

  return (
    <div className="table-wrap" style={{ marginBottom: 20 }}>
      <div
        className="table-toolbar"
        style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Diagnóstico de correo
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Envía un correo de prueba a tu propia dirección y muestra el identificador
            que SES devuelve, para poder rastrear ese mensaje concreto.
          </div>
        </div>
        <button
          type="button"
          className="btn outline btn-sm"
          onClick={handleTest}
          disabled={running}
          style={{ flexShrink: 0 }}
        >
          {running ? (
            <>
              <Spinner size={13} /> Enviando…
            </>
          ) : (
            <>
              <IconSvg d={Icons.mail} size={13} /> Enviar correo de prueba
            </>
          )}
        </button>
      </div>

      {result && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "10px 14px",
            background: result.failure
              ? "color-mix(in srgb, var(--danger) 8%, transparent)"
              : ok
                ? "color-mix(in srgb, var(--success) 8%, transparent)"
                : "color-mix(in srgb, var(--warning) 10%, transparent)",
          }}
        >
          {result.failure ? (
            <div style={{ fontSize: 11.5, color: "var(--danger)", fontWeight: 600 }}>
              No se pudo ejecutar la prueba: {result.failure}
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: ok ? "var(--success)" : "var(--warning)",
                }}
              >
                {ok
                  ? "SES aceptó el mensaje"
                  : `SES rechazó el envío: ${result.error ?? "error desconocido"}`}
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Para</span>
                <span style={{ color: "var(--text-primary)" }}>{result.to}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Remitente</span>
                <span style={{ color: "var(--text-primary)" }}>{result.from}</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Región</span>
                <span style={{ color: "var(--text-secondary)" }}>{result.region}</span>
              </div>
              {result.messageId && (
                <div style={rowStyle}>
                  <span style={labelStyle}>MessageId</span>
                  <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    {result.messageId}
                  </span>
                </div>
              )}
              {ok && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  Aceptado no es lo mismo que recibido: revisa la bandeja y el spam del
                  destinatario.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
