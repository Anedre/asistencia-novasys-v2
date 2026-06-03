"use client";

/**
 * EmptyState — the single empty-state used everywhere a list, panel, or
 * page renders no items.
 *
 * Maps to the `.empty / .empty-icon / .empty-title / .empty-sub` CSS
 * classes from `nova-design.css`, so the spacing and typography match the
 * rest of the design system. Use the `compact` variant inside dense panels
 * (cards, sidebars) to switch to `.empty-mini`.
 *
 *   <EmptyState
 *     icon={Icons.calendar}
 *     title="Sin eventos próximos"
 *     description="No hay eventos programados. ¡Crea uno!"
 *     action={<button className="btn primary">Crear evento</button>}
 *   />
 *
 * Prefer ACTION-ORIENTED copy: "Aún no tienes solicitudes — crea la primera"
 * over the terse "Sin solicitudes".
 */

import { IconSvg } from "@/components/nova/icons";

interface EmptyStateProps {
  /** A `<path/>` element from `Icons.*` (the project's icon set). */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Use inside dense panels to switch to the smaller `.empty-mini` layout. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
}: EmptyStateProps) {
  if (compact) {
    return (
      <div className={`empty-mini${className ? ` ${className}` : ""}`}>
        {icon && (
          <div className="empty-mini-icon">
            <IconSvg d={icon} size={18} />
          </div>
        )}
        <div className="empty-mini-title">{title}</div>
        {description && <div className="empty-mini-sub">{description}</div>}
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
    );
  }
  return (
    <div className={`empty${className ? ` ${className}` : ""}`}>
      {icon && (
        <div className="empty-icon">
          <IconSvg d={icon} size={24} />
        </div>
      )}
      <div className="empty-title">{title}</div>
      {description && <div className="empty-sub">{description}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
