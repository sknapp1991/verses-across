"use client";
/** Open where you left off on this site (last book/chapter and versions on this device), else Genesis 1 / Pride and Prejudice. */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_LOCATION, readHref, type BookRef } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { sideOfWork } from "@/lib/catalog";
import { SITE_SIDE } from "@/lib/site";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const s = getSettings();
    // The most recent tab of a book on this site (Verses Across: the scriptures; Library Across: the books).
    const onScriptures = (t: string) => sideOfWork(t.split("/")[0]) === SITE_SIDE;
    const recent = s.tabsRecent.find((r) => s.tabs.some((t) => t.startsWith(`${r}/`) && onScriptures(t)));
    const tab = s.tabs.find((t) => recent && t.startsWith(`${recent}/`) && onScriptures(t)) ?? [...s.tabs].reverse().find(onScriptures);
    let ref: BookRef = DEFAULT_LOCATION;
    if (tab) {
      const [work, book, ch] = tab.split("/");
      if (work && book && Number(ch) > 0) ref = { work, book, chapter: Number(ch) };
    }
    // Keep sync / group invite links (#sync=…, #group=…) on the way to the reader.
    const keep = /^#(sync|group)=/.test(location.hash) ? location.hash : "";
    router.replace(readHref(ref, s.versions[ref.work]) + keep);
  }, [router]);
  return <div className="h-app bg-paper" aria-busy="true" />;
}
