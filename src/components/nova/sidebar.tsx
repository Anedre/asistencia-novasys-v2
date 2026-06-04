"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenant } from "@/lib/contexts/tenant-context";
import { useTenantConfig } from "@/hooks/use-tenant";
import { useMyRequests } from "@/hooks/use-requests";
import { useTodayStatus } from "@/hooks/use-attendance";
import { useMyProfile, useAdminDashboard } from "@/hooks/use-employee";
import { useTenantTimezone, timePartsInTz } from "@/hooks/use-timezone";
import { IconSvg, Icons } from "@/components/nova/icons";
import { PremiumIcon, type PremiumIconTone } from "@/components/nova/premium-icon";
import { NovaLogo } from "@/components/nova/logo";
import { NovaMenu } from "@/components/nova/menu";

// Two-way chevron used on the company card to signal it's a selector.
const SELECTOR_CHEVRON = "M8 9l4-4 4 4M8 15l4 4 4-4";

interface NavItem {
  key: string;
  href: string;
  label: string;
  /** Premium duotone icon name (used only by admin sidebar) */
  icon: string;
  /** Per-section corporate tone — each nav section carries its own color */
  tone: PremiumIconTone;
  badge?: number;
  /** When set, item active if pathname starts with this */
  matchPrefix?: string;
}

interface SidebarProps {
  role: "ADMIN" | "EMPLOYEE";
}

// Per-section tones come straight from the design intent:
// Dashboard=indigo, Asistencia=cyan, Empleados=teal, Aprobaciones=green,
// Reportes=violet, Auditoría=slate, Sedes=amber.
const adminPrimary: NavItem[] = [
  { key: "dashboard", href: "/admin/dashboard", label: "Dashboard", icon: "dashboard", tone: "Indigo", matchPrefix: "/admin/dashboard" },
  { key: "attendance", href: "/admin/attendance", label: "Asistencia", icon: "clock", tone: "Accent", matchPrefix: "/admin/attendance" },
  { key: "employees", href: "/admin/employees", label: "Empleados", icon: "users", tone: "Teal", matchPrefix: "/admin/employees" },
  { key: "approvals", href: "/admin/approvals", label: "Aprobaciones", icon: "check", tone: "Green", matchPrefix: "/admin/approvals" },
  { key: "regularize", href: "/admin/regularize", label: "Regularizar", icon: "edit", tone: "Amber", matchPrefix: "/admin/regularize" },
  { key: "reports", href: "/admin/reports", label: "Reportes", icon: "chart", tone: "Violet", matchPrefix: "/admin/reports" },
  { key: "audit", href: "/admin/audit", label: "Auditoría", icon: "shield", tone: "Slate", matchPrefix: "/admin/audit" },
];

const adminSecondary: NavItem[] = [
  { key: "hr", href: "/admin/hr", label: "RRHH", icon: "heart", tone: "Rose", matchPrefix: "/admin/hr" },
  { key: "settings", href: "/admin/settings/general", label: "Configuración", icon: "settings", tone: "Slate", matchPrefix: "/admin/settings" },
];

// Icon names + tones come from the new Handoff (employee.jsx NAV_PI / NAV_TONE).
// The new bundle renders colored PremiumIcons; tones also drive the active-state
// gradient + nav-rail color via the --nt CSS variable.
const employeeNav: NavItem[] = [
  { key: "home", href: "/dashboard", label: "Inicio", icon: "home", tone: "Indigo", matchPrefix: "/dashboard" },
  { key: "history", href: "/history", label: "Mi asistencia", icon: "history", tone: "Accent", matchPrefix: "/history" },
  { key: "requests", href: "/requests", label: "Solicitudes", icon: "doc", tone: "Violet", matchPrefix: "/requests" },
  { key: "reports", href: "/reports", label: "Mis reportes", icon: "chart", tone: "Teal", matchPrefix: "/reports" },
  { key: "feed", href: "/feed", label: "Feed", icon: "feed", tone: "Amber", matchPrefix: "/feed" },
  { key: "messages", href: "/messages", label: "Chat", icon: "chat", tone: "Accent", matchPrefix: "/messages" },
  { key: "events", href: "/events", label: "Eventos", icon: "calendar", tone: "Rose", matchPrefix: "/events" },
  { key: "profile", href: "/profile", label: "Perfil", icon: "user", tone: "Green", matchPrefix: "/profile" },
];

