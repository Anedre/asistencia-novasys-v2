import { cn } from "@/lib/utils";

interface NovaLogoProps {
  size?: number;
  showText?: boolean;
  /** Custom name for the tenant when showText is true. */
  tenantName?: string;
  className?: string;
}

/**
 * NovaLogo — the "Orbital Control" mark from the design system.
 * Renders an SVG using --primary / --accent variables so it adapts
 * to light/dark and to per-tenant accent overrides.
 */
export function NovaLogo({ size = 32, showText = true, tenantName, className }: NovaLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <circle cx="20" cy="20" r="19" fill="var(--nova-navy)" />
        <circle
          cx="20"
          cy="20"
          r="13"
          stroke="#ffffff"
          strokeWidth="0.7"
          strokeDasharray="2 2.5"
          opacity="0.6"
        />
        <circle
          cx="20"
          cy="20"
          r="8"
          stroke="var(--nova-cyan)"
          strokeWidth="0.7"
          opacity="0.9"
        />
        <path
          d="M20 16 L21.6 19.2 L24.8 20 L21.6 20.8 L20 24 L18.4 20.8 L15.2 20 L18.4 19.2 Z"
          fill="var(--nova-cyan)"
        />
        <circle cx="33" cy="20" r="1.4" fill="var(--nova-cyan)" />
        <circle cx="20" cy="33" r="1.1" fill="var(--nova-cyan)" opacity="0.6" />
      </svg>
      {showText && (
        <div className="leading-none">
          <div className="text-[14px] font-bold tracking-[0.08em] text-foreground">
            {tenantName ? tenantName.toUpperCase() : "NOVA"}
          </div>
          <div className="text-[10px] font-medium tracking-[0.18em] text-[color:var(--nova-cyan-strong)] dark:text-[color:var(--nova-cyan)] mt-0.5">
            ASSISTANCE
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Smaller mark only — for compact contexts (avatars, favicons).
 */
export function NovaMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <circle cx="20" cy="20" r="19" fill="var(--nova-navy)" />
      <circle cx="20" cy="20" r="13" stroke="#ffffff" strokeWidth="0.7" strokeDasharray="2 2.5" opacity="0.6" />
      <circle cx="20" cy="20" r="8" stroke="var(--nova-cyan)" strokeWidth="0.7" opacity="0.9" />
      <path d="M20 16 L21.6 19.2 L24.8 20 L21.6 20.8 L20 24 L18.4 20.8 L15.2 20 L18.4 19.2 Z" fill="var(--nova-cyan)" />
      <circle cx="33" cy="20" r="1.4" fill="var(--nova-cyan)" />
      <circle cx="20" cy="33" r="1.1" fill="var(--nova-cyan)" opacity="0.6" />
    </svg>
  );
}
