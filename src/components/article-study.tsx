"use client";
/**
 * The articles' study tools (my brother's design, hub 9c346b55 and b53fdab9, Nov 22):
 * - a Study guide beside the text: the verses, words from other languages, names, books and themes the article
 *   mentions, and related articles, each with a check mark to save it for study (My Study → Articles);
 * - a card for each word, name and book: the article's own explanation, a short summary from Wikipedia or Wiktionary
 *   (CC BY-SA, fetched ahead of time, credited and linked) and the same check mark; the first mention in the text
 *   opens it too;
 * - "Further study" at the end: related articles, the texts the article quotes, the books it names;
 * - Share (a link, with the reflection questions and, only if ticked, your answers) and Download PDF (print).
 */
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { readHref } from "@/lib/catalog";
import type { FoundRef } from "@/lib/refs";
import { RefLink } from "@/components/ref-link";
import { toggleSaved, useSavedRefs, type SavedKind, type SavedRef } from "@/lib/article-study";
import type { Article, Depth, StudyRef } from "@/lib/articles";
import { CheckIcon, CloseIcon, ShareIcon } from "./icons";

type Ctx = { slug: string; articleTitle: string };

/** The check mark that saves an item for study. */
export function SaveTick({ item, ctx, label }: { item: Omit<SavedRef, "at" | "slug" | "articleTitle">; ctx: Ctx; label: string }) {
  const saved = useSavedRefs();
  const on = !!saved[item.id];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={on ? `Saved for study: ${label}. Remove` : `Save for study: ${label}`}
      title={on ? "Saved for study (My Study → Articles)" : "Save for study"}
      onClick={() => toggleSaved({ ...item, slug: ctx.slug, articleTitle: ctx.articleTitle }, !on)}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
        on ? "border-accent bg-accent text-paper" : "border-line text-transparent hover:border-accent hover:text-accent"
      }`}
    >
      <CheckIcon width={14} height={14} />
    </button>
  );
}

const KIND_LABEL: Record<StudyRef["kind"], string> = { word: "Word", name: "Name", book: "Book" };

/** A word's, name's or book's card. */
export function RefCard({ r, ctx, onClose }: { r: StudyRef; ctx: Ctx; onClose?: () => void }) {
  const [more, setMore] = useState(false);
  const text = r.card?.text ?? "";
  const long = text.length > 420;
  return (
    <span role="region" aria-label={`${KIND_LABEL[r.kind]}: ${r.label}`} className="my-1.5 block rounded-lg border border-line bg-raised p-3 text-sm font-normal not-italic text-ink">
      <span className="mb-1 flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-faint">
            {r.kind === "word" ? (r.lang ?? "Word") : r.kind === "book" ? `Book${r.by ? ` · ${r.by}` : ""}` : "Name"}
          </span>
          <span className={`block font-serif text-lg ${r.kind === "word" || r.kind === "book" ? "italic" : ""}`}>{r.label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <SaveTick item={{ id: r.key, kind: r.kind, label: r.label, href: r.read ?? r.card?.url }} ctx={ctx} label={r.label} />
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface">
              <CloseIcon width={14} height={14} />
            </button>
          )}
        </span>
      </span>
      {r.gloss && (
        <span className="mb-1.5 block">
          <span className="text-muted">In this article: </span>
          {r.gloss}
        </span>
      )}
      {text && (
        <span className="block leading-snug text-ink/90">
          {long && !more ? `${text.slice(0, 400).replace(/\s+\S*$/, "")}… ` : `${text} `}
          {long && (
            <button type="button" onClick={() => setMore((m) => !m)} className="text-accent hover:underline">
              {more ? "less" : "more"}
            </button>
          )}
        </span>
      )}
      {r.card && (
        <span className="mt-1.5 block text-xs text-faint">
          From{" "}
          <a href={r.card.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">
            {r.card.source}: {r.card.title} ↗
          </a>{" "}
          (CC BY-SA 4.0)
        </span>
      )}
      {r.read && (
        <span className="mt-1 block text-xs">
          <Link href={r.read} className="text-accent underline underline-offset-2">
            Read it in the library
          </Link>
        </span>
      )}
      {!text && !r.gloss && <span className="block text-muted">No summary yet.</span>}
    </span>
  );
}

/** A word, name or book in the text: tap to open its card under it. */
export function RefMention({ r, ctx, italic, text }: { r: StudyRef; ctx: Ctx; italic: boolean; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={r.kind === "name" ? "Who this is" : r.kind === "book" ? "About this book" : "What this word means"}
        className={`font-medium text-accent underline decoration-dotted underline-offset-4 hover:decoration-solid ${italic ? "italic" : ""}`}
      >
        {text}
      </button>
      {open && <RefCard r={r} ctx={ctx} onClose={() => setOpen(false)} />}
    </>
  );
}

/** One section of the Study guide: a title with its count, open or folded. */
function Section({ title, count, children, open }: { title: string; count: number; children: ReactNode; open?: boolean }) {
  if (!count) return null;
  return (
    <details open={open} className="group py-1.5">
      {/* (a filled bar, my brother's ticket 7873673b) */}
      <summary className="flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden justify-between gap-2 rounded-md bg-raised px-2.5 py-1.5 text-sm font-semibold text-ink hover:bg-accent-soft">
        <span>
          {title} <span className="font-normal text-faint">{count}</span>
        </span>
        <span aria-hidden className="text-faint transition group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="mt-1.5 space-y-1 px-1">{children}</div>
    </details>
  );
}

/** A row in the guide: a tick, then the item (a link, or a button that opens its card). */
function Row({ tick, children }: { tick: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {tick}
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}

function RefRow({ r, ctx }: { r: StudyRef; ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  return (
    <Row tick={<SaveTick item={{ id: r.key, kind: r.kind, label: r.label, href: r.read ?? r.card?.url }} ctx={ctx} label={r.label} />}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-left hover:text-accent">
        <span className={r.kind === "name" ? "" : "italic"}>{r.label}</span>
        {r.kind === "word" && r.lang && <span className="ml-1.5 text-xs text-faint">{r.lang}</span>}
        {r.kind === "book" && r.by && <span className="ml-1.5 text-xs text-faint">{r.by}</span>}
      </button>
      {open && <RefCard r={r} ctx={ctx} onClose={() => setOpen(false)} />}
    </Row>
  );
}

/** The verses the article cites, once each, in order. */
export function uniqueVerses(found: FoundRef[]) {
  const seen = new Set<string>();
  return found.filter((r) => {
    const k = `${r.ref.work}/${r.ref.book}/${r.ref.chapter}/${r.verse ?? ""}/${r.to ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The Study guide: beside the text on wide screens, folded under the title on narrow ones. */
export function StudyGuide({ article, depth, verses }: { article: Article; depth: Depth; verses: FoundRef[] }) {
  const ctx = { slug: article.slug, articleTitle: article.title };
  const refs = article.tiers[depth]?.study ?? [];
  const words = refs.filter((r) => r.kind === "word");
  const names = refs.filter((r) => r.kind === "name");
  const books = refs.filter((r) => r.kind === "book");
  const vs = useMemo(() => uniqueVerses(verses), [verses]);
  const tick = (id: string, kind: SavedKind, label: string, href?: string) => <SaveTick item={{ id, kind, label, href }} ctx={ctx} label={label} />;
  const total = vs.length + refs.length + article.themes.length + (article.related?.length ?? 0);
  if (!total) return null;
  return (
    <div className="text-muted">
      <p className="mb-2 px-1 text-xs text-faint">Tick anything to save it for study (My Study → Articles).</p>
      <Section title="Verses" count={vs.length} open>
        {vs.map((r) => {
          const href = readHref(r.ref, undefined, r.verse && r.to ? `${r.verse}-${r.to}` : r.verse);
          return (
            <Row key={r.label + r.start} tick={tick(`v:${r.label}`, "verse", r.label, href)}>
              <RefLink r={r} target="va-verses" />
            </Row>
          );
        })}
      </Section>
      <Section title="Words from other languages" count={words.length} open>
        {words.map((r) => (
          <RefRow key={r.key} r={r} ctx={ctx} />
        ))}
      </Section>
      <Section title="Names" count={names.length}>
        {names.map((r) => (
          <RefRow key={r.key} r={r} ctx={ctx} />
        ))}
      </Section>
      <Section title="Books" count={books.length}>
        {books.map((r) => (
          <RefRow key={r.key} r={r} ctx={ctx} />
        ))}
      </Section>
      <Section title="Themes" count={article.themes.length}>
        {article.themes.map((t) => (
          <Row key={t} tick={tick(`t:${t}`, "theme", t, `/articles?theme=${encodeURIComponent(t)}`)}>
            <Link href={`/articles?theme=${encodeURIComponent(t)}`} className="capitalize hover:text-accent">
              {t}
            </Link>
          </Row>
        ))}
      </Section>
      <Section title="Related articles" count={article.related?.length ?? 0}>
        {article.related?.map((a) => (
          <Row key={a.slug} tick={tick(`a:${a.slug}`, "article", a.title, `/articles/${a.slug}`)}>
            <Link href={`/articles/${a.slug}`} className="hover:text-accent">
              {a.title}
            </Link>
            {a.shared.length > 0 && <span className="block text-xs text-faint">{a.shared.join(" · ")}</span>}
          </Row>
        ))}
      </Section>
    </div>
  );
}

/** "Further study", at the end of the article: related articles, the texts it quotes, the books it names. */
export function FurtherStudy({ article, depth, verses }: { article: Article; depth: Depth; verses: FoundRef[] }) {
  const ctx = { slug: article.slug, articleTitle: article.title };
  const books = (article.tiers[depth]?.study ?? []).filter((r) => r.kind === "book");
  // the texts quoted: each book of scripture once, with its chapters
  const texts = useMemo(() => {
    const m = new Map<string, { label: string; ref: FoundRef["ref"]; chapters: Set<number> }>();
    for (const r of verses) {
      const k = `${r.ref.work}/${r.ref.book}`;
      const name = r.label.replace(/\s+\d[\d:–\-, ]*$/, "");
      const e = m.get(k) ?? { label: name, ref: r.ref, chapters: new Set<number>() };
      e.chapters.add(r.ref.chapter);
      m.set(k, e);
    }
    return [...m.values()];
  }, [verses]);
  if (!article.related?.length && !texts.length && !books.length) return null;
  return (
    <section aria-labelledby="further-study" className="space-y-4 rounded-2xl border border-line bg-panel p-4 print:hidden">
      <h2 id="further-study" className="font-serif text-xl font-semibold text-ink">
        Further study
      </h2>
      {article.related && article.related.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Related articles</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {article.related.map((a) => (
              <Link key={a.slug} href={`/articles/${a.slug}`} className="block rounded-xl border border-line bg-paper p-3 hover:border-accent">
                <span className="block font-serif text-ink">{a.title}</span>
                {a.shared.length > 0 && <span className="mt-0.5 block text-xs text-faint">{a.shared.join(" · ")}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
      {texts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Read the texts it quotes</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {texts.map((t) =>
              [...t.chapters]
                .sort((a, b) => a - b)
                .slice(0, 4)
                .map((c) => {
                  const href = readHref({ ...t.ref, chapter: c });
                  const label = `${t.label} ${c}`;
                  return (
                    <li key={`${t.label}-${c}`} className="flex items-center gap-1.5 rounded-full border border-line bg-paper py-1 pl-1 pr-3">
                      <SaveTick item={{ id: `c:${t.ref.work}/${t.ref.book}/${c}`, kind: "text", label, href }} ctx={ctx} label={label} />
                      <Link href={href} className="hover:text-accent">
                        {label}
                      </Link>
                    </li>
                  );
                }),
            )}
          </ul>
        </div>
      )}
      {books.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Books it names</p>
          <div className="space-y-1">
            {books.map((r) => (
              <RefRow key={r.key} r={r} ctx={ctx} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Share and Download PDF. Share sends the link (the phone's share sheet, or copied), optionally with the article's
 * reflection questions and, only if ticked, this reader's own answers (kept private otherwise).
 */
export function ShareBar({ article, depth, questions, answers }: { article: Article; depth: Depth; questions: string[]; answers: () => string[] }) {
  const [open, setOpen] = useState(false);
  const [withQs, setWithQs] = useState(true);
  const [withAnswers, setWithAnswers] = useState(false);
  const [done, setDone] = useState("");
  const share = async () => {
    const url = `${window.location.origin}/articles/${article.slug}?depth=${depth}`;
    const lines = [article.title, url];
    if (withQs && questions.length) {
      const ans = withAnswers ? answers() : [];
      lines.push("", "Reflection:");
      questions.forEach((q, i) => {
        lines.push(`${i + 1}. ${q}`);
        if (withAnswers && ans[i]?.trim()) lines.push(`   My answer: ${ans[i].trim()}`);
      });
    }
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        // (the link goes in url; the text carries the questions and answers, without the link again)
        await navigator.share({ title: article.title, text: lines.length > 2 ? lines.slice(2).join("\n").trim() : undefined, url });
        setDone("Shared");
      } else {
        await navigator.clipboard.writeText(text);
        setDone("Copied, ready to paste");
      }
    } catch {
      /* the share sheet was closed */
    }
  };
  return (
    <div className="relative flex flex-wrap items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-panel px-3 text-sm text-ink hover:border-accent"
      >
        <ShareIcon width={15} height={15} /> Share
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        title="Opens the print window: choose “Save as PDF”"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-panel px-3 text-sm text-ink hover:border-accent"
      >
        <span aria-hidden>⤓</span> Download PDF
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-72 space-y-2 rounded-xl border border-line bg-raised p-3 text-sm text-ink shadow-lg">
          {questions.length > 0 && (
            <>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={withQs} onChange={(e) => setWithQs(e.target.checked)} className="mt-1 accent-[var(--accent)]" />
                <span>Include the reflection questions</span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 ${withQs ? "" : "opacity-50"}`}>
                <input type="checkbox" disabled={!withQs} checked={withAnswers} onChange={(e) => setWithAnswers(e.target.checked)} className="mt-1 accent-[var(--accent)]" />
                <span>
                  Include my answers <span className="block text-xs text-muted">Off unless you tick it: your answers stay private.</span>
                </span>
              </label>
            </>
          )}
          <button type="button" onClick={share} className="w-full rounded-lg bg-ink px-3 py-2 text-paper hover:opacity-90">
            Share link
          </button>
          {done && (
            <p role="status" className="text-xs text-muted">
              {done}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
