"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NovaSidebar } from "@/components/nova/sidebar";
import { NovaTopbar } from "@/components/nova/topbar";
import { PageTransition } from "@/components/nova/page-transition";

interface Props {
  role: "ADMIN" | "EMPLOYEE";
  activeView: "admin" | "employee";
  showViewToggle?: boolean;
  children: ReactNode;
}

/**
 * Shared app chrome (sidebar + topbar + page) with a mobile drawer.
 * On phones (<900px) the sidebar slides in as an overlay toggled by the
 * topbar hamburger; on desktop it's the usual sticky column.
 */
export function AppShell({ role, activeView, showViewToggle, children }: Props) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the route changes (mobile soft-nav).
  // Deferred to rAF so it isn't a synchronous setState in the effect body.
  useEffect(() => {
    const id = requestAnimationFrame(() => setNavOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <div className={`shell ${navOpen ? "nav-open" : ""}`}>
      <NovaSidebar role={role} />
      <div className="shell-backdrop" aria-hidden={!navOpen} onClick={() => setNavOpen(false)} />
      <main className="main">
        <NovaTopbar
          activeView={activeView}
          showViewToggle={showViewToggle}
          onMenuToggle={() => setNavOpen((v) => !v)}
        />
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
