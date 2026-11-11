import type { Metadata, Viewport } from "next";
import { Inter, Noto_Naskh_Arabic, Noto_Serif, Noto_Serif_Hebrew, Source_Serif_4 } from "next/font/google";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import { SITE_NAME, SITE_ORIGIN, SITE_SIDE, SITE_TAGLINE } from "@/lib/site";
import { DomainMove } from "@/components/domain-move";
import { OfflineSupport } from "@/components/offline";
import { FeedbackHost } from "@/components/feedback-dialog";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const reading = Source_Serif_4({ variable: "--font-reading", subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"] });
// Script-specific reading fonts: not preloaded, the browser fetches them only when that language is on screen.
const greek = Noto_Serif({ variable: "--font-greek", subsets: ["greek", "greek-ext"], preload: false });
const hebrew = Noto_Serif_Hebrew({ variable: "--font-hebrew", subsets: ["hebrew"], preload: false });
const arabic = Noto_Naskh_Arabic({ variable: "--font-arabic", subsets: ["arabic"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  // The home page's main address; chapter pages and About set their own.
  alternates: { canonical: "/" },
  // Link previews (texts, chats, social): the image comes from app/opengraph-image.png.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_TAGLINE,
  },
  appleWebApp: { title: SITE_NAME, capable: true, statusBarStyle: "default" },
  // Google Search Console and Bing Webmaster Tools ownership (keep: removing them un-verifies the site).
  // (versesacross.com's; Library Across gets its own when it's added to Search Console.)
  ...(SITE_SIDE === "scriptures"
    ? { verification: { google: "3nW8X3kaJ6HidJ_6O0hgpA9djiA7-qqybFpv6DzR4Ik", other: { "msvalidate.01": "3A234127FCC4DA14DFBE86FE4E25CE77" } } }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#15130f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${reading.variable} ${greek.variable} ${hebrew.variable} ${arabic.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Android / Chrome: keep the "install this app" offer for the Add to Home Screen card (install-app.tsx). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__vaInstall=e;dispatchEvent(new Event("va-bip"))});`,
          }}
        />
      </head>
      <body className="overflow-hidden">
        <DomainMove />
        <OfflineSupport />
        {children}
        <FeedbackHost />
      </body>
    </html>
  );
}
