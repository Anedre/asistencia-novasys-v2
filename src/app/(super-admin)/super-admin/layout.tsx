"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Shield, Building2, LayoutDashboard, Loader2 } from "lucide-react";

const superAdminNav = [
  { title: "Dashboard", href: "/super-admin/dashboard", icon: LayoutDashboard },
  { title: "Tenants", href: "/super-admin/tenants", icon: Building2 },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "authenticated") {
      const role = (session?.user as Record<string, string>)?.role;
      if (role !== "SUPER_ADMIN") {
        router.push("/dashboard");
      }
    } else if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Super Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {superAdminNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <Link href="/admin/dashboard" className="text-xs text-muted-foreground hover:underline">
            ← Volver al Panel Admin
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
