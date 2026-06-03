/**
 * SettingsCard + SaveBar — exact match to the design's components in
 * admin-screens.jsx (lines 787 and 988 respectively).
 *
 * Design source:
 *   const SettingsCard = ({ title, subtitle, children }) => (
 *     <div className="panel" style={{ marginBottom: 16 }}>
 *       <div style={{ marginBottom: 16 }}>
 *         <div className="panel-title">{title}</div>
 *         {subtitle && <div className="panel-sub" style={{ marginTop:2 }}>{subtitle}</div>}
 *       </div>
 *       {children}
 *     </div>
 *   );
 *
 *   const SaveBar = () => (
 *     <div style={{ position:'sticky', bottom: 16, display:'flex',
 *                  justifyContent:'flex-end', gap:8, padding:14,
 *                  background:'var(--bg-elevated)', border:'1px solid var(--border)',
 *                  borderRadius:'var(--r)', boxShadow:'var(--shadow-md)' }}>
 *       <button className="btn ghost">Descartar</button>
 *       <button className="btn primary"><IconSvg d={Icons.check} size={14}/> Guardar cambios</button>
 *     </div>
 *   );
 */

import { IconSvg, Icons } from "@/components/nova/icons";

interface SettingsCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function SettingsCard({ title, subtitle, children }: SettingsCardProps) {
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div className="panel-title">{title}</div>
        {subtitle && (
          <div className="panel-sub" style={{ marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

interface SaveBarProps {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SaveBar({ dirty, saving, onSave, onDiscard }: SaveBarProps) {
  if (!dirty) return null;
  return (
    <div
      style={{
        position: "sticky",
        bottom: 16,
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        padding: 14,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <button type="button" className="btn ghost" onClick={onDiscard} disabled={saving}>
        Descartar
      </button>
      <button type="button" className="btn primary" onClick={onSave} disabled={saving}>
        <IconSvg d={Icons.check} size={14} /> {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </div>
  );
}
