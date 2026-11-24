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
import { chapterTitle, findBook } from "@/lib/catalog";

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
    // a chapter of a book in the catalog: remember it at once, titled from the catalog ("Luke 23", "Dhammapada 1")
    const m = /^\/read\/([^/]+)\/([^/]+)\/(\d+)/.exec(path);
    const book = m ? findBook(m[1], m[2]) : undefined;
    if (!m || !book) return;
    try {
      const title = chapterTitle(book, Number(m[3]));
      if (title) sessionStorage.setItem(LAST_READING, JSON.stringify({ url: location.pathname + location.search, path, title }));
    } catch {
      /* fine without */
    }
  }, [path]);
  return null;
}
