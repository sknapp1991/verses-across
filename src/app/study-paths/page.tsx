import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { resolvedPaths } from "@/lib/study-paths";
import { StudyPaths } from "@/components/study-paths";

/**
 * Study paths (Study lab, hidden): four-week courses reading across traditions, with a daily question and a weekly
 * group prompt. Not linked from anywhere, not in the sitemap, not indexed. The readings are resolved here on the
 * server (labels and reader links from the catalog), so the page itself doesn't ship the catalog.
 */
export const metadata: Metadata = {
  title: "Study paths",
  description: "Guided four-week readings across traditions.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <StudyPaths paths={resolvedPaths()} />;
}
