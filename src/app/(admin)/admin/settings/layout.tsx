"use client";

import type { ReactNode } from "react";
import { SettingsSidebar } from "@/components/admin/settings/SettingsSidebar";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Configuración</h1>
            <p className="page-sub">Personaliza Novaassistance para tu organización.</p>
          </div>
        </div>
      </div>

      <div className="settings-layout">
        <SettingsSidebar />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>

      <style jsx>{`
        .settings-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1000px) {
          .settings-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
