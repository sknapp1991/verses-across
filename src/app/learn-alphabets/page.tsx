import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { LearnAlphabets } from "@/components/learn-alphabets";

/**
 * Learn the alphabets (a hidden study page, reached from /study-lab): a short course in the Hebrew, Greek and Arabic
 * alphabets that ends with reading Genesis 1:1, John 1:1 and the Quran's first verse. Not linked from the site, not in
 * the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Learn the alphabets",
  description: "A short course in the Hebrew, Greek and Arabic alphabets, ending with a first verse you read yourself.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <LearnAlphabets />;
}
