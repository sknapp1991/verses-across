"use client";
/**
 * Offline reading: registers public/sw.js (production only). Saving whole versions and audio for
 * offline use is in downloads-dialog.tsx / lib/downloads.ts.
 */
import { useEffect } from "react";

export function OfflineSupport() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const reg = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") reg();
    else window.addEventListener("load", reg, { once: true });
  }, []);
  return null;
}
