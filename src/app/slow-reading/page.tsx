import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { SlowReading } from "@/components/slow-reading";

/**
 * Slow reading (study lab, my brother's ticket 7a62bb28, Nov 26): one short passage read slowly several times, with
 * quiet prompts and a private journal, in the spirit of lectio divina and other contemplative reading. Not linked from
 * anywhere, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Slow reading",
  description: "One short passage, read slowly several times, with quiet prompts and a private journal.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <SlowReading />;
}
