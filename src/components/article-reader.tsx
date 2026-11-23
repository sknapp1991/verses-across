"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { progressChanged } from "@/lib/achievements";
import { findRefs } from "@/lib/refs";
import { RefLink } from "@/components/ref-link";
import { AiWord, looksForeign } from "@/components/ai-word";
import { BackLink, PageChrome } from "@/components/page-chrome";
import { DEPTH_LABEL, DEPTHS, volumeName, type Article, type ArticleSummary, type Depth, type StudyRef } from "@/lib/articles";
import type { FoundRef } from "@/lib/refs";
import { articleStudyChanged } from "@/lib/article-study";
import { FurtherStudy, RefMention, ShareBar, StudyGuide } from "@/components/article-study";
import { Bookcase } from "@/components/article-bookcase";

const PREF = "va-article-depth:v1"; // localStorage: the depth a reader last chose
const EMPTY_STUDY: StudyRef[] = [];
const ANSWERS = "va-article-answers:v1"; // localStorage: { "slug/q/<question words>": answer } (this device only)
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

/**
 * A box under a reflection question; the answer is kept on this device as it's typed. `id` is the article and the
 * question's own words, so the same question in Short, Medium and Extensive shares one answer (hub e9965564).
 * `legacy`: the key answers had before (slug/depth/position). An old answer there is moved over when the box opens,
 * and joined to the shared one if both exist and differ (two depths answered separately before): nothing is lost.
 */
