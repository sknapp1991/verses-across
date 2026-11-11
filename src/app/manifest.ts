import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_SIDE } from "@/lib/site";

/** "Add to Home Screen" / install, and the Android app (a Trusted Web Activity of this site). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      SITE_SIDE === "library"
        ? "Read the classics free: novels, poetry, drama, children's books, Freethought and Psychology, from Project Gutenberg. Read-aloud, word help, notes. Free, no ads."
        : "Read the world's scriptures side by side, in many languages: the Bible, Quran, Torah, Gita, Dhammapada and more. Audio read-aloud, word study, cross references. Free, no ads.",
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfaf7",
    theme_color: SITE_SIDE === "library" ? "#1d4034" : "#1f3a5f", // each site's logo colour
    categories: ["books", "education", "reference"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts:
      SITE_SIDE === "library"
        ? [{ name: "Continue reading", url: "/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] }]
        : [
            { name: "Verse of the day", url: "/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
            { name: "John 3", url: "/read/bible/jhn/3", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          ],
  };
}
