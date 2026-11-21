"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { findRefs } from "@/lib/refs";
import { RefLink } from "@/components/ref-link";
import { AiWord, looksForeign } from "@/components/ai-word";
import { BackLink, PageChrome } from "@/components/page-chrome";
import { DEPTH_LABEL, DEPTHS, volumeName, type Article, type Depth } from "@/lib/articles";

const PREF = "va-article-depth:v1"; // localStorage: the depth a reader last chose
const ANSWERS = "va-article-answers:v1"; // localStorage: { "slug/depth/n": answer } (this device only)
const READ = "va-article-read:v1"; // localStorage: { slug: { depth: "YYYY-MM-DD" } }

function load<T>(key: string, empty: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? empty;
  } catch {
    return empty;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: nothing kept */
  }
}

/** A box under a reflection question; the answer is kept on this device as it's typed. */
function Answer({ id, question }: { id: string; question: string }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this browser's saved answer is only readable after hydration
    setText(load<Record<string, string>>(ANSWERS, {})[id] ?? "");
  }, [id]);
  const store = (v: string) => {
    clearTimeout(timer.current);
    const all = load<Record<string, string>>(ANSWERS, {});
    if (v.trim()) all[id] = v;
    else delete all[id];
    save(ANSWERS, all);
    setSaved(true);
  };
  const change = (v: string) => {
    setText(v);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => store(v), 500);
  };
  return (
    <span className="mt-2 block">
      <textarea
        value={text}
        onChange={(e) => change(e.target.value)}
        onBlur={(e) => store(e.target.value)}
        rows={3}
        aria-label={`Your answer: ${question}`}
        placeholder="Your answer (kept on this device only)"
        className="block w-full resize-y rounded-lg border border-line bg-panel px-3 py-2 font-sans text-base not-italic text-ink placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <span aria-live="polite" className="mt-1 block h-4 font-sans text-xs text-faint">
        {saved && text.trim() ? "Saved on this device" : ""}
      </span>
    </span>
  );
}

/**
 * The article's text. Scripture references become links with a preview card (like Ask AI's), opening in one
 * shared tab; each reflection question gets an answer box. The HTML comes from build-articles (escaped there).
 * Memo: the page's progress bar re-renders on every scroll, and this must not rebuild the text each time.
 */