// Per-tone hex used to drive the --nt CSS variable on each nav-item.
const TONE_HEX: Record<PremiumIconTone, string> = {
  Accent: "#3FBEFF",
  Indigo: "#6366F1",
  Teal: "#14B8A6",
  Green: "#10B981",
  Amber: "#F59E0B",
  Violet: "#8B5CF6",
  Rose: "#FB7185",
  Slate: "#94A3B8",
  Gold: "#F59E0B",
};

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const style = { "--nt": TONE_HEX[item.tone] } as CSSProperties;
  return (
    <Link
      href={item.href}
      className={`nav-item ${active ? "active" : ""}`}
      style={style}
      data-tip={item.label}
      data-tone={item.tone}
    >
      <PremiumIcon name={item.icon} tone={item.tone} size={20} />
      <span>{item.label}</span>
      {badge != null && badge > 0 && <span className="nav-badge">{badge}</span>}
    </Link>
  );
}

function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

function SidebarLive() {
  const { data: today } = useTodayStatus();
  const { data: profile } = useMyProfile();
  const tz = useTenantTimezone();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const shiftStart = profile?.employee?.schedule?.startTime ?? "09:00";
  const shiftEnd = profile?.employee?.schedule?.endTime ?? "18:00";
  const breakMin = profile?.employee?.schedule?.breakMinutes ?? 60;
  // Goal = laborable hours (shift span minus the unpaid break), matching META DEL DÍA.
  const totalShiftMin = Math.max(1, parseHM(shiftEnd) - parseHM(shiftStart) - breakMin);

  let workedMin = today?.workedMinutes ?? 0;
  if (today?.hasOpenShift && today.firstInLocal) {
    const [h, m, s] = today.firstInLocal.split(":").map(Number);
    const startMin = h * 60 + m + (s || 0) / 60;
    const tp = timePartsInTz(tz);
    const nowMin = tp.hours * 60 + tp.minutes;
    workedMin = Math.max(0, nowMin - startMin - (today.breakMinutes ?? 0));
  }
  const pct = Math.min(100, Math.round((workedMin / totalShiftMin) * 100));
  const hh = Math.floor(workedMin / 60);
  const mm = Math.floor(workedMin % 60);
  const goalH = Math.round(totalShiftMin / 60);

  // Color band: success when active, slate when off
  const live = today?.hasOpenShift || today?.hasOpenBreak;
  const liveColor = live ? "var(--success)" : "var(--text-muted)";
  const style = { "--lc": liveColor } as CSSProperties;
  // Mark as in_progress to keep TS quiet — `now` keeps the effect alive
  void now;

  return (
    <div className="sidebar-live" style={style} title="Tu jornada">
      <div className="sidebar-live-head">
        <span className="live-dot" />
        <span className="sidebar-live-label">Tu jornada</span>
        <span className="sidebar-live-pct">{pct}%</span>
      </div>
      <div className="sidebar-live-bar">
        <div className="sidebar-live-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sidebar-live-foot">
        <b>
          {hh}h {String(mm).padStart(2, "0")}m
        </b>{" "}
        de {goalH}h
      </div>
    </div>
  );
}

// Admin "Asistencia hoy" live widget — present / total across the company.
function AdminSidebarLive() {
  const { data } = useAdminDashboard();
  const dash = data as { totalActiveEmployees?: number; presentToday?: number } | undefined;
  const total = dash?.totalActiveEmployees ?? 0;
  const present = dash?.presentToday ?? 0;
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const style = { "--lc": "#3FBEFF" } as CSSProperties;
  return (
    <div className="sidebar-live grad" style={style} title="Asistencia en vivo">
      <div className="sidebar-live-head">
        <span className="live-dot" />
        <span className="sidebar-live-label">Asistencia hoy</span>
        <span className="sidebar-live-pct" style={{ color: "#3FBEFF" }}>{pct}%</span>
      </div>
      <div className="sidebar-live-bar">
        <div className="sidebar-live-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="sidebar-live-foot">
        <b>{present}</b> de {total} presentes · ahora
      </div>
    </div>
  );
}

