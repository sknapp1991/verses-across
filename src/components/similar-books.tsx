"use client";
/**
 * "If you liked this…": at the end of a Library book, the books most like it (data/similar-books.json, from the
 * cross references' book-to-book matches, built by scripts/build-similar-books.mts). Loaded only when shown.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_VERSIONS, catalog, readHref } from "@/lib/catalog";

type Similar = Record<string, [string, number][]>;
let dataP: Promise<Similar> | null = null;
const load = () => (dataP ??= import("../../data/similar-books.json").then((m) => m.default as unknown as Similar));

/** A book's first item on the shelves (its id, name and shelf), by work. */
function bookOf(work: string) {
  for (const r of catalog.religions)
    for (const c of r.collections)
      for (const it of c.items) if (it.work === work && it.chapters) return { id: it.id, name: it.name, shelf: c.name };
  return null;
}

export function SimilarBooks({ work }: { work: string }) {
  const [list, setList] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    load()
      .then((d) => live && setList((d[work] ?? []).map(([w]) => w)))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [work]);
  const books = (list ?? []).map((w) => ({ work: w, b: bookOf(w) })).filter((x) => x.b);
  if (!books.length) return null;
  return (
    <section aria-label="If you liked this" className="mx-auto max-w-3xl px-4 pt-6 md:px-8">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">If you liked this…</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {books.map(({ work: w, b }) => (
          <li key={w}>
            <Link
              href={readHref({ work: w, book: b!.id, chapter: 1 }, DEFAULT_VERSIONS[w] ?? [])}
              className="flex min-h-14 flex-col justify-center rounded-xl border border-line px-4 py-2 hover:border-accent"
            >
              <span className="font-medium leading-snug">{b!.name}</span>
              <span className="text-xs text-muted">{b!.shelf}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
