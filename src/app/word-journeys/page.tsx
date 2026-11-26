import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { WordJourneys } from "@/components/word-journeys";

/**
 * Word journeys (study lab, my brother's ticket 7a62bb28, Nov 26): follow one Hebrew or Greek word through the whole
 * Old or New Testament, every place it appears and how the KJV renders it there. Not linked from anywhere, not in the
 * sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Word journeys",
  description: "Follow one Hebrew or Greek word through the Bible.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <WordJourneys />;
}
