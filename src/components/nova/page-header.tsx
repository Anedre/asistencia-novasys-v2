/**
 * PageHeader — canonical page heading.
 *
 * Wraps the `.page-header / .page-header-row / .page-title / .page-sub / .page-actions`
 * CSS classes defined in `nova-design.css`. Use this on every page so the
 * heading size, baseline, and breadcrumb style stay identical across
 * modules. Avoid `<h1 className="page-title">` and ad-hoc inline styles.
 */

import Link from "next/link";

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  /** Optional subtitle / supporting copy under the title. */
  subtitle?: React.ReactNode;
  /** Optional small breadcrumb chip row above the title. */
  breadcrumb?: Crumb[];
  /** Right-aligned CTAs (export, create, filter, …). */
  actions?: React.ReactNode;
  /** Eyebrow line shown above the title (e.g. "PANEL DE ADMINISTRACIÓN · Jueves 21 mayo"). */
  eyebrow?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <header className={`page-header${className ? ` ${className}` : ""}`}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="breadcrumb" aria-label="Migas de pan">
          {breadcrumb.map((c, i) => (
            <span key={`${c.label}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              {i < breadcrumb.length - 1 && <span style={{ opacity: 0.5 }}>/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="page-header-row">
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              {eyebrow}
            </div>
          )}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
  );
}
