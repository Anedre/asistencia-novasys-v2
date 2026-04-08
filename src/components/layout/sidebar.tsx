"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTenant } from "@/lib/contexts/tenant-context";
import { useTenantConfig } from "@/hooks/use-tenant";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  History,
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
  { title: "Historial", href: "/admin/audit", icon: History },
  { title: "Reportes", href: "/admin/reports", icon: BarChart3 },
  { title: "RRHH", href: "/admin/hr", icon: Heart },
  { title: "Configuracion", href: "/admin/settings", icon: Settings },
];

interface SidebarProps {
  role: "ADMIN" | "EMPLOYEE";
  isAdmin?: boolean;
  className?: string;
  /**
   * When true, the sidebar renders in icon-only mode (w-16) with tooltips on
   * hover. Used on pages that already have their own sub-navigation (e.g.
   * /admin/settings) to avoid two visible sidebars competing for space.
   */
  collapsed?: boolean;
}

export function Sidebar({
  role,
  isAdmin,
  className,
  collapsed = false,
}: SidebarProps) {
  const pathname = usePathname();
  const { tenantName, logoUrl } = useTenant();
  const { data: tenantConfig } = useTenantConfig();
  const features = tenantConfig?.settings?.features;

  // Filter nav items based on tenant features
  const rawItems = role === "ADMIN" ? adminNav : employeeNav;
  const items = rawItems.filter((item) => {
    if (item.href === "/messages" && features?.chat === false) return false;
    if (item.href === "/feed" && features?.social === false) return false;
    if (item.href === "/chat" && features?.aiAssistant === false) return false;
    return true;
  });
  const showSwitch = isAdmin === true;
  const isAdminView = role === "ADMIN";

  // Get first letter of tenant name for fallback logo
  const logoLetter = (tenantName || "N").charAt(0).toUpperCase();
  const displayName = tenantName || "Novasys";

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        collapsed ? "w-[72px]" : "w-64",
        className
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center border-b",
          collapsed ? "justify-center px-3" : "gap-2 px-6"
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={displayName}
            className="h-8 w-8 shrink-0 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            {logoLetter}
          </div>
        )}
        {!collapsed && (
          <span className="truncate text-lg font-semibold">{displayName}</span>
        )}
      </div>

      {/* View Switch for Admins */}
      {showSwitch && (
        <div className={cn("pt-4", collapsed ? "px-3" : "px-4")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href={isAdminView ? "/dashboard" : "/admin/dashboard"}
                    className="flex h-11 items-center justify-center rounded-lg border border-dashed text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  />
                }
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span className="sr-only">
                  {isAdminView ? "Vista Empleado" : "Panel Admin"}
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {isAdminView ? "Vista Empleado" : "Panel Admin"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href={isAdminView ? "/dashboard" : "/admin/dashboard"}
              className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground text-sidebar-foreground/70"
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0" />
              {isAdminView ? "Vista Empleado" : "Panel Admin"}
            </Link>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-1", collapsed ? "p-3" : "p-4")}>
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              item.href !== "/admin/dashboard" &&
              pathname.startsWith(item.href));

          const linkClass = cn(
            "flex items-center rounded-lg text-sm font-medium transition-colors",
            collapsed
              ? "h-11 justify-center"
              : "gap-3 px-3 py-2.5",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link href={item.href} className={linkClass} />
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span className="sr-only">{item.title}</span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={linkClass}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground text-center">
            {displayName} Asistencia v2
          </p>
        </div>
      )}
    </aside>
  );
}

export { employeeNav, adminNav };
