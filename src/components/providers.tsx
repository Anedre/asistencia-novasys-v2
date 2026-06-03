"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TenantProvider } from "@/lib/contexts/tenant-context";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays fresh for 2 minutes — avoids refetch on every page nav
            staleTime: 2 * 60 * 1000,
            // Cache persists 10 minutes after last component unmounts
            gcTime: 10 * 60 * 1000,
            // Don't refetch on window focus — feels like a reload to users
            refetchOnWindowFocus: false,
            // Show last cached data while refetching in the background
            placeholderData: (prev: unknown) => prev,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TenantProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </TenantProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
