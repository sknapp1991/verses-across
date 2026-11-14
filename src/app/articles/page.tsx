import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { ORIGINS, SITE_SIDE } from "@/lib/site";
import { BackLink, PageChrome } from "@/components/page-chrome";

export const metadata: Metadata = {
  title: "Articles",
  description: "Articles, research and insights on the world's scriptures: how they came to be, what they say, and how they speak to each other.",
  alternates: { canonical: "/articles" },
  robots: { index: false, follow: true }, // nothing to show yet: indexed once the first articles are up
};

const a = "underline underline-offset-2 hover:text-ink";

/**
 * Articles (ticket e1decd4b, the brother's idea, Nov 13): a home-page tile and this page, empty for now. Later a
 * place for blog-like articles, research and insights. How articles are written, signed and approved is still to be
 * decided with Skylar (the brother's name never appears in public).
 */
export default function ArticlesPage() {
  if (SITE_SIDE !== "scriptures") permanentRedirect(`${ORIGINS.scriptures}/articles`); // a Verses Across page
  return (
    <main className="h-app overflow-y-auto bg-paper text-muted">
      <PageChrome fallback="/read" />
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <BackLink fallback="/read" className={`text-sm ${a}`}>
            ← Home
          </BackLink>
          <h1 className="font-serif text-3xl font-semibold text-ink">Articles</h1>
          <p>Articles, research and insights on the world&rsquo;s scriptures: how they came to be, what they say, and how they speak to each other.</p>
        </header>
        <section className="rounded-2xl border border-dashed border-line bg-panel px-5 py-8 text-center">
          <p className="font-serif text-xl text-ink">The first articles are on their way.</p>
          <p className="mt-2 text-sm">
            Meanwhile, read{" "}
            <Link href="/bible-history" className={a}>
              How the Bible came to be
            </Link>{" "}
            or{" "}
            <Link href="/differences" className={a}>
              Why Bibles differ
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
