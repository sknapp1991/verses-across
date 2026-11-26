import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SITE_SIDE } from "@/lib/site";
import { BadgeView } from "@/components/issued-badge";

/**
 * A badge link from the team hub (https://versesacross.com/badge#<payload>.<signature>.<holder key>): all three parts
 * stay in the fragment, so they are never sent to the server, and the page clears the address bar once it has read
 * them. It checks the signature, the holder key and the revoked list, and can keep the badge on this device.
 * Not linked from anywhere, not in the sitemap, not indexed.
 */
export const metadata: Metadata = {
  title: "A badge",
  description: "A badge from the Verses Across team.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  if (SITE_SIDE !== "scriptures") notFound();
  return <BadgeView />;
}
