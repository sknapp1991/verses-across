import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { TranslationLab } from "@/components/translation-lab";

/**
 * Translation lab (a hidden study page, reached from /study-lab): one Bible verse in many translations side by side,
 * with the differences marked, the original words beneath. Not linked from the site, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "Translation lab",
  description: "One verse in many translations, with the differences made visible.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <TranslationLab />;
}
