"use client";
/**
 * Counts the pages seen on this site in this tab (sessionStorage), so "← Previous page" (page-chrome.tsx) goes back
 * only when the page before is one of ours, never to the search engine or site that sent the reader here.
 */
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const NAV_STEPS = "va-nav-steps";

export function NavSteps() {
  const path = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(NAV_STEPS, String(Number(sessionStorage.getItem(NAV_STEPS) ?? "0") + 1));
    } catch {
      /* fine without */
    }
  }, [path]);
  return null;
}
