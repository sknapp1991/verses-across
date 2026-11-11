import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { CompareView } from "./compare-view";
import { ORIGINS, SITE_SIDE } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI translation comparison",
  robots: { index: false },
};

export default function ComparePage() {
  if (SITE_SIDE !== "scriptures") permanentRedirect(`${ORIGINS.scriptures}/compare`); // scripture translations: Verses Across
  return <CompareView />;
}