function Answer({ id, legacy, question }: { id: string; legacy: string; question: string }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  useEffect(() => {
    const all = load<Record<string, string>>(ANSWERS, {});
    const old = all[legacy];
    if (old !== undefined) {
      const now = all[id];
      all[id] = !now ? old : now.includes(old) ? now : `${now}\n\n${old}`;
      delete all[legacy];
      save(ANSWERS, all);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this browser's saved answer is only readable after hydration
    setText(all[id] ?? "");
  }, [id, legacy]);
  const store = (v: string) => {
    clearTimeout(timer.current);
    pending.current = null;
    const all = load<Record<string, string>>(ANSWERS, {});
    if (v.trim()) all[id] = v;
    else delete all[id];
    save(ANSWERS, all);
    setSaved(true);
    progressChanged();
  };
  // switching depth while a save is pending: save it now, before the next depth's box reads the answer
  useEffect(
    () => () => {
      if (pending.current === null) return;
      clearTimeout(timer.current);
      const all = load<Record<string, string>>(ANSWERS, {});
      if (pending.current.trim()) all[id] = pending.current;
      else delete all[id];
      save(ANSWERS, all);
    },
    [id],
  );
  const change = (v: string) => {
    setText(v);
    setSaved(false);
    pending.current = v;
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
const ArticleBody = memo(function ArticleBody({
  html,
  slug,
  title,
  depth,
  study,
  onFound,
}: {
  html: string;
  slug: string;
  title: string;
  depth: Depth;
  study: StudyRef[];
  onFound: (verses: FoundRef[], questions: { q: string; key: string }[]) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<{ el: HTMLElement; node: ReactNode }[]>([]);
  useEffect(() => {
    const root = box.current;
    if (!root) return;
    root.innerHTML = html; // start from the built HTML each time (the effect can run twice in development)
    // each list item's words before the italic words and references become (still empty) slots: the answer boxes' labels
    const said = new Map<Element, string>([...root.querySelectorAll("li")].map((li) => [li, li.textContent ?? ""]));
    const out: { el: HTMLElement; node: ReactNode }[] = [];
    // A word, name or book the Study guide lists: its first mention opens its card (build-articles marks it).
    const byKey = new Map(study.map((r) => [r.key, r]));
    for (const el of [...root.querySelectorAll<HTMLElement>("[data-ref]")]) {
      const r = byKey.get(el.dataset.ref ?? "");
      // (a word with no summary and no explanation keeps the dictionary card below, if it has one: *hishtachaveh*)
      if (!r || (el.tagName === "EM" && !r.card && !r.gloss)) continue;
      const slot = document.createElement("span");
      const text = el.textContent ?? r.label;
      const italic = el.tagName === "EM";
      el.replaceWith(slot);
      out.push({ el: slot, node: <RefMention r={r} ctx={{ slug, articleTitle: title }} italic={italic} text={text} /> });
    }
    // An italic word from another language (*hishtachaveh*, *proskuneo*) gets the same word card as Ask AI.
    for (const em of [...root.querySelectorAll("em")]) {
      const w = em.textContent?.trim() ?? "";
      if (w.length < 3 || /\s/.test(w) || !looksForeign(w) || em.closest("a, h1, h2, h3")) continue;
      const slot = document.createElement("span");
      em.replaceWith(slot);
      // the paragraph names Islam, the Qur'an or Arabic: prefer the Arabic dictionary (*din*, *salah*, *ibadah*)
      const about = slot.closest("p, li, blockquote")?.textContent ?? ""; // (the slot: the <em> has left the page)
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
    const verses: FoundRef[] = [];
    for (const t of texts) {
      const refs = findRefs(t.data);
      verses.push(...refs);
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
    const questions: { q: string; key: string }[] = [];
    const head = [...root.querySelectorAll("h2")].find((h) => /^reflection$/i.test(h.textContent?.trim() ?? ""));
    for (let el = head?.nextElementSibling; el && el.tagName !== "H2"; el = el.nextElementSibling) {
      if (el.tagName !== "UL" && el.tagName !== "OL") continue;
      [...el.children].forEach((li, n) => {
        const slot = document.createElement("span");
        li.append(slot);
        const q = said.get(li) ?? "";
        // the question's words (case, spacing and punctuation aside): the same question in every depth, one answer
        const key = q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 200);
        if (!key) return; // (an empty list item: no box)
        questions.push({ q: q.trim(), key: `${slug}/q/${key}` });
        out.push({ el: slot, node: <Answer id={`${slug}/q/${key}`} legacy={`${slug}/${depth}/${n}`} question={q} /> });
      });
    }
    setSlots(out);
    onFound(verses, questions);
  }, [html, slug, title, depth, study, onFound]);
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
export function ArticleReader({ article, library = [] }: { article: Article; library?: ArticleSummary[] }) {
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
    progressChanged();
    articleStudyChanged(); // the bookcase greys it, My Study lists it
  };
  // what the text holds, found once it is on the page: its verses (the Study guide) and reflection questions (Share)
  const [verses, setVerses] = useState<FoundRef[]>([]);
  const [questions, setQuestions] = useState<{ q: string; key: string }[]>([]);
  const onFound = useCallback((v: FoundRef[], q: { q: string; key: string }[]) => {
    setVerses(v);
    setQuestions(q);
  }, []);
  const answers = () => {
    const all = load<Record<string, string>>(ANSWERS, {});
    return questions.map((q) => all[q.key] ?? "");
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
    <main ref={scroller} className="h-app overflow-y-auto bg-paper text-muted print:h-auto print:overflow-visible">
      {/* (Download PDF prints the whole article: the page's own scroll box is lifted when printing) */}
      <div className="fixed inset-x-0 top-0 z-30 h-1 bg-transparent print:hidden" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="print:hidden">
        <PageChrome fallback="/articles" />
      </div>
      {/* bookcase · contents · the article · Study guide (the widest screens show all four) */}
      <div className="mx-auto flex max-w-[112rem] justify-center gap-8 px-4 md:px-8">
      {library.length > 1 && (
        <aside className="sticky top-0 hidden max-h-[var(--app-h,100dvh)] w-64 shrink-0 self-start overflow-y-auto overscroll-contain pb-8 pt-24 min-[1760px]:block print:hidden">
          <Bookcase articles={library} current={article.slug} />
        </aside>
      )}
      {toc && (
        <nav aria-label="Contents" className="sticky top-0 hidden max-h-[var(--app-h,100dvh)] w-56 shrink-0 self-start overflow-y-auto overscroll-contain pb-8 pt-24 text-sm xl:block print:hidden">
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
      <article className="w-full min-w-0 max-w-3xl space-y-6 pb-16 pt-8 print:max-w-none print:pt-0">
        {article.status !== "published" && (
          <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-ink print:hidden">
            <strong>Preview for review — not published.</strong> This page is unlisted and hidden from search engines until it is
            approved.
          </p>
        )}
        <header className="space-y-3">
          <BackLink fallback="/articles" className={`text-sm print:hidden ${a}`}>
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
            <div role="tablist" aria-label="Reading depth" className="inline-flex rounded-full border border-line bg-panel p-1 text-sm print:hidden">
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
          <ShareBar article={article} depth={depth} questions={questions.map((q) => q.q)} answers={answers} />
        </header>

        <details className="rounded-xl border border-line bg-panel px-4 py-3 text-sm xl:hidden print:hidden">
          <summary className="cursor-pointer font-medium text-ink">Study guide</summary>
          <div className="mt-2">
            <StudyGuide article={article} depth={depth} verses={verses} />
          </div>
        </details>

        {toc && (
          <details className="rounded-xl border border-line bg-panel px-4 py-3 text-sm xl:hidden print:hidden" open={depth === "long"}>
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

        <ArticleBody html={tier.html} slug={article.slug} title={article.title} depth={depth} study={tier.study ?? EMPTY_STUDY} onFound={onFound} />

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-ink print:hidden">
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

        <FurtherStudy article={article} depth={depth} verses={verses} />

        {library.length > 1 && (
          <details className="rounded-xl border border-line bg-panel px-4 py-3 text-sm min-[1760px]:hidden print:hidden">
            <summary className="cursor-pointer font-medium text-ink">Bookcase: more articles</summary>
            <div className="mt-3">
              <Bookcase articles={library} current={article.slug} />
            </div>
          </details>
        )}

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
      <aside aria-label="Study guide" className="sticky top-0 hidden max-h-[var(--app-h,100dvh)] w-72 shrink-0 self-start overflow-y-auto overscroll-contain pb-8 pt-24 xl:block print:hidden">
        <StudyGuide article={article} depth={depth} verses={verses} />
      </aside>
      </div>
    </main>
  );
}
