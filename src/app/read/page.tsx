import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";
import { SITE_SIDE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Home",
  description:
    SITE_SIDE === "library"
      ? "Continue reading, take the tour, find themes and books like the ones you love."
      : "Continue reading, take the tour, explore themes and reading plans across the world's scriptures.",
  // The site's address ("/") is the one search engines know; this page is the app's own home screen.
  robots: { index: false, follow: true },
};

/** The home page, inside the reading frame (src/app/read/layout.tsx). */
export default function ReadHome() {
  return <HomePage />;
}
