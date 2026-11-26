"use client";
/**
 * A place page (Time and place, study lab, hub 7a62bb28): every KJV verse that names a place across the whole Bible,
 * in canonical order and paged (each page loads only the KJV books it needs), the names it goes by, how far it is
 * from Jerusalem, the books that name it most, and an openly licensed photo when OpenBible.info's metadata has one.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { findBook, readHref } from "@/lib/catalog";
import { fetchBook, type BookFile } from "@/lib/chapter-store";
import { SURE_LABEL, SURE_NOTE, kmBetween, type IndexPlace, type PlaceFile } from "@/lib/time-and-place";
import { loadJson } from "./time-and-place-map";

const PAGE = 25;

/** A CC licence code ("CC-BY-SA-4.0") as a readable name and its deed. */
function licence(code: string): { name: string; url?: string } {
  if (/^PD/i.test(code)) return { name: "Public domain" };
  if (/^FAL/i.test(code)) return { name: "Free Art License", url: "https://artlibre.org/licence/lal/en/" };
  if (/^CC0/i.test(code)) return { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" };
  const m = /^CC-(BY(?:-SA)?)-(\d\.\d)(?:-(\w+))?/i.exec(code);
  if (!m) return { name: code };
  const kind = m[1].toLowerCase();
  const port = m[3] ? `/${m[3].toLowerCase()}` : "";
  return {
    name: `CC ${m[1].toUpperCase()} ${m[2]}${m[3] ? ` ${m[3]}` : ""}`,
    url: `https://creativecommons.org/licenses/${kind}/${m[2]}${port}/`,
  };
}

export function PlacePage({
  place,
  jerusalem,
  order,
  back,
  showChapter,
}: {
  place: IndexPlace;
  /** Jerusalem in the index, for the distance. */
  jerusalem: IndexPlace | null;
  order: Map<string, number>;
  back: () => void;
  showChapter: (book: string, chapter: number) => void;
}) {
  const aid = place.id.split("/")[0];
  const [file, setFile] = useState<{ id: string; f: PlaceFile | null; failed?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const [photo, setPhoto] = useState<"off" | "on" | "failed">("off"); // (loads from Wikimedia only when asked)
  const top = useRef<HTMLElement>(null);
  const turn = (n: number) => {
    setPage(n);
    top.current?.scrollIntoView({ block: "start" });
  };
  const [texts, setTexts] = useState<Record<string, BookFile>>({});

  useEffect(() => {
    let live = true;
    loadJson<PlaceFile>(`/places/p/${aid}.json`).then(
      (f) => live && setFile(f ? { id: aid, f } : { id: aid, f: null, failed: true }),
      () => live && setFile({ id: aid, f: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [aid, attempt]);

  const f = file?.id === aid ? file.f : null;
  // Every verse, books in canonical order
  const all = useMemo(() => {
    const out: { book: string; chapter: number; verse: number }[] = [];
    if (!f) return out;
    const books = [...f.v].sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99));
    for (const [book, chs] of books) for (const [chapter, vs] of chs) for (const verse of vs) out.push({ book, chapter, verse });
    return out;
  }, [f, order]);
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const slice = all.slice(page * PAGE, page * PAGE + PAGE);
  const sliceBooks = useMemo(() => Array.from(new Set(slice.map((s) => s.book))), [slice]);

  // Load the KJV books this page needs
  useEffect(() => {
    let live = true;
    for (const b of sliceBooks)
      if (!texts[b])
        fetchBook("bible", "kjv", b)
          .then((bf) => live && setTexts((t) => ({ ...t, [b]: bf })))
          .catch(() => {});
    return () => {
      live = false;
    };
  }, [sliceBooks, texts]);

  const topBooks = useMemo(() => {
    if (!f) return [];
    return f.v
      .map(([b, chs]) => ({ b, n: chs.reduce((s, [, vs]) => s + vs.length, 0) }))
      .sort((a, b) => b.n - a.n || (order.get(a.b) ?? 99) - (order.get(b.b) ?? 99))
      .slice(0, 5);
  }, [f, order]);

  const isJerusalem = jerusalem?.id === place.id;
  const isRegion = place.t === "region";
  const km =
    place.x !== undefined && jerusalem?.x !== undefined && !isJerusalem && !isRegion
      ? kmBetween(place.x, place.y!, jerusalem.x, jerusalem.y!)
      : null;
  const names = Array.from(new Set([place.n, ...(place.k ?? [])]));
  const bookName = (b: string) => findBook("bible", b)?.name ?? b;
  const text = (b: string, c: number, v: number) => texts[b]?.chapters[String(c)]?.verses.find((x) => x.v === String(v))?.t;
  const lic = f?.img ? licence(f.img.lic) : null;

  return (
    <article ref={top} className="scroll-mt-4 space-y-5">
      <button onClick={back} className="text-sm text-accent hover:underline">
        ← Back to the map
      </button>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Place</p>
        <h2 className="font-serif text-3xl font-semibold text-ink">{place.n}</h2>
        {names.length > 1 && <p className="text-sm text-muted">Also called: {names.slice(1).join(", ")}</p>}
      </header>

      {f?.img && photo === "off" && (
        <button
          onClick={() => setPhoto("on")}
          className="min-h-11 w-full rounded-2xl border border-dashed border-line bg-panel px-3 text-sm text-ink hover:bg-raised"
        >
          Show photo (loads from Wikimedia Commons)
        </button>
      )}
      {f?.img && photo === "failed" && <p className="text-xs text-faint">The photo couldn&apos;t be loaded from Wikimedia Commons.</p>}
      {f?.img && photo === "on" && (
        <figure className="overflow-hidden rounded-2xl border border-line bg-panel">
          {/* eslint-disable-next-line @next/next/no-img-element -- an openly licensed photo served by Wikimedia Commons */}
          <img
            src={f.img.src}
            alt={f.img.alt || place.n}
            className="block max-h-80 w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setPhoto("failed")}
          />
          <figcaption className="p-3 text-xs text-muted">
            {f.img.alt && <span className="block text-ink">{f.img.alt}</span>}
            Photo:{" "}
            <a href={f.img.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {f.img.by}
            </a>
            ,{" "}
            {lic?.url ? (
              <a href={lic.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {lic.name}
              </a>
            ) : (
              lic?.name
            )}
            , via Wikimedia Commons (chosen by OpenBible.info).
          </figcaption>
        </figure>
      )}

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-panel p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Where</dt>
          <dd className="text-sm text-ink">
            {place.u ? (
              <>Not on the map: {place.u}.</>
            ) : (
              <>
                {place.m && place.m !== place.n ? <>Identified with {place.m}. </> : null}
                <span className="font-semibold">{SURE_LABEL[place.c]}:</span> {SURE_NOTE[place.c]}
                {place.o ? ` ${place.o === 1 ? "One other location has" : `${place.o} other locations have`} also been proposed.` : ""}
              </>
            )}
          </dd>
        </div>
        <div className="rounded-xl bg-panel p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">From Jerusalem</dt>
          <dd className="text-sm text-ink">
            {isJerusalem
              ? "This is Jerusalem."
              : isRegion
                ? `${place.n} is a region, so there is no single distance.`
                : km === null
                  ? "Unknown."
                  : `About ${Math.round(km).toLocaleString("en")} km (${Math.round(km * 0.621371).toLocaleString("en")} miles) as the crow flies${place.c === 0 ? ", if this identification is right" : ""}.`}
          </dd>
        </div>
        <div className="rounded-xl bg-panel p-3 sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Named most in</dt>
          <dd className="text-sm text-ink">
            {topBooks.length ? topBooks.map((t) => `${bookName(t.b)} (${t.n})`).join(", ") : "…"} · {place.w} KJV{" "}
            {place.w === 1 ? "verse" : "verses"} in all
          </dd>
        </div>
      </dl>

      <section className="space-y-3">
        <h3 className="font-serif text-xl font-semibold text-ink">Every mention</h3>
        {file?.failed ? (
          <p className="text-sm text-muted">
            The verses couldn&apos;t be loaded.{" "}
            <button className="text-accent hover:underline" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </p>
        ) : !f ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <>
            <ul className="space-y-3">
              {slice.map((s) => (
                <li key={`${s.book}.${s.chapter}.${s.verse}`} className="text-ink">
                  <Link
                    href={readHref({ work: "bible", book: s.book, chapter: s.chapter }, ["kjv"], String(s.verse))}
                    className="mr-1 text-sm font-semibold text-accent hover:underline"
                  >
                    {bookName(s.book)} {s.chapter}:{s.verse}
                  </Link>
                  <span className="font-serif">{text(s.book, s.chapter, s.verse) ?? "…"}</span>{" "}
                  <button onClick={() => showChapter(s.book, s.chapter)} className="text-xs text-accent hover:underline">
                    map
                  </button>
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Pages">
                <button
                  disabled={page === 0}
                  onClick={() => turn(page - 1)}
                  className="min-h-10 rounded-lg border border-line bg-panel px-3 text-ink disabled:opacity-40"
                >
                  ← Earlier
                </button>
                <span className="text-muted">
                  {page * PAGE + 1} to {Math.min(all.length, page * PAGE + PAGE)} of {all.length}
                </span>
                <button
                  disabled={page >= pages - 1}
                  onClick={() => turn(page + 1)}
                  className="min-h-10 rounded-lg border border-line bg-panel px-3 text-ink disabled:opacity-40"
                >
                  Later →
                </button>
              </nav>
            )}
            <p className="text-xs text-faint">KJV. Verses as OpenBible.info lists them.</p>
          </>
        )}
      </section>

      <p className="text-xs text-faint">
        <a
          href={`https://www.openbible.info/geo/ancient/${place.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Every proposed location and its sources on OpenBible.info ↗
        </a>
      </p>
    </article>
  );
}
