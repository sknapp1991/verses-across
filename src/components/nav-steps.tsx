"use client";
/**
 * This tab's trail through the site (sessionStorage), for the ways back:
 * - NAV_STEPS: pages seen on this site in this tab, so "← Previous page" (page-chrome.tsx) goes back only when the
 *   page before is one of ours, never to the search engine or site that sent the reader here;
 * - LAST_READING: the last chapter read (its address and title), for the "back to your reading" bubble on the info
 *   pages and articles (my brother's ticket 25de3898, Nov 23: a "Not in every Bible" link left no easy way back);
 * - PREV_PATH: the page just before this one (going back there is one step back, to the very spot).
 */
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const NAV_STEPS = "va-nav-steps";
export const LAST_READING = "va-last-reading"; // JSON { url, title }
export const PREV_PATH = "va-prev-path";
const HERE = "va-here-path";

export function NavSteps() {
  const path = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(NAV_STEPS, String(Number(sessionStorage.getItem(NAV_STEPS) ?? "0") + 1));
      const was = sessionStorage.getItem(HERE);
      if (was && was !== path) sessionStorage.setItem(PREV_PATH, was);
      sessionStorage.setItem(HERE, path);
    } catch {
      /* fine without */
    }
    // a chapter: remember it (its title once the page has set it: "Luke 23 · Holy Bible – KJV…" → "Luke 23")
    if (!/^\/read\/[^/]+\/[^/]+\/\d+/.test(path)) return;
    const t = setTimeout(() => {
      try {
        const title = document.title.split(" · ")[0].trim();
        sessionStorage.setItem(LAST_READING, JSON.stringify({ url: location.pathname + location.search, path, title }));
      } catch {
        /* fine without */
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [path]);
  return null;
}
