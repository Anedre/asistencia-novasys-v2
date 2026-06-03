"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Wraps page content with a fade + subtle slide-up animation that runs
 * each time the pathname changes. CSS handles the actual animation
 * (see .page-transition / .page-transition-active in nova-design.css).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [renderKey, setRenderKey] = useState(pathname);

  // Re-trigger animation on every pathname change
  useEffect(() => {
    setRenderKey(pathname);
  }, [pathname]);

  return (
    <div key={renderKey} className="page-transition">
      {children}
    </div>
  );
}
