import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { ORIGINS, SITE_SIDE } from "@/lib/site";
import { BackLink, PageChrome } from "@/components/page-chrome";
import { ArticlesBrowser } from "@/components/articles-browser";
import index from "../../../public/articles/index.json";
import type { ArticleSummary } from "@/lib/articles";

/** Only published articles are listed (previews in review: /articles?preview=1 loads them in the browser). */
const PUBLISHED = (index as ArticleSummary[]).filter((a) => a.status === "published");

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Articles on the world's scriptures, symbols and ideas, each in up to three depths: a short read, a medium one and an extensive study.",
  alternates: { canonical: "/articles" },
  ...(PUBLISHED.length ? {} : { robots: { index: false, follow: true } }), // indexed once the first article is up
};

const a = "underline underline-offset-2 hover:text-ink";

/**
 * Articles (ROADMAP AR, my brother's design, hub 5e5cf67c): published articles with search and filters, and the ten
 * volumes. Articles: data/articles/<slug>/ → scripts/build-articles.mts → public/articles/.
 */
export default function ArticlesPage() {
  if (SITE_SIDE !== "scriptures") permanentRedirect(`${ORIGINS.scriptures}/articles`); // a Verses Across page
  return (
    <main className="h-app overflow-y-auto bg-paper text-muted">
      <PageChrome fallback="/read" />
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <BackLink fallback="/read" className={`text-sm ${a}`}>
            ← Home
          </BackLink>
          <h1 className="font-serif text-3xl font-semibold text-ink">Articles</h1>
          <p>
            Articles on the world&rsquo;s scriptures, symbols and ideas: what the traditions say, where they meet and where they
            differ. Each comes in up to three depths: a short read, a medium one and an extensive study. Switch at the top of an article.
          </p>
        </header>
        <ArticlesBrowser articles={PUBLISHED} />
      </div>
    </main>
  );
}
