import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ORIGINS, SITE_SIDE } from "@/lib/site";
import index from "../../../../public/articles/index.json";
import type { Article, ArticleSummary } from "@/lib/articles";
import { ArticleReader } from "@/components/article-reader";

const ARTICLES = index as ArticleSummary[];
type Props = { params: Promise<{ slug: string }> };

/** Published articles and those in review (unlisted, noindex previews). Drafts are never built. */
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = ARTICLES.find((x) => x.slug === slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.summary,
    alternates: { canonical: `/articles/${a.slug}` },
    ...(a.status === "published" ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const meta = ARTICLES.find((x) => x.slug === slug);
  if (!meta) notFound();
  if (SITE_SIDE !== "scriptures") permanentRedirect(`${ORIGINS.scriptures}/articles/${slug}`);
  const article = (await import(`../../../../public/articles/${slug}.json`)).default as Article;
  // the bookcase: published articles (a preview also shows the other previews)
  const library = ARTICLES.filter((a) => a.status === "published" || (meta.status !== "published" && a.status === "review"));
  return <ArticleReader article={article} library={library} />;
}
