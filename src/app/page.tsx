"use client";
/** Open where you left off on the Scriptures side (last book/chapter and versions on this device), else Genesis 1. */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_LOCATION, readHref, type BookRef } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { sideOfWork } from "@/lib/side";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const s = getSettings();
    // The Scriptures are always where the app opens: the most recent tab on the Scriptures side (a book in the
    // Library is one tap away, under Continue on the Library side).
    const onScriptures = (t: string) => sideOfWork(t.split("/")[0]) === "scriptures";
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
  return <div className="h-dvh bg-paper" aria-busy="true" />;
}
