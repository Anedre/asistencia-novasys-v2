/**
 * Novaassistance — Custom illustrations from the design bundle.
 * Flat geometric style with orbital/cosmic motifs from the brand logo.
 */

interface OrbitProps {
  size?: number;
  variant?: "character" | "minimal" | "geometric";
}

export function NovaOrbit({ size = 280, variant = "character" }: OrbitProps) {
  if (variant === "minimal") {
    return (
      <svg width={size} height={size * 0.7} viewBox="0 0 400 280" fill="none" aria-hidden>
        <ellipse cx="200" cy="140" rx="180" ry="60" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />
        <ellipse cx="200" cy="140" rx="120" ry="40" stroke="var(--border)" strokeWidth="1" />
        <circle cx="200" cy="140" r="32" fill="var(--accent)" opacity="0.12" />
        <circle cx="200" cy="140" r="20" fill="var(--accent)" />
        <path
          d="M200 130 L204 138 L212 140 L204 142 L200 150 L196 142 L188 140 L196 138 Z"
          fill="var(--bg-elevated)"
        />
        <circle cx="320" cy="140" r="5" fill="var(--accent)" />
        <circle cx="80" cy="140" r="4" fill="var(--text-secondary)" />
        <circle cx="200" cy="80" r="3" fill="var(--accent)" />
      </svg>
    );
  }
  if (variant === "geometric") {
    return (
      <svg width={size} height={size * 0.7} viewBox="0 0 400 280" fill="none" aria-hidden>
        <defs>
          <pattern id="hexgrid" x="0" y="0" width="30" height="26" patternUnits="userSpaceOnUse">
            <path
              d="M15 0 L30 8.66 L30 17.32 L15 26 L0 17.32 L0 8.66 Z"
              stroke="var(--border)"
              fill="none"
              strokeWidth="0.7"
            />
          </pattern>
        </defs>
        <rect x="20" y="40" width="360" height="200" fill="url(#hexgrid)" opacity="0.6" />
        <rect x="120" y="80" width="160" height="120" rx="12" fill="var(--bg-elevated)" stroke="var(--border)" />
        <circle cx="200" cy="120" r="22" fill="var(--accent)" opacity="0.15" />
        <circle cx="200" cy="120" r="14" fill="var(--accent)" />
        <rect x="150" y="160" width="100" height="6" rx="3" fill="var(--border)" />
        <rect x="160" y="174" width="80" height="4" rx="2" fill="var(--border)" opacity="0.6" />
        <circle cx="80" cy="100" r="6" fill="var(--accent)" />
        <circle cx="320" cy="200" r="5" fill="var(--accent)" opacity="0.7" />
        <circle cx="340" cy="80" r="4" fill="var(--text-secondary)" />
      </svg>
    );
  }
  // character (default)
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 400 280" fill="none" aria-hidden>
      <ellipse cx="200" cy="180" rx="170" ry="50" stroke="var(--border)" strokeWidth="1" strokeDasharray="2 5" />
      <ellipse cx="200" cy="180" rx="110" ry="32" stroke="var(--accent)" strokeWidth="1" opacity="0.4" />
      <ellipse cx="200" cy="220" rx="60" ry="6" fill="var(--text-secondary)" opacity="0.1" />
      <path
        d="M170 180 Q170 130 200 130 Q230 130 230 180 L230 215 Q230 220 225 220 L175 220 Q170 220 170 215 Z"
        fill="var(--accent)"
      />
      <circle cx="200" cy="105" r="22" fill="var(--text-primary)" />
      <circle cx="200" cy="105" r="5" fill="var(--accent)" />
      <rect x="225" y="155" width="40" height="28" rx="3" fill="var(--bg-elevated)" stroke="var(--border)" />
      <rect x="230" y="161" width="14" height="2" fill="var(--accent)" />
      <rect x="230" y="167" width="22" height="2" fill="var(--border)" />
      <rect x="230" y="173" width="18" height="2" fill="var(--border)" />
      <circle cx="60" cy="170" r="6" fill="var(--accent)" />
      <circle cx="60" cy="170" r="12" fill="var(--accent)" opacity="0.15" />
      <circle cx="340" cy="195" r="5" fill="var(--success)" />
      <circle cx="340" cy="195" r="10" fill="var(--success)" opacity="0.2" />
      <circle cx="290" cy="80" r="4" fill="var(--accent)" opacity="0.7" />
      <circle cx="100" cy="60" r="3" fill="var(--text-secondary)" />
      <line x1="80" y1="170" x2="170" y2="180" stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
      <line x1="320" y1="195" x2="230" y2="190" stroke="var(--success)" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
    </svg>
  );
}
