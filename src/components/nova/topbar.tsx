"use client";

import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconSvg, Icons } from "@/components/nova/icons";
import { NovaAvatar } from "@/components/nova/avatar";
import { NovaMenu } from "@/components/nova/menu";
import { useMyRequests } from "@/hooks/use-requests";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { GlobalSearch } from "@/components/nova/global-search";

interface TopbarProps {
  /** "admin" or "employee" — used by the View Toggle */
  activeView: "admin" | "employee";
  /** If true, hide the view-toggle (when user only has one role). */
  showViewToggle?: boolean;
}

export function NovaTopbar({ activeView, showViewToggle = true }: TopbarProps) {
  const { data: session } = useSession();
  const [themeMounted, setThemeMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { data: myRequests } = useMyRequests();

  useEffect(() => {
    const id = requestAnimationFrame(() => setThemeMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isDark = themeMounted && resolvedTheme === "dark";

  const user = session?.user;
  const name = user?.name ?? "Usuario";
  const role = user?.role === "ADMIN" ? "Admin" : "Empleado";
  const email = user?.email ?? "";
  const pendingRequests = (myRequests?.requests ?? []).filter((r) => r.status === "PENDING").length;

  return (
    <header className="topbar">
      {showViewToggle && (
        <div
          className="view-toggle"
          role="tablist"
          style={{
            display: "inline-flex",
            gap: 2,
            padding: 3,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Link
            href="/dashboard"
            role="tab"
            className={activeView === "employee" ? "active" : ""}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              color: activeView === "employee" ? "#fff" : "var(--text-secondary)",
              background:
                activeView === "employee"
                  ? "linear-gradient(135deg, #4F46E5, #3FBEFF)"
                  : "transparent",
              boxShadow:
                activeView === "employee"
                  ? "0 2px 8px -2px color-mix(in srgb, #4F46E5 55%, transparent)"
                  : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            <IconSvg d={Icons.user} size={13} /> Empleado
          </Link>
          <Link
            href="/admin/dashboard"
            role="tab"
            className={activeView === "admin" ? "active" : ""}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              color: activeView === "admin" ? "#fff" : "var(--text-secondary)",
              background:
                activeView === "admin"
                  ? "linear-gradient(135deg, #4F46E5, #3FBEFF)"
                  : "transparent",
              boxShadow:
                activeView === "admin"
                  ? "0 2px 8px -2px color-mix(in srgb, #4F46E5 55%, transparent)"
                  : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              textDecoration: "none",
              transition: "all 0.15s",
            }}
          >
            <IconSvg d={Icons.shield} size={13} /> Admin
          </Link>
        </div>
      )}

      <GlobalSearch />

      <div className="topbar-actions">
        <NotificationDropdown />
        <button
          className="icon-btn"
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          aria-pressed={isDark}
          title={isDark ? "Modo claro" : "Modo oscuro"}
          suppressHydrationWarning
        >
          <IconSvg d={isDark ? Icons.sun : Icons.moon} size={18} />
        </button>
        <button
          className="icon-btn"
          aria-label="Idioma (próximamente)"
          type="button"
          disabled
          style={{ opacity: 0.45, cursor: "not-allowed" }}
          title="Selector de idioma próximamente"
        >
          <IconSvg d={Icons.globe} size={18} />
        </button>

        {/* User chip — popover menu */}
        <NovaMenu
          align="right"
          dir="down"
          trigger={
            <div className="user-chip" aria-haspopup="menu">
              <NovaAvatar name={name} size={32} variant="accent" />
              <div aria-hidden style={{ lineHeight: 1.2, textAlign: "left" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{name}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{role}</div>
              </div>
              <IconSvg d={Icons.chevronDown} size={15} className="chip-caret" />
            </div>
          }
        >
          <div className="pop-head">
            <NovaAvatar name={name} size={40} variant="accent" />
            <div>
              <div className="pop-head-name">{name}</div>
              <div className="pop-head-sub">{email}</div>
            </div>
          </div>

          {activeView === "admin" ? (
            <>
              <Link className="pop-item" href="/dashboard">
                <IconSvg d={Icons.user} size={16} /> Ver como empleado
              </Link>
              <Link className="pop-item" href="/admin/settings/general">
                <IconSvg d={Icons.settings} size={16} /> Configuración
              </Link>
            </>
          ) : (
            <>
              <Link className="pop-item" href="/profile">
                <IconSvg d={Icons.user} size={16} /> Mi perfil
              </Link>
              <Link className="pop-item" href="/requests">
                <IconSvg d={Icons.doc} size={16} /> Mis solicitudes
                {pendingRequests > 0 && <span className="pop-right">{pendingRequests}</span>}
              </Link>
              <Link className="pop-item" href="/profile">
                <IconSvg d={Icons.settings} size={16} /> Preferencias
              </Link>
            </>
          )}

          <div className="pop-sep" />
          <button type="button" className="pop-item" onClick={() => setTheme(isDark ? "light" : "dark")}>
            <IconSvg d={isDark ? Icons.sun : Icons.moon} size={16} /> Cambiar tema
          </button>
          <div className="pop-item" aria-disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
            <IconSvg d={Icons.globe} size={16} /> Idioma <span className="pop-right">ES</span>
          </div>
          <div className="pop-sep" />
          <button type="button" className="pop-item danger" onClick={() => signOut({ callbackUrl: "/login" })}>
            <IconSvg d={Icons.logout} size={16} /> Cerrar sesión
          </button>
        </NovaMenu>
      </div>
    </header>
  );
}