const ArticleBody = memo(function ArticleBody({ html, slug, depth }: { html: string; slug: string; depth: Depth }) {
  const box = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<{ el: HTMLElement; node: ReactNode }[]>([]);
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    root.innerHTML = html; // start from the built HTML each time (the effect can run twice in development)
    // each list item's words before the italic words and references become (still empty) slots: the answer boxes' labels
    const said = new Map<Element, string>([...root.querySelectorAll("li")].map((li) => [li, li.textContent ?? ""]));
    const out: { el: HTMLElement; node: ReactNode }[] = [];
    // An italic word from another language (*hishtachaveh*, *proskuneo*) gets the same word card as Ask AI.
    for (const em of [...root.querySelectorAll("em")]) {
      const w = em.textContent?.trim() ?? "";
      if (w.length < 3 || /\s/.test(w) || !looksForeign(w) || em.closest("a, h1, h2, h3")) continue;
      const slot = document.createElement("span");
      em.replaceWith(slot);
      // the paragraph names Islam, the Qur'an or Arabic: prefer the Arabic dictionary (*din*, *salah*, *ibadah*)
      const about = em.closest("p, li, blockquote")?.textContent ?? "";
      const arabic = /\b(arabic|islam\w*|muslim\w*|qur'?an|koran|sufi\w*|allah)\b/i.test(about);
      out.push({ el: slot, node: <AiWord word={w} italic notEnglish={!/[^\x00-\x7F]/.test(w)} arabic={arabic} /> });
    }
    // References in the running text (not inside links or headings).
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walk.nextNode()) {
      const t = walk.currentNode as Text;
      if (!t.parentElement?.closest("a, h1, h2, h3")) texts.push(t);
    }
    for (const t of texts) {
      const refs = findRefs(t.data);
      if (!refs.length) continue;
      const frag = document.createDocumentFragment();
      let at = 0;
      for (const r of refs) {
        frag.append(t.data.slice(at, r.start));
        const slot = document.createElement("span");
        frag.append(slot);
        out.push({ el: slot, node: <RefLink r={r} target="va-verses" /> });
        at = r.end;
      }
      frag.append(t.data.slice(at));
      t.replaceWith(frag);
    }
    // An answer box under each question of the Reflection section (the list right after its heading).
    const head = [...root.querySelectorAll("h2")].find((h) => /^reflection$/i.test(h.textContent?.trim() ?? ""));
    for (let el = head?.nextElementSibling; el && el.tagName !== "H2"; el = el.nextElementSibling) {
      if (el.tagName !== "UL" && el.tagName !== "OL") continue;
      [...el.children].forEach((li, n) => {
        const slot = document.createElement("span");
        li.append(slot);
        out.push({ el: slot, node: <Answer id={`${slug}/${depth}/${n}`} question={said.get(li) ?? ""} /> });
      });
    }
    setSlots(out);
  }, [html, slug, depth]);
  return (
    <>
      <div ref={box} className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
      {slots.map((s, i) => createPortal(s.node, s.el, `${depth}-${i}`))}
    </>
  );
});
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
  const [read, setRead] = useState<Partial<Record<Depth, string>>>({});
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this browser's record is only readable after hydration
    setRead(load<Record<string, Partial<Record<Depth, string>>>>(READ, {})[article.slug] ?? {});
  }, [article.slug]);
  const markRead = (d: Depth, on: boolean) => {
    const all = load<Record<string, Partial<Record<Depth, string>>>>(READ, {});
    const mine = { ...(all[article.slug] ?? {}) };
    if (on) mine[d] = new Date().toLocaleDateString("en-CA"); // this device's date, YYYY-MM-DD
    else delete mine[d];
    if (Object.keys(mine).length) all[article.slug] = mine;
    else delete all[article.slug];
    save(READ, all);
    setRead(mine);
  };

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
  const toc = depth !== "short" && tier.toc.length > 2 ? tier.toc : null;
  // The section being read (for the side contents): the last heading above the top of the screen.
  const [here, setHere] = useState<string | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !toc) return;
    const onScroll = () => {
      let id: string | null = null;
      for (const t of toc) {
        const h = document.getElementById(t.id);
        if (h && h.getBoundingClientRect().top < 120) id = t.id;
      }
      setHere(id);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [toc]);
  const date = new Date(`${article.date}T12:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main ref={scroller} className="h-app overflow-y-auto bg-paper text-muted">
      <div className="fixed inset-x-0 top-0 z-30 h-1 bg-transparent" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <PageChrome fallback="/articles" />
      <div className="mx-auto flex max-w-6xl justify-center gap-10 px-4 md:px-8">
      {toc && (
        <nav aria-label="Contents" className="sticky top-0 hidden max-h-[var(--app-h,100dvh)] w-56 shrink-0 self-start overflow-y-auto overscroll-contain pb-8 pt-24 text-sm xl:block">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Contents</p>
          <ol className="space-y-1 border-l border-line">
            {toc.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  aria-current={here === t.id ? "location" : undefined}
                  className={`-ml-px block border-l-2 py-1 leading-snug ${t.level === 3 ? "pl-6" : "pl-3"} ${
                    here === t.id ? "border-accent font-medium text-ink" : "border-transparent hover:text-ink"
                  }`}
                >
                  {t.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <article className="w-full min-w-0 max-w-3xl space-y-6 pb-16 pt-8">
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
                  {read[d] && (
                    <>
                      <span aria-hidden>✓ </span>
                      <span className="sr-only">Read: </span>
                    </>
                  )}
                  {DEPTH_LABEL[d]} · {article.tiers[d]!.minutes} min
                </button>
              ))}
            </div>
          )}
        </header>

        {toc && (
          <details className="rounded-xl border border-line bg-panel px-4 py-3 text-sm xl:hidden" open={depth === "long"}>
            <summary className="cursor-pointer font-medium text-ink">Contents</summary>
            <ol className="mt-2 space-y-1">
              {toc.map((t) => (
                <li key={t.id} className={t.level === 3 ? "pl-4" : ""}>
                  <a href={`#${t.id}`} className={a}>
                    {t.text}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        )}

        <ArticleBody html={tier.html} slug={article.slug} depth={depth} />

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-ink">
          <input type="checkbox" checked={!!read[depth]} onChange={(e) => markRead(depth, e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
          <span>
            I read the {DEPTH_LABEL[depth]} version
            {read[depth] && (
              <span className="ml-2 text-sm text-muted">
                on {new Date(`${read[depth]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </span>
        </label>

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
      </div>
    </main>
  );
}
