"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) on the client.
 * Makes the app installable ("Add to home screen") and provides a basic
 * offline fallback. The SW itself is network-first so it never serves stale
 * app code or data.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
