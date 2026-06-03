/**
 * Logo lockup matching the design system's Logo.
 * Uses CSS variables --logo-bg, --logo-ring, --accent, --text-primary that
 * are set by the `.nva-app` scope.
 */

interface LogoProps {
  size?: number;
  showText?: boolean;
}

export function NovaLogo({ size = 28, showText = true }: LogoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
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
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-primary)" }}>
            NOVA
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.18em", color: "var(--accent)", marginTop: 2 }}>
            ASSISTANCE
          </div>
        </div>
      )}
    </div>
  );
}
