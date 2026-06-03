"use client";

/**
 * Brand panels — use the original design's class names and HTML structure.
 * CSS lives in `app/(auth)/auth-design.css` (scoped under `.nva-auth`).
 *
 * Components:
 * - DefaultBrandPanel: Novaassistance marketing (login, forgot, register)
 * - TenantBrandPanel: for /register?invite=TOKEN with tenant branding
 * - CompanyPreviewPanel: live preview for /register-company
 */

import Image from "next/image";

/* ─────────────────────────────────────────── Logo ── */

export function NovaDesignLogo({ size = 28, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" fill="var(--logo-bg)" />
        <circle
          cx="20"
          cy="20"
          r="13"
          stroke="var(--logo-ring)"
          strokeWidth="0.7"
          strokeDasharray="2 2.5"
          opacity="0.7"
        />
        <circle cx="20" cy="20" r="8" stroke="var(--accent)" strokeWidth="0.7" opacity="0.9" />
        <path
          d="M20 16 L21.6 19.2 L24.8 20 L21.6 20.8 L20 24 L18.4 20.8 L15.2 20 L18.4 19.2 Z"
          fill="var(--accent)"
        />
        <circle cx="33" cy="20" r="1.4" fill="var(--accent)" />
        <circle cx="20" cy="33" r="1.1" fill="var(--accent)" opacity="0.6" />
      </svg>
      {showText && (
        <div style={{ lineHeight: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-primary)",
            }}
          >
            NOVA
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.18em",
              color: "var(--accent)",
              marginTop: 2,
            }}
          >
            ASSISTANCE
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── BrandOrbital (decorative) ── */

function BrandOrbital() {
  return (
    <div
      style={{
        position: "absolute",
        right: "-80px",
        bottom: "-80px",
        opacity: 0.5,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <svg width="400" height="400" viewBox="0 0 400 400" fill="none">
        <circle
          cx="200"
          cy="200"
          r="180"
          stroke="rgba(63,190,255,0.2)"
          strokeWidth="1"
          strokeDasharray="3 6"
        />
        <circle cx="200" cy="200" r="130" stroke="rgba(63,190,255,0.3)" strokeWidth="1" />
        <circle cx="200" cy="200" r="80" stroke="rgba(63,190,255,0.15)" strokeWidth="1" />
        <g style={{ transformOrigin: "200px 200px" }}>
          <circle cx="380" cy="200" r="6" fill="#3FBEFF" />
          <circle cx="380" cy="200" r="14" fill="#3FBEFF" opacity="0.2" />
        </g>
        <g style={{ transformOrigin: "200px 200px" }}>
          <circle cx="200" cy="70" r="4" fill="#3FBEFF" opacity="0.7" />
          <circle cx="70" cy="200" r="3" fill="#fff" opacity="0.5" />
        </g>
        <circle cx="200" cy="200" r="40" fill="#3FBEFF" opacity="0.18" />
        <path
          d="M200 175 L208 192 L225 200 L208 208 L200 225 L192 208 L175 200 L192 192 Z"
          fill="#3FBEFF"
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────── BenefitIcon SVGs ── */

const PinIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-7-7-7-12a7 7 0 0114 0c0 5-7 12-7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
);

const ShieldIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
  </svg>
);

const PulseIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 12h4l2-7 4 14 2-7h6" />
  </svg>
);

/* ─────────────────────────────────────────── DefaultBrandPanel ── */

export function DefaultBrandPanel() {
  return (
    <div className="auth-brand">
      <div className="auth-brand-content">
        <NovaDesignLogo size={36} />
        <h1 className="auth-tagline">
          Tu equipo,
          <br />
          en órbita.
        </h1>
        <p className="auth-tagline-sub">
          Novaassistance es el sistema de asistencia para empresas modernas.
          Marcaciones con GPS, turnos flexibles, reportes en tiempo real — todo
          en un solo lugar.
        </p>
        <div className="auth-features">
          <div className="auth-feature">
            <div className="auth-feature-icon">
              <PinIcon size={16} />
            </div>
            <div>
              <div className="auth-feature-title">GPS y geocercas</div>
              <div className="auth-feature-meta">Valida marcaciones por ubicación</div>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon">
              <ShieldIcon size={16} />
            </div>
            <div>
              <div className="auth-feature-title">Multi-empresa</div>
              <div className="auth-feature-meta">Una plataforma, cualquier organización</div>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon">
              <PulseIcon size={16} />
            </div>
            <div>
              <div className="auth-feature-title">Analítica en vivo</div>
              <div className="auth-feature-meta">Decisiones con datos al instante</div>
            </div>
          </div>
        </div>
      </div>
      <BrandOrbital />
      <div className="auth-brand-foot">
        <span>© {new Date().getFullYear()} Novaassistance</span>
        <span aria-hidden>·</span>
        <a
          href="https://novaassistance.com/legal/terms"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit" }}
        >
          Términos
        </a>
        <span aria-hidden>·</span>
        <a
          href="https://novaassistance.com/legal/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit" }}
        >
          Privacidad
        </a>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── TenantBrandPanel ── */

interface TenantPanelProps {
  tenantName: string;
  tenantLogoUrl?: string | null;
  role?: string;
  area?: string;
  inviterName?: string;
}

export function TenantBrandPanel({
  tenantName,
  tenantLogoUrl,
  role,
  area,
  inviterName,
}: TenantPanelProps) {
  return (
    <div className="auth-brand">
      <div className="auth-brand-content">
        <NovaDesignLogo size={36} />
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 32,
            padding: "5px 12px",
            borderRadius: 999,
            border: "1px solid rgba(63,190,255,0.3)",
            background: "rgba(63,190,255,0.1)",
            color: "var(--accent)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
          Invitación recibida
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
          {tenantLogoUrl ? (
            <div
              style={{
                position: "relative",
                width: 72,
                height: 72,
                borderRadius: 16,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <Image src={tenantLogoUrl} alt={tenantName} fill className="object-contain p-2" sizes="72px" />
            </div>
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(63,190,255,0.3)",
                background: "rgba(63,190,255,0.08)",
                fontSize: 28,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {tenantName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="auth-tagline" style={{ fontSize: 28, margin: 0 }}>
              {tenantName}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(241,245,249,0.65)" }}>
              Te está esperando en Novaassistance
            </p>
          </div>
        </div>

        <p className="auth-tagline-sub" style={{ marginTop: 20 }}>
          {inviterName ? `${inviterName} te invitó ` : "Has sido invitado "}
          a unirte como <strong style={{ color: "#fff" }}>{role ?? "miembro"}</strong>
          {area && (
            <>
              {" "}del área <strong style={{ color: "#fff" }}>{area}</strong>
            </>
          )}
          . Crea tu cuenta para empezar.
        </p>
      </div>
      <BrandOrbital />
      <div className="auth-brand-foot">
        <span>Powered by Novaassistance · Orbital Control</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────── CompanyPreviewPanel ── */

interface CompanyPreviewProps {
  companyName: string;
  companySlug: string;
}

export function CompanyPreviewPanel({ companyName, companySlug }: CompanyPreviewProps) {
  const name = companyName.trim() || "Tu empresa";
  const slug = companySlug.trim() || "tu-empresa";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="auth-brand">
      <div className="auth-brand-content">
        <NovaDesignLogo size={36} />

        <h1 className="auth-tagline" style={{ marginTop: 28 }}>
          Nueva empresa
          <br />
          en Novaassistance.
        </h1>
        <p className="auth-tagline-sub">Así se verá tu empresa en cuestión de minutos.</p>

        <div
          style={{
            marginTop: 28,
            padding: 20,
            borderRadius: 16,
            border: "1px solid rgba(63,190,255,0.2)",
            background: "rgba(63,190,255,0.06)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "linear-gradient(135deg, #3FBEFF, #0096D6)",
                color: "#fff",
                fontSize: 22,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initial}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
                {name}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(241,245,249,0.55)", fontFamily: "var(--font-mono)" }}>
                novasys.pe/{slug}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { l: "Plan", v: "Free" },
              { l: "Empleados", v: "Hasta 25" },
              { l: "Trial", v: "Sin límite" },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  padding: 8,
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(241,245,249,0.5)" }}>
                  {s.l}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: "#fff" }}>{s.v}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", margin: 0 }}>
            En 5 pasos estás listo
          </h2>
          <ol style={{ marginTop: 12, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "rgba(241,245,249,0.7)" }}>
            {[
              "Crea tu empresa y cuenta de admin",
              "Personaliza tu logo y colores",
              "Configura horario y feriados",
              "Invita a tus empleados",
              "Empieza a usar el sistema",
            ].map((step, i) => (
              <li key={step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: "1px solid rgba(63,190,255,0.3)",
                    background: "rgba(63,190,255,0.1)",
                    color: "var(--accent)",
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <BrandOrbital />
      <div className="auth-brand-foot">
        <span>Tu empresa queda operativa en minutos</span>
      </div>
    </div>
  );
}
