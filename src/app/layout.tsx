import type { Metadata, Viewport } from "next";
import { Inter, Noto_Naskh_Arabic, Noto_Serif, Noto_Serif_Hebrew, Source_Serif_4 } from "next/font/google";
import { STORAGE_KEY, THEME_INIT_SCRIPT } from "@/lib/theme-script";
import { catalog } from "@/lib/catalog";
import { LIBRARY_SHELVES } from "@/lib/site";
import { SITE_NAME, SITE_ORIGIN, SITE_SIDE, SITE_TAGLINE } from "@/lib/site";
import { DomainMove } from "@/components/domain-move";
import { OfflineSupport } from "@/components/offline";
import { FeedbackHost } from "@/components/feedback-dialog";
import { NavSteps } from "@/components/nav-steps";
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

/**
 * The works on Verses Across' shelves (~110 ids, ~1.3 KB; the Library's ~1,100 would be ~29 KB): the tab-bar script
 * below counts only this site's books, as tabs.tsx does with sideOfWork (a work not on the Library's shelves).
 */
const LIBRARY_WORKS = new Set(catalog.religions.filter((r) => LIBRARY_SHELVES.has(r.id)).flatMap((r) => r.collections.flatMap((c) => c.items.map((i) => i.work))));
const SCRIPTURE_WORK_IDS = [
  ...new Set(
    catalog.religions
      .filter((r) => !LIBRARY_SHELVES.has(r.id))
      .flatMap((r) => r.collections.flatMap((c) => c.items.map((i) => i.work).filter((w): w is string => !!w && !LIBRARY_WORKS.has(w)))),
  ),
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${reading.variable} ${greek.variable} ${hebrew.variable} ${arabic.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* The open-books tab bar (tabs.tsx) shows only once the saved settings are read, after the first paint, and
            pushed the whole page down as it appeared (layout shift). Same test as tabs.tsx, before the first paint:
            two or more of this site's books open (of the first 60, MAX_TABS in settings.ts) → <html data-tabs>, and its space is kept (globals.css). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}");var t=Array.isArray(s.tabs)?s.tabs.filter(function(x){return typeof x==="string"}).slice(0,60):[];var S=${JSON.stringify(SCRIPTURE_WORK_IDS)},lib=${JSON.stringify(SITE_SIDE === "library")},n=0;for(var i=0;i<t.length;i++)if((S.indexOf(t[i].split("/")[0])<0)===lib)n++;if(n>1)document.documentElement.setAttribute("data-tabs","")}catch(e){}})();`,
          }}
        />
        {/* Desktop Safari (older versions) keeps 100dvh at the size the window had when the page loaded, so after
            leaving full screen or resizing, the top bar and the bottom (Read aloud button) end up off screen. There
            the page height follows the real window height instead (--app-h, used by .h-app). Ticket 637f3496. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var u=navigator.userAgent;if(!/Safari\\//.test(u)||/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(u)||navigator.maxTouchPoints>1)return;var d=document.documentElement;function f(){d.style.setProperty("--app-h",innerHeight+"px");if(d.scrollTop)d.scrollTop=0;if(document.body&&document.body.scrollTop)document.body.scrollTop=0}f();addEventListener("resize",f);addEventListener("pageshow",f)})();`,
          }}
        />
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
        <NavSteps />
        {children}
        <FeedbackHost />
      </body>
    </html>
  );
}
