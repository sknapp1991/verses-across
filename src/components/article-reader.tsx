"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BackLink, PageChrome } from "@/components/page-chrome";
import { DEPTH_LABEL, DEPTHS, volumeName, type Article, type Depth } from "@/lib/articles";

const PREF = "va-article-depth:v1"; // localStorage: the depth a reader last chose
const a = "underline underline-offset-2 hover:text-ink";

/** Prose styles for the article body (no typography plugin: the few elements articles use). */
const PROSE =
  "space-y-4 leading-relaxed text-ink/90 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:scroll-mt-20 [&_h2]:pt-4 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:scroll-mt-20 [&_h3]:pt-2 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-ink [&_hr]:my-8 [&_hr]:border-line [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-6";

function pickDepth(article: Article): Depth {
  const have = DEPTHS.filter((d) => article.tiers[d]);
  try {
    const q = new URLSearchParams(window.location.search).get("depth") as Depth | null;
    if (q && have.includes(q)) return q;
    const saved = localStorage.getItem(PREF) as Depth | null;
    if (saved && have.includes(saved)) return saved;
  } catch {
    /* storage blocked: defaults */
  }
  return have.includes("medium") ? "medium" : have[0];
}

/**
 * One article in up to three depths (Short / Medium / Extensive) on one page: a switch under the title, remembered
 * for the next article, shareable with ?depth=; a reading-progress bar; contents for the longer depths.
 */
export function ArticleReader({ article }: { article: Article }) {
  const have = DEPTHS.filter((d) => article.tiers[d]);
  const [depth, setDepth] = useState<Depth>(have.includes("medium") ? "medium" : have[0]);
  const [progress, setProgress] = useState(0);
  const scroller = useRef<HTMLElement>(null);

  // The saved / linked depth, once on the client (the server renders the default).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address and this browser are only readable after hydration
    setDepth(pickDepth(article));
  }, [article]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => setProgress(el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [depth]);

  const choose = (d: Depth) => {
    setDepth(d);
    try {
      localStorage.setItem(PREF, d);
    } catch {
      /* fine without */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("depth", d);
    window.history.replaceState(null, "", url);
    scroller.current?.scrollTo({ top: 0 });
  };

  const tier = article.tiers[depth]!;
  const date = new Date(`${article.date}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main ref={scroller} className="h-app overflow-y-auto bg-paper text-muted">
      <div className="fixed inset-x-0 top-0 z-30 h-1 bg-transparent" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <PageChrome fallback="/articles" />
      <article className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 md:px-8">
        {article.status !== "published" && (
          <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-ink">
            <strong>Preview for review — not published.</strong> This page is unlisted and hidden from search engines until it is
            approved.
          </p>
        )}
        <header className="space-y-3">
          <BackLink fallback="/articles" className={`text-sm ${a}`}>
            ← Articles
          </BackLink>
          <p className="text-xs uppercase tracking-wide">
            Volume {article.volume} · {volumeName(article.volume)}
          </p>
          <h1 className="font-serif text-3xl font-semibold text-ink md:text-4xl">{article.title}</h1>
          {article.subtitle && <p className="font-serif text-lg">{article.subtitle}</p>}
          <p className="text-sm">
            The Verses Across team · {date} · {tier.minutes} min read
          </p>
          {have.length > 1 && (
            <div role="tablist" aria-label="Reading depth" className="inline-flex rounded-full border border-line bg-panel p-1 text-sm">
              {have.map((d) => (
                <button
                  key={d}
                  role="tab"
                  aria-selected={d === depth}
                  onClick={() => choose(d)}
                  className={`rounded-full px-3 py-1.5 transition ${d === depth ? "bg-ink text-paper" : "hover:text-ink"}`}
                >
                  {DEPTH_LABEL[d]} · {article.tiers[d]!.minutes} min
                </button>
              ))}
            </div>
          )}
        </header>

        {depth !== "short" && tier.toc.length > 2 && (
          <details className="rounded-xl border border-line bg-panel px-4 py-3 text-sm" open={depth === "long"}>
            <summary className="cursor-pointer font-medium text-ink">Contents</summary>
            <ol className="mt-2 space-y-1">
              {tier.toc.map((t) => (
                <li key={t.id} className={t.level === 3 ? "pl-4" : ""}>
                  <a href={`#${t.id}`} className={a}>
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        )}

        <div className={PROSE} dangerouslySetInnerHTML={{ __html: tier.html }} />

        <footer className="space-y-2 border-t border-line pt-6 text-sm">
          {article.aiNote && <p>{article.aiNote}</p>}
          <p>
            Quotations from the scriptures are from the public-domain translations on this site.{" "}
            <Link href="/articles" className={a}>
              More articles
            </Link>
          </p>
        </footer>
      </article>
    </main>
  );
}
