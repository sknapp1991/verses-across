import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { TimeAndPlace } from "@/components/time-and-place";

/**
 * Time and place (study lab, my brother's ticket 7a62bb28, Nov 26): the places a Bible chapter names on a map, and
 * when the scriptures were written. Not linked from anywhere, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Time and place",
  description: "When and where the texts were written, and the places a chapter names on a map.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <TimeAndPlace />;
}