export function NovaSidebar({ role }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const { tenantName } = useTenant();
  const { data: tenantConfig } = useTenantConfig();
  const { data: myRequests } = useMyRequests();
  const features = tenantConfig?.settings?.features;

  const pendingRequests = (myRequests?.requests ?? []).filter((r) => r.status === "PENDING").length;

  const isActive = (item: NavItem) => {
    if (item.matchPrefix) {
      if (item.matchPrefix === "/dashboard") return pathname === "/dashboard";
      if (item.matchPrefix === "/admin/dashboard") return pathname === "/admin/dashboard";
      return pathname.startsWith(item.matchPrefix);
    }
    return pathname === item.href;
  };

  // Filter employee items based on tenant features
  const visibleEmployeeNav = employeeNav.filter((item) => {
    if (item.href === "/messages" && features?.chat === false) return false;
    if (item.href === "/feed" && features?.social === false) return false;
    return true;
  });

  // Animated nav-rail: track the active item's top + height.
  // Depend ONLY on pathname/role — `visibleEmployeeNav` is recomputed every render
  // and would cause an infinite setState loop if listed as a dep.
  const navRef = useRef<HTMLDivElement | null>(null);
  const [rail, setRail] = useState({ top: 0, h: 0, show: false, tone: "Accent" as PremiumIconTone });
  useEffect(() => {
    // Measure the active item after paint (rAF) so the rail animates to the
    // right spot without a synchronous setState in the effect body.
    const id = requestAnimationFrame(() => {
      const el = navRef.current?.querySelector<HTMLElement>(".nav-item.active");
      if (el) {
        const tone = (el.getAttribute("data-tone") as PremiumIconTone | null) ?? "Accent";
        setRail({ top: el.offsetTop, h: el.offsetHeight, show: true, tone });
      } else {
        setRail((r) => (r.show ? { ...r, show: false } : r));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, role]);

  const initials = (tenantName || "Nova").slice(0, 2).toUpperCase();
  const company = tenantName || "Novaassistance";

  const railStyle = { "--nt": TONE_HEX[rail.tone], transform: `translateY(${rail.top}px)`, height: rail.h } as CSSProperties;

  if (role === "ADMIN") {
    return (
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link href="/admin/dashboard" style={{ textDecoration: "none" }}>
            <NovaLogo size={28} />
          </Link>
        </div>
        <AdminSidebarLive />
        <div className="sidebar-nav" ref={navRef}>
          <div className={`nav-rail ${rail.show ? "show" : ""}`} style={railStyle} />
          <div className="sidebar-section">
            <div className="sidebar-label">Operaciones</div>
            {adminPrimary.map((it) => (
              <NavLink key={it.key} item={it} active={isActive(it)} />
            ))}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">Organización</div>
            {adminSecondary.map((it) => (
              <NavLink key={it.key} item={it} active={isActive(it)} />
            ))}
          </div>
        </div>
        <div className="sidebar-foot">
          <NovaMenu
            align="left"
            dir="up"
            width={236}
            trigger={
              <div className="company-card">
                <div className="company-avatar">{initials}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="company-name">{company}</div>
                  <div className="company-meta">Workspace</div>
                </div>
                <IconSvg d={SELECTOR_CHEVRON} size={14} className="muted" />
              </div>
            }
          >
            <div className="pop-head">
              <div className="company-avatar">{initials}</div>
              <div>
                <div className="pop-head-name">{company}</div>
                <div className="pop-head-sub">Workspace</div>
              </div>
            </div>
            <Link className="pop-item" href="/admin/settings/general">
              <IconSvg d={Icons.settings} size={16} /> Configuración de empresa
            </Link>
            <Link className="pop-item" href="/admin/settings/billing">
              <IconSvg d={Icons.card} size={16} /> Plan y facturación
            </Link>
            <div className="pop-sep" />
            <Link className="pop-item" href="/admin/hr">
              <IconSvg d={Icons.helpCircle} size={16} /> Ayuda y soporte
            </Link>
          </NovaMenu>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <NovaLogo size={28} />
        </Link>
      </div>
      <SidebarLive />
      <div className="sidebar-nav" ref={navRef}>
        <div className={`nav-rail ${rail.show ? "show" : ""}`} style={railStyle} />
        <div className="sidebar-section">
          <div className="sidebar-label">Mi espacio</div>
          {visibleEmployeeNav.map((it) => (
            <NavLink
              key={it.key}
              item={it}
              active={isActive(it)}
              badge={it.key === "requests" ? pendingRequests : undefined}
            />
          ))}
        </div>
      </div>
      <div className="sidebar-foot">
        <NovaMenu
          align="left"
          dir="up"
          width={232}
          trigger={
            <div className="company-card">
              <div className="company-avatar">{initials}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="company-name">{company}</div>
                <div className="company-meta">Empleado</div>
              </div>
              <IconSvg d={SELECTOR_CHEVRON} size={14} className="muted" />
            </div>
          }
        >
          <div className="pop-head">
            <div className="company-avatar">{initials}</div>
            <div>
              <div className="pop-head-name">{company}</div>
              <div className="pop-head-sub">Empleado</div>
            </div>
          </div>
          <Link className="pop-item" href="/feed">
            <IconSvg d={Icons.feed} size={16} /> Directorio de empresa
          </Link>
          <Link className="pop-item" href="/hr">
            <IconSvg d={Icons.helpCircle} size={16} /> Ayuda y soporte
          </Link>
        </NovaMenu>
      </div>
    </aside>
  );
}
