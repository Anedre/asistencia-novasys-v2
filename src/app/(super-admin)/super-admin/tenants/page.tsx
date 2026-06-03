"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Client-side redirect (not server `redirect()`) so client-side navigation to
// this index route doesn't crash with "Rendered more hooks than during the
// previous render." See admin/settings/page.tsx for the same fix.
export default function TenantsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/super-admin/dashboard");
  }, [router]);
  return null;
}
