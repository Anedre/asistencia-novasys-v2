"use client";

import { useSession } from "next-auth/react";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { NovaSidebar } from "@/components/nova/sidebar";
import { NovaTopbar } from "@/components/nova/topbar";
import { PageTransition } from "@/components/nova/page-transition";
import { ThemeBridge } from "@/components/nova/theme-bridge";
import { ChatWidget } from "@/components/chat/chat-widget";
import { MessagingWidget } from "@/components/messaging/messaging-widget";
import { useHeartbeat } from "@/hooks/use-presence";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  useHeartbeat();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  return (
    <div className="nva-app" data-theme="light" data-density="comfortable" suppressHydrationWarning>
      <ThemeBridge />
      <div className="shell">
        <NovaSidebar role="EMPLOYEE" />
        <main className="main">
          <NovaTopbar activeView="employee" showViewToggle={isAdmin} />
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <Toaster position="top-right" richColors closeButton />
      <MessagingWidget />
      <ChatWidget />
    </div>
  );
}
