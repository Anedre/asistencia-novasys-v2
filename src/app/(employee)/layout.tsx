"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { ChatWidget } from "@/components/chat/chat-widget";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const userRole = (session?.user?.role as "ADMIN" | "EMPLOYEE") || "EMPLOYEE";
  const isAdmin = userRole === "ADMIN";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar role="EMPLOYEE" isAdmin={isAdmin} className="hidden md:flex" />

      {/* Mobile nav */}
      <MobileNav
        role="EMPLOYEE"
        isAdmin={isAdmin}
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
      <ChatWidget />
    </div>
  );
}
