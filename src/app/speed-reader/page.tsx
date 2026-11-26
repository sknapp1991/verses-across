import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { SpeedReader } from "@/components/speed-reader";

/**
 * Speed reader (study lab, my brother's ticket 7a62bb28, Nov 26): any chapter on the site shown one word at a time,
 * from slow to very fast. Not linked from anywhere, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Speed reader",
  description: "Read any chapter one word at a time, at the pace you choose.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <SpeedReader />;
}
