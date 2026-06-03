/**
 * EmptySettings — placeholder shown for settings sections that don't have
 * content implemented yet. Matches design's EmptySettings in admin-screens.jsx:
 *   <div className="empty">
 *     <div className="empty-icon"><IconSvg d={Icons.settings} size={24}/></div>
 *     <div className="empty-title">Sección en construcción</div>
 *     <div className="empty-sub">Esta área estará disponible próximamente.</div>
 *   </div>
 */

import { IconSvg, Icons } from "@/components/nova/icons";

interface Props {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function EmptySettings({
  title = "Sección en construcción",
  subtitle = "Esta área estará disponible próximamente.",
  icon = Icons.settings,
}: Props) {
  return (
    <div className="panel">
      <div className="empty">
        <div className="empty-icon">
          <IconSvg d={icon} size={24} />
        </div>
        <div className="empty-title">{title}</div>
        <div className="empty-sub">{subtitle}</div>
      </div>
    </div>
  );
}
