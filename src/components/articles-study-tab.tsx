"use client";
/**
 * My Study → Articles (hub b53fdab9): the bridge between the articles and the reader. What was ticked in an
 * article's Study guide (verses, words, names, books, themes, articles), the articles read, and a suggestion
 * bubble from both. All on this device.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { suggestArticles, toggleSaved, useReadArticles, useSavedRefs, type SavedKind, type SavedRef } from "@/lib/article-study";
import { DEPTH_LABEL, type ArticleSummary, type Depth } from "@/lib/articles";
import { CloseIcon } from "./icons";

const GROUPS: { kind: SavedKind; label: string }[] = [
  { kind: "verse", label: "Verses" },
  { kind: "text", label: "Chapters to read" },
  { kind: "word", label: "Words" },
  { kind: "name", label: "Names" },
  { kind: "book", label: "Books" },
  { kind: "theme", label: "Themes" },
  { kind: "article", label: "Articles to read" },
];

let indexP: Promise<ArticleSummary[]> | null = null;
const loadIndex = () =>
  (indexP ??= fetch("/articles/index.json")
    .then((r) => (r.ok ? (r.json() as Promise<ArticleSummary[]>) : []))
    .catch(() => {
      indexP = null;
      return [];
    }));

function Item({ s, onNavigate }: { s: SavedRef; onNavigate?: () => void }) {
  const external = s.href?.startsWith("http");
  const label = <span className={s.kind === "word" || s.kind === "book" ? "italic" : s.kind === "theme" ? "capitalize" : ""}>{s.label}</span>;
  return (
    <li className="flex items-start gap-2 px-2 py-2 text-sm">
      <div className="min-w-0 flex-1">
        {s.href ? (
          external ? (
            <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-accent">
              {label} ↗
            </a>
          ) : (
            <Link href={s.href} onClick={onNavigate} className="text-ink hover:text-accent">
              {label}
            </Link>
          )
        ) : (
          label
        )}
        <span className="block text-xs text-faint">
          from{" "}
          <Link href={`/articles/${s.slug}`} onClick={onNavigate} className="underline underline-offset-2 hover:text-ink">
            {s.articleTitle}
          </Link>
        </span>
      </div>
      <button
        type="button"
        onClick={() => toggleSaved(s, false)}
        aria-label={`Remove ${s.label}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-raised"
      >
        <CloseIcon width={14} height={14} />
      </button>
    </li>
  );
}

export function ArticlesStudyTab({ onNavigate }: { onNavigate?: () => void }) {
  const saved = useSavedRefs();
  const read = useReadArticles();
  const [index, setIndex] = useState<ArticleSummary[]>([]);
  useEffect(() => {
    let live = true;
    loadIndex().then((l) => live && setIndex(l));
    return () => {
      live = false;
    };
  }, []);
  const published = useMemo(() => index.filter((a) => a.status === "published"), [index]);
  const suggestions = useMemo(() => suggestArticles(published, read, saved, 3), [published, read, saved]);
  const items = Object.values(saved).sort((a, b) => b.at - a.at);
  const readList = index.filter((a) => read[a.slug]);
  const empty = !items.length && !readList.length;
  return (
    <div className="space-y-4 py-2">
      {suggestions.length > 0 && (
        <div className="mx-2 rounded-2xl border border-accent/40 bg-accent-soft p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-accent">{readList.length || items.length ? "Suggested for you" : "Start with"}</p>
          <ul className="space-y-1.5">
            {suggestions.map((a) => (
              <li key={a.slug}>
                <Link href={`/articles/${a.slug}`} onClick={onNavigate} className="block text-sm text-ink hover:underline">
                  {a.title}
                </Link>
                <span className="block text-xs capitalize text-muted">{a.themes.slice(0, 3).join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {empty && (
        <p className="px-4 py-6 text-center text-sm text-faint">
          In an article, tick a verse, word, name or book in its Study guide to keep it here, and mark the article read at its end.{" "}
          <Link href="/articles" onClick={onNavigate} className="underline underline-offset-2">
            Browse the articles
          </Link>
        </p>
      )}
      {GROUPS.map(({ kind, label }) => {
        const g = items.filter((s) => s.kind === kind);
        if (!g.length) return null;
        return (
          <section key={kind}>
            <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-faint">
              {label} <span className="font-normal">{g.length}</span>
            </p>
            <ul className="divide-y divide-line/70">
              {g.map((s) => (
                <Item key={s.id} s={s} onNavigate={onNavigate} />
              ))}
            </ul>
          </section>
        );
      })}
      {readList.length > 0 && (
        <section>
          <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-faint">
            Articles read <span className="font-normal">{readList.length}</span>
          </p>
          <ul className="divide-y divide-line/70">
            {readList.map((a) => (
              <li key={a.slug} className="px-4 py-2 text-sm">
                <Link href={`/articles/${a.slug}`} onClick={onNavigate} className="text-ink hover:text-accent">
                  {a.title}
                </Link>
                <span className="block text-xs text-faint">
                  {Object.entries(read[a.slug] ?? {})
                    .map(([d, day]) => `${DEPTH_LABEL[d as Depth] ?? d} · ${day}`)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!empty && <p className="px-4 text-xs text-faint">Kept on this device (not in sync or backups yet).</p>}
    </div>
  );
}
