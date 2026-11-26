import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { LiteraryShape } from "@/components/literary-shape";

/**
 * Literary shape (study lab, my brother's ticket 7a62bb28, Nov 26): acrostics, parallel lines and mirrored stories,
 * from curated examples checked against the site's texts. Not linked from anywhere, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Literary shape",
  description: "The hidden structure of Bible passages: acrostics, parallel lines and mirrored stories.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <LiteraryShape />;
}
