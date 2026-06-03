/**
 * Panel — the "card" surface used for every dashboard / detail section.
 *
 * Wraps the `.panel / .panel-head / .panel-title / .panel-sub` CSS classes
 * from `nova-design.css`. Pages should reach for this instead of building
 * `<section className="panel"><div className="panel-head">…</div></section>`
 * inline.
 */

interface PanelProps {
  title?: React.ReactNode;
  /** Smaller line below the title — meta info, helper text. */
  subtitle?: React.ReactNode;
  /** Right-aligned controls (filter, action buttons, link). */
  actions?: React.ReactNode;
  /** Icon shown to the left of the title. */
  icon?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export function Panel({
  title,
  subtitle,
  actions,
  icon,
  className,
  bodyClassName,
  bodyStyle,
  children,
}: PanelProps) {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`}>
      {(title || actions || icon) && (
        <div className="panel-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {icon && <span style={{ color: "var(--text-secondary)" }}>{icon}</span>}
            <div style={{ minWidth: 0 }}>
              {title && <div className="panel-title">{title}</div>}
              {subtitle && <div className="panel-sub">{subtitle}</div>}
            </div>
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName} style={bodyStyle}>
        {children}
      </div>
    </section>
  );
}
