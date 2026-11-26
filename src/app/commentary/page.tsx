import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { Commentary } from "@/components/commentary";

/**
 * Classic commentary (study lab, my brother's ticket 7a62bb28, Nov 26): a KJV chapter with Matthew Henry's Concise
 * Commentary (public domain) beside the verses each note covers. Not linked from anywhere, not in the sitemap, not
 * indexed.
 */
export const metadata: Metadata = {
  title: "Classic commentary",
  description: "Matthew Henry's notes beside the text, chapter by chapter.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <Commentary />;
}
