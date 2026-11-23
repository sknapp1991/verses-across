"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { depthBadges, VOLUMES, volumeName, type ArticleSummary } from "@/lib/articles";
import { setLibraryView, useLibraryView } from "@/lib/article-study";
import { Bookcase } from "./article-bookcase";

/** The Library view switch, top right of the Articles page (my brother's ticket e555be87). */
export function LibraryViewToggle() {
  const on = useLibraryView();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setLibraryView(!on)}
      title={on ? "Back to the list" : "See the articles as books on shelves"}
      className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition ${on ? "border-accent bg-accent-soft text-accent" : "border-line bg-panel text-ink hover:border-faint"}`}
    >
      <span aria-hidden>📚 </span>Library view
    </button>
  );
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** The articles landing page: search, filters (volume, tradition, has an Extensive depth) and the ten volumes. */
export function ArticlesBrowser({ articles: published }: { articles: ArticleSummary[] }) {
  // Articles in review are listed only on /articles?preview=1 (for checking before publication): their summaries are
  // fetched then, so they are not in the page every visitor gets.
  const [review, setReview] = useState<ArticleSummary[]>([]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preview") !== "1") return;
    fetch("/articles/index.json")
      .then((r) => r.json() as Promise<ArticleSummary[]>)
      .then((all) => setReview(all.filter((a) => a.status === "review")))
      .catch(() => {});
  }, []);
  const articles = useMemo(() => [...review, ...published], [review, published]);
  const [q, setQ] = useState("");
  // "/articles?theme=duality" (a theme from an article's Study guide): start with that search
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only readable after hydration
    if (t) setQ(t);
  }, []);
  const [vol, setVol] = useState(0);
  const [trad, setTrad] = useState("");
  const [deep, setDeep] = useState(false);
  const traditions = useMemo(() => [...new Set(articles.flatMap((a) => a.traditions))].sort(), [articles]);
  const shown = useMemo(() => articles.filter((a) => {
    if (vol && a.volume !== vol) return false;
    if (trad && !a.traditions.includes(trad)) return false;
    if (deep && !a.depths.long) return false;
    if (!q.trim()) return true;
    const hay = norm([a.title, a.subtitle, a.summary, ...a.themes, ...a.traditions, volumeName(a.volume)].join(" "));
    return norm(q)
      .split(/\s+/)
      .every((w) => hay.includes(w));
  }), [articles, vol, trad, deep, q]);
  const count = (n: number) => articles.filter((a) => a.volume === n).length;
  const library = useLibraryView();
  const field = "rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink";

  return (
    <div className="space-y-8">
      {articles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles (a theme, a word, a tradition)…"
            aria-label="Search articles"
            className={`${field} min-w-0 flex-1 basis-64`}
          />
          <select value={vol} onChange={(e) => setVol(Number(e.target.value))} aria-label="Volume" className={field}>
            <option value={0}>All volumes</option>
            {VOLUMES.map((v) => (
              <option key={v.n} value={v.n}>
                {v.n}. {v.name}
              </option>
            ))}
          </select>
          {traditions.length > 1 && (
            <select value={trad} onChange={(e) => setTrad(e.target.value)} aria-label="Tradition" className={field}>
              <option value="">All traditions</option>
              {traditions.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={deep} onChange={(e) => setDeep(e.target.checked)} /> Has an Extensive read
          </label>
        </div>
      )}

      {articles.length > 0 && shown.length > 0 && library ? (
        // the whole page as a bookcase: a shelf per volume, the search above still narrowing it
        <Bookcase articles={shown} current="" wide volumeCounts={Object.fromEntries(VOLUMES.map((v) => [v.n, count(v.n)]))} />
      ) : articles.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line bg-panel px-5 py-8 text-center">
          <p className="font-serif text-xl text-ink">The first articles are on their way.</p>
          <p className="mt-2 text-sm">Each will come in up to three depths: a short read, a medium one, and an extensive study.</p>
        </section>
      ) : shown.length === 0 ? (
        <p className="text-sm">No article matches. Try fewer words or another volume.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((a) => (
            <li key={a.slug}>
              <Link href={`/articles/${a.slug}`} className="block h-full rounded-2xl border border-line bg-panel p-4 transition hover:border-ink/40">
                <p className="text-xs uppercase tracking-wide">
                  Volume {a.volume} · {volumeName(a.volume)}
                  {a.status !== "published" && <span className="ml-2 rounded bg-amber-500/20 px-1.5 text-ink">In review</span>}
                </p>
                <p className="mt-1 font-serif text-lg font-semibold text-ink">{a.title}</p>
                {a.subtitle && <p className="text-sm">{a.subtitle}</p>}
                <p className="mt-2 text-sm">{a.summary}</p>
                <p className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {depthBadges(a).map((b) => (
                    <span key={b} className="rounded-full border border-line px-2 py-0.5">
                      {b}
                    </span>
                  ))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!library && (
      <section className="space-y-3">
        <h2 className="font-serif text-xl font-semibold text-ink">The ten volumes</h2>
        <ol className="grid gap-2 sm:grid-cols-2">
          {VOLUMES.map((v) => (
            <li key={v.n} className="rounded-xl border border-line px-4 py-3 text-sm">
              <button type="button" onClick={() => setVol(v.n)} disabled={!count(v.n)} className="w-full text-left disabled:cursor-default">
                <span className="font-medium text-ink">
                  {v.n}. {v.name}
                </span>
                <span className="block">{v.scope}</span>
                <span className="block text-xs">{count(v.n) ? `${count(v.n)} article${count(v.n) > 1 ? "s" : ""}` : "Coming"}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      )}
    </div>
  );
}
