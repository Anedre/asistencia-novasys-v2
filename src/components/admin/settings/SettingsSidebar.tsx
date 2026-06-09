"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSvg, Icons } from "@/components/nova/icons";

/* ============================================================
   Settings sidebar — 1:1 with design's .settings-aside / .settings-nav
   (admin-screens.jsx, Settings component)
   ============================================================ */

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface Group {
  label: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    label: "Organización",
    items: [
      { href: "/admin/settings/general", label: "General", icon: Icons.building },
      { href: "/admin/settings/branding", label: "Marca", icon: Icons.heart },
      { href: "/admin/settings/schedule", label: "Horarios y turnos", icon: Icons.clock },
      { href: "/admin/settings/holidays", label: "Feriados", icon: Icons.calendar },
      { href: "/admin/settings/sites", label: "Sedes", icon: Icons.pin },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/settings/notifications", label: "Notificaciones", icon: Icons.bell },
      { href: "/admin/settings/integrations", label: "Integraciones", icon: Icons.link },
      { href: "/admin/settings/security", label: "Seguridad", icon: Icons.shield },
      { href: "/admin/settings/billing", label: "Facturación", icon: Icons.dollar },
    ],
  },
];

interface Props {
  /** Map keyed by href that marks a section as having unsaved changes. */
  dirty?: Record<string, boolean>;
}

export function SettingsSidebar({ dirty }: Props) {
  const pathname = usePathname() ?? "";

  // Keep the active pill in view when the strip scrolls horizontally.
  const mobileNavRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = mobileNavRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(".chip.active");
    if (!active) return;
    const target = active.offsetLeft - (container.clientWidth - active.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  }, [pathname]);

  return (
    <>
      {/* ── Mobile: a single swipeable, horizontally-scrolling row of pills ── */}
      <div className="settings-aside-mobile" ref={mobileNavRef}>
        {GROUPS.flatMap((g) => g.items).map((it) => {
          const active = pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`chip ${active ? "active" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", whiteSpace: "nowrap", flexShrink: 0, scrollSnapAlign: "start" }}
            >
              <IconSvg d={it.icon} size={13} />
              {it.label}
              {dirty?.[it.href] && (
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--warn)",
                    marginLeft: 2,
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Desktop: vertical sticky sidebar (matches design exactly) ── */}
      <aside className="settings-aside settings-aside-desktop">
        {GROUPS.map((g, gi) => (
          <div key={g.label}>
            <div className="settings-section-label" style={{ marginTop: gi > 0 ? 16 : 0 }}>
              {g.label}
            </div>
            {g.items.map((it) => {
              const active = pathname.startsWith(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`settings-nav ${active ? "active" : ""}`}
                >
                  <IconSvg d={it.icon} size={15} />
                  <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
                  {dirty?.[it.href] && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--warn)",
                      }}
                      title="Cambios sin guardar"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      <style jsx>{`
        .settings-aside-mobile {
          display: none;
          gap: 8px;
          margin-bottom: 20px;
        }
        @media (max-width: 1000px) {
          .settings-aside-mobile {
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            scroll-snap-type: x proximity;
            padding-bottom: 2px;
          }
          .settings-aside-mobile::-webkit-scrollbar {
            display: none;
          }
          .settings-aside-desktop {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
