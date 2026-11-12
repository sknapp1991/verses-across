"use client";
/**
 * Where this reader left off on this site: the most recent tab of a book on this site (Verses Across: the
 * scriptures; Library Across: the books), from the settings saved on this device. Null for a first visit.
 * Used by "/" (returning readers go straight back there) and the home page's "Continue reading" tile.
 */
import { sideOfWork, type BookRef } from "./catalog";
import { getSettings } from "./settings";
import { SITE_SIDE } from "./site";

export function lastRead(): BookRef | null {
  const s = getSettings();
  const onThisSite = (t: string) => sideOfWork(t.split("/")[0]) === SITE_SIDE;
  const recent = s.tabsRecent.find((r) => s.tabs.some((t) => t.startsWith(`${r}/`) && onThisSite(t)));
  const tab = s.tabs.find((t) => recent && t.startsWith(`${recent}/`) && onThisSite(t)) ?? [...s.tabs].reverse().find(onThisSite);
  if (!tab) return null;
  const [work, book, ch] = tab.split("/");
  return work && book && Number(ch) > 0 ? { work, book, chapter: Number(ch) } : null;
}
