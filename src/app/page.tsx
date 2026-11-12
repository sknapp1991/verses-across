"use client";
/**
 * "/": a returning reader opens where they left off on this site (last book/chapter and versions on this device);
 * a first visit gets the home page (/read: tiles inside the reading frame, ticket 72cd7cf4, Skylar Nov 12).
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_LOCATION, readHref } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { lastRead } from "@/lib/last-read";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const ref = lastRead();
    // Sync / group invite links (#sync=…, #group=…) go to the reader, as before.
    const keep = /^#(sync|group)=/.test(location.hash) ? location.hash : "";
    if (!ref && !keep) {
      router.replace("/read");
      return;
    }
    const to = ref ?? DEFAULT_LOCATION;
    router.replace(readHref(to, getSettings().versions[to.work]) + keep);
  }, [router]);
  return <div className="h-app bg-paper" aria-busy="true" />;
}
