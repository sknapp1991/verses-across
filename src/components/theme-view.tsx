"use client";
/**
 * One theme's passages (public/themes/<id>.json): each tradition's closest passages side by side, then the Library's
 * books that echo it. Scriptures first, or the Library first when you're on the Library side.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_VERSIONS, readHref } from "@/lib/catalog";
import { useSide } from "@/lib/side";
import { loadTheme, parseRef, type Theme, type ThemePassage } from "@/lib/themes";

function Passage({ p }: { p: ThemePassage }) {
  const r = parseRef(p.ref);
  if (!r) return null;
  return (
    <li className="space-y-1">
      <p className="font-serif text-[1.05rem] leading-relaxed text-ink">{p.text}</p>
      <Link
        href={readHref({ work: r.work, book: r.book, chapter: r.chapter }, DEFAULT_VERSIONS[r.work] ?? [], r.verse)}
        className="text-sm font-medium text-accent underline decoration-accent/40 underline-offset-2"
      >
        {r.label}
      </Link>
    </li>
  );
}

export function ThemeView({ id }: { id: string }) {
  const [got, setGot] = useState<{ id: string; theme?: Theme; error?: string } | null>(null);
  const side = useSide();
  useEffect(() => {
    let live = true;
    loadTheme(id)
      .then((theme) => live && setGot({ id, theme }))
      .catch((e: Error) => live && setGot({ id, error: e.message }));
    return () => {
      live = false;
    };
  }, [id]);
  const cur = got?.id === id ? got : null;
  if (!cur) return <p className="py-8 text-center text-sm text-faint">Loading the passages…</p>;
  if (cur.error || !cur.theme) return <p className="py-8 text-center text-sm text-red-700 dark:text-red-400">{cur.error}</p>;
  const t = cur.theme;

  const scriptures = (
    <section key="s" className="space-y-4" aria-labelledby="th-s">
      <h2 id="th-s" className="font-serif text-xl font-semibold text-ink">
        In the scriptures <span className="font-sans text-sm font-normal text-faint">· {t.traditions.length} traditions</span>
      </h2>
      {t.traditions.map((tr) => (
        <details key={tr.id} open className="group rounded-2xl border border-line bg-raised/40 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-wide text-faint">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>
            {tr.name}
          </summary>
          <ul className="mt-3 space-y-4">
            {tr.passages.slice(0, 4).map((p) => (
              <Passage key={p.ref} p={p} />
            ))}
          </ul>
          {tr.passages.length > 4 && <More list={tr.passages.slice(4)} />}
        </details>
      ))}
    </section>
  );
  const library = t.books.length ? (
    <section key="l" className="space-y-4" aria-labelledby="th-l">
      <h2 id="th-l" className="font-serif text-xl font-semibold text-ink">
        In the Library <span className="font-sans text-sm font-normal text-faint">· {t.books.length} books</span>
      </h2>
      {t.books.map((b) => (
        <div key={b.work} className="rounded-2xl border border-line bg-raised/40 p-4">
          <p className="text-sm font-semibold text-ink">{b.title}</p>
          <ul className="mt-3 space-y-4">
            {b.passages.map((p) => (
              <Passage key={p.ref} p={p} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  ) : null;
  return <div className="space-y-8">{side === "library" ? [library, scriptures] : [scriptures, library]}</div>;
}

function More({ list }: { list: ThemePassage[] }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-9 text-sm text-accent hover:underline">
        {list.length} more
      </button>
    );
  return (
    <ul className="mt-4 space-y-4">
      {list.map((p) => (
        <Passage key={p.ref} p={p} />
      ))}
    </ul>
  );
}
