import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { Memorize } from "@/components/memorize";

/**
 * Memorize (study lab, my brother's ticket 7a62bb28, Nov 26): learn verses by heart with gentle repetition. Not linked
 * from anywhere, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Memorize",
  description: "Learn verses by heart with gentle repetition and first-letter hints.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <Memorize />;
}
