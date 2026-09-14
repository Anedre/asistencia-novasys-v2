"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/** Local previews run with no session at all — the proxy honours the same flag. */
const DEV_PREVIEW = process.env.NEXT_PUBLIC_DEV_PREVIEW === "true";

/**
 * Client-side auth gate for the app shells.
 *
 * The proxy already redirects anonymous requests to /login — but only when the
 * request reaches it. These shells are prerendered client pages, and the CDN
 * in front of Amplify can hand a cached copy of the HTML to a visitor without
 * a session, skipping the proxy entirely. The user then sees an empty panel
 * with every API call failing (401) and no way forward. This hook is the
 * second line: once NextAuth resolves to "unauthenticated", bounce to /login
 * keeping the intended destination as callbackUrl.
 *
 * Client-side `router.replace`, never a server `redirect()` — see the Next
 * redirect caveat in the project notes.
 *
 * `ready` is what a layout should gate its shell on: true once there is a
 * session (or in a local preview, where there never is one).
 */
export function useRequireSession() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (DEV_PREVIEW || session.status !== "unauthenticated") return;
    const target = pathname && pathname !== "/" ? pathname : "/dashboard";
    router.replace(`/login?callbackUrl=${encodeURIComponent(target)}`);
  }, [session.status, pathname, router]);

  return {
    ...session,
    ready: DEV_PREVIEW || session.status === "authenticated",
  };
}
