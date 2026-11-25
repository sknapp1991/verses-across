import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { LayersView } from "@/components/layers-view";

/**
 * The hidden layer (my brother's ticket c74b9402, Nov 25): letters as numbers in Hebrew, Greek and Arabic, a verse's
 * "DNA" drawn and played, and puzzles built only from real verses. Not linked from anywhere, not in the sitemap, not
 * indexed: only for people who find it (and my brother, who has the address).
 */
export const metadata: Metadata = {
  title: "Aleph · Alpha · Alif",
  description: "Letters as numbers.",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <LayersView />;
}
