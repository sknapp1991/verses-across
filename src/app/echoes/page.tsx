import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { Echoes } from "@/components/echoes";

/**
 * Echoes (study lab, my brother's ticket 7a62bb28, Nov 26): where later texts quote or retell earlier ones, as a map of
 * the Bible's cross references, Old Testament quotations in the New, and stories told across traditions. Not linked
 * from anywhere, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Echoes",
  description: "Where later texts quote or retell earlier ones, and a map of the Bible's books by verses closest in meaning.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <Echoes />;
}
