"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTenant } from "@/lib/contexts/tenant-context";
import {
  Clock,
  CalendarDays,
  FileText,
  Send,
  Heart,
  User,
  LayoutDashboard,
  Users,
  CheckSquare,
  PenLine,
  Settings,
  BarChart3,
  ArrowLeftRight,
  MessageSquare,
  MessageCircle,
  Newspaper,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const employeeNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Historial", href: "/history", icon: CalendarDays },
  { title: "Solicitudes", href: "/requests", icon: Send },
  { title: "Eventos", href: "/events", icon: CalendarDays },
  { title: "Mensajes", href: "/messages", icon: MessageCircle },
  { title: "Social", href: "/feed", icon: Newspaper },
  { title: "Chat IA", href: "/chat", icon: MessageSquare },
  { title: "Reportes", href: "/reports", icon: FileText },
  { title: "RRHH", href: "/hr", icon: Heart },
  { title: "Mi Perfil", href: "/profile", icon: User },
];

const adminNav: NavItem[] = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Empleados", href: "/admin/employees", icon: Users },
  { title: "Asistencia", href: "/admin/attendance", icon: Clock },
  { title: "Aprobaciones", href: "/admin/approvals", icon: CheckSquare },
  { title: "Regularizar", href: "/admin/regularize", icon: PenLine },
  { title: "Reportes", href: "/admin/reports", icon: BarChart3 },
  { title: "RRHH", href: "/admin/hr", icon: Heart },
  { title: "Configuracion", href: "/admin/settings", icon: Settings },
];

interface SidebarProps {
  role: "ADMIN" | "EMPLOYEE";
  isAdmin?: boolean;
  className?: string;
}

export function Sidebar({ role, isAdmin, className }: SidebarProps) {
  const pathname = usePathname();
  const { tenantName, logoUrl } = useTenant();
  const items = role === "ADMIN" ? adminNav : employeeNav;
  const showSwitch = isAdmin === true;
  const isAdminView = role === "ADMIN";

  // Get first letter of tenant name for fallback logo
  const logoLetter = (tenantName || "N").charAt(0).toUpperCase();
  const displayName = tenantName || "Novasys";

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground",
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={displayName}
            className="h-8 w-8 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            {logoLetter}
          </div>
        )}
        <span className="text-lg font-semibold truncate">{displayName}</span>
      </div>

      {/* View Switch for Admins */}
      {showSwitch && (
        <div className="px-4 pt-4">
          <Link
            href={isAdminView ? "/dashboard" : "/admin/dashboard"}
            className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground text-sidebar-foreground/70"
          >
            <ArrowLeftRight className="h-4 w-4 shrink-0" />
            {isAdminView ? "Vista Empleado" : "Panel Admin"}
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/admin/dashboard" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground text-center">
          {displayName} Asistencia v2
        </p>
      </div>
    </aside>
  );
}

export { employeeNav, adminNav };
