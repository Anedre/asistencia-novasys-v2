"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { ChatWidget } from "@/components/chat/chat-widget";
import { MessagingWidget } from "@/components/messaging/messaging-widget";
import { useHeartbeat } from "@/hooks/use-presence";

/**
 * Routes that render their own inner sub-navigation. On these routes the
 * global admin sidebar collapses to icon-only mode so the two sidebars don't
 * compete for horizontal space.
 */
const NESTED_SIDEBAR_PREFIXES = ["/admin/settings"];

function hasNestedSidebar(pathname: string | null): boolean {
  if (!pathname) return false;
  return NESTED_SIDEBAR_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useHeartbeat();

  const sidebarCollapsed = hasNestedSidebar(pathname);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar
        role="ADMIN"
        isAdmin={true}
        collapsed={sidebarCollapsed}
        className="hidden md:flex"
      />

      {/* Mobile nav */}
      <MobileNav
        role="ADMIN"
        isAdmin={true}
        open={mobileOpen}
        onOpenChange={setMobileOpen}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
      <MessagingWidget />
      <ChatWidget />
    </div>
  );
}
