"use client";

import { useRequireSession } from "@/hooks/use-require-session";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/nova/app-shell";
import { ThemeBridge } from "@/components/nova/theme-bridge";
import { ChatWidget } from "@/components/chat/chat-widget";
import { MessagingWidget } from "@/components/messaging/messaging-widget";
import { useHeartbeat } from "@/hooks/use-presence";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { ready, data: session } = useRequireSession();
  useHeartbeat();

  // "unauthenticated" is also held on the spinner: the hook is already
  // sending the browser to /login, and painting the shell for a beat would
  // just flash an empty panel with failing requests.
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  return (
    <div className="nva-app" data-theme="light" data-density="compact" suppressHydrationWarning>
      <ThemeBridge />
      <AppShell role="EMPLOYEE" activeView="employee" showViewToggle={isAdmin}>
        {children}
      </AppShell>
      <Toaster position="top-right" richColors closeButton />
      <MessagingWidget />
      <ChatWidget />
    </div>
  );
}
