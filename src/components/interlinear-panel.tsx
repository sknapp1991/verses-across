"use client";
/**
 * Interlinear (ROADMAP ST1): a verse word by word in the original language — Hebrew for the Old Testament,
 * Greek for the New — each word with its transliteration, an English gloss, its Strong's number and its grammar
 * in plain words; tap a word for its lexicon entry. Opened from a verse's menu ("Interlinear"); a panel in the
 * side dock (a sheet on a phone). Data: STEP Bible (Tyndale House, Cambridge; CC BY 4.0), built by
 * scripts/build-interlinear.mts and served from R2 by /api/interlinear (one chapter at a time).
 */
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { chapterTitle, findBook, readHref } from "@/lib/catalog";
import { closePanel, openPanel } from "@/lib/ui-store";
import { PanelHeader } from "./panel-header";
import { NextIcon, PrevIcon } from "./icons";

export type InterRef = { work: string; book: string; chapter: number; verse: string };
type Word = [string, string, string, string, number];
type Lex = [string, string, string, string];

let current: InterRef | null = null;
const subs = new Set<() => void>();
const useRef_ = () =>
  useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => current,
    () => null,
  );
/** Show this verse in the Interlinear panel (and open it). */
export function showInterlinear(r: InterRef) {
  current = r;
  subs.forEach((l) => l());
  openPanel("interlinear");
}
/** The Bible books it covers: the 39 + 27 (not the Apocrypha, which has no Hebrew/Greek tagging here). */
export const hasInterlinear = (work: string, book: string) => work === "bible" && findBook(work, book)?.collection.id !== undefined && ["ot", "nt"].includes(findBook(work, book)!.collection.id);

const cache = new Map<string, Promise<unknown>>();
function get<T>(path: string): Promise<T | null> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(`/api/interlinear/${path}`).then(
      (r) => (r.ok ? r.json() : null),
      () => null,
    );
    cache.set(path, p);
    // A failed load (offline, a network blip) isn't kept: the next look tries again.
    void p.then((d) => {
      if (d === null) cache.delete(path);
    });
  }
  return p as Promise<T | null>;
}
const lexShard = (strong: string) => `lex/${strong[0]}${Math.floor(parseInt(strong.slice(1, 5), 10) / 1000)}.json`;

export function InterlinearPanel() {
  const r = useRef_();
  const [data, setData] = useState<{ key: string; verses: Record<string, Word[]> | null; grammar: string[] } | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [lex, setLex] = useState<{ strong: string; e: Lex | null } | null>(null);
  const key = r ? `${r.book}/${r.chapter}` : "";

  useEffect(() => {
    if (!r) return;
    let live = true;
    void Promise.all([get<Record<string, Word[]>>(`${r.book}/${r.chapter}.json`), get<string[]>("grammar.json")]).then(([verses, grammar]) => {
      if (live) setData({ key, verses, grammar: grammar ?? [] });
    });
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const words = data?.key === key ? data.verses?.[r?.verse ?? ""] : undefined;
  const w = pick !== null && words ? words[pick] : null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new verse: no word picked yet
    setPick(null);
  }, [key, r?.verse]);
  useEffect(() => {
    if (!w || !/^[HG]\d{4}/.test(w[3])) return;
    let live = true;
    const strong = w[3];
    void get<Record<string, Lex>>(lexShard(strong)).then((shard) => {
      if (live) setLex({ strong, e: shard?.[strong] ?? shard?.[strong.slice(0, 5)] ?? null });
    });
    return () => {
      live = false;
    };
  }, [w]);

  const entry = r ? findBook(r.work, r.book) : undefined;
  const hebrew = entry?.collection.id === "ot";
  const verseKeys = data?.key === key && data.verses ? Object.keys(data.verses).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)) : [];
  const at = r ? verseKeys.indexOf(r.verse) : -1;
  const go = (d: number) => {
    const v = verseKeys[at + d];
    if (r && v) showInterlinear({ ...r, verse: v });
  };
  const label = r ? `${chapterTitle(entry, r.chapter)}${r.verse === "0" ? " (title)" : `:${r.verse}`}` : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        icon={<span className="font-serif text-base leading-none" aria-hidden>א</span>}
        title="Interlinear"
        extra={label || undefined}
        onClose={() => closePanel("interlinear")}
        closeLabel="Close Interlinear"
      />
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 text-sm">
        {!r ? (
          <p className="text-muted">Tap a verse of the Bible, then &ldquo;Interlinear&rdquo;, to see it word by word in Hebrew or Greek.</p>
        ) : !hasInterlinear(r.work, r.book) ? (
          <p className="text-muted">The interlinear covers the Old Testament (Hebrew) and the New Testament (Greek).</p>
        ) : data?.key !== key ? (
          <p role="status" className="animate-pulse text-muted">
            Loading…
          </p>
        ) : !data.verses ? (
          <p className="text-muted">Couldn&rsquo;t load the words for this chapter. Check the connection, then tap the verse&rsquo;s Interlinear again.</p>
        ) : !words ? (
          <p className="text-muted">No original-language words for this verse (some verses are numbered differently in Hebrew).</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <button type="button" disabled={at <= 0} onClick={() => go(-1)} className="flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-raised disabled:opacity-40" aria-label="Previous verse">
                <PrevIcon width={14} height={14} /> Verse
              </button>
              <span>
                {hebrew ? "Hebrew, read right to left" : "Greek"} · {words.length} words · tap one
              </span>
              <button type="button" disabled={at < 0 || at >= verseKeys.length - 1} onClick={() => go(1)} className="flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-raised disabled:opacity-40" aria-label="Next verse">
                Verse <NextIcon width={14} height={14} />
              </button>
            </div>
            <ol dir={hebrew ? "rtl" : "ltr"} className="flex flex-wrap gap-1.5">
              {words.map((x, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setPick(pick === i ? null : i)}
                    aria-pressed={pick === i}
                    className={`flex min-w-16 flex-col items-center rounded-lg border px-2 py-1.5 text-center ${pick === i ? "border-accent bg-accent-soft" : "border-line bg-raised/40 hover:border-faint"}`}
                  >
                    <span lang={hebrew ? "he" : "grc"} dir={hebrew ? "rtl" : "ltr"} className="text-lg leading-snug text-ink" style={{ fontFamily: hebrew ? "var(--font-hebrew)" : "var(--font-greek)" }}>
                      {x[0]}
                    </span>
                    <span dir="ltr" className="text-[11px] italic text-faint">
                      {x[1]}
                    </span>
                    <span dir="ltr" className="text-xs text-muted">
                      {x[2]}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {w && (
              <div className="space-y-1.5 rounded-xl border border-line bg-panel px-3 py-2.5" aria-live="polite">
                <p>
                  <span lang={hebrew ? "he" : "grc"} className="text-xl text-ink" style={{ fontFamily: hebrew ? "var(--font-hebrew)" : "var(--font-greek)" }}>
                    {w[0]}
                  </span>{" "}
                  <span className="italic text-faint">{w[1]}</span> <span className="text-muted">&ldquo;{w[2]}&rdquo;</span>
                </p>
                {data.grammar[w[4]] && (
                  <p className="text-xs text-muted">
                    <span className="font-semibold text-faint">Grammar:</span> {data.grammar[w[4]]}
                  </p>
                )}
                {lex?.strong === w[3] && lex.e && (
                  <div className="space-y-1 border-t border-line pt-1.5">
                    <p>
                      <span className="text-xs font-semibold text-faint">Dictionary form:</span>{" "}
                      <span lang={hebrew ? "he" : "grc"} className="text-base text-ink" style={{ fontFamily: hebrew ? "var(--font-hebrew)" : "var(--font-greek)" }}>
                        {lex.e[0]}
                      </span>{" "}
                      <span className="italic text-faint">{lex.e[1]}</span> · {lex.e[2]}
                    </p>
                    {lex.e[3] && <p className="text-xs leading-relaxed text-muted">{lex.e[3]}</p>}
                  </div>
                )}
                <p className="text-[11px] text-faint">Strong&rsquo;s {w[3].replace(/^([HG])0*/, "$1")}</p>
              </div>
            )}
            {r && (
              <Link href={readHref({ work: r.work, book: r.book, chapter: r.chapter }, undefined, r.verse)} className="inline-block text-xs text-accent underline-offset-2 hover:underline">
                Go to this verse in the reader
              </Link>
            )}
          </>
        )}
      </div>
      <p className="shrink-0 border-t border-line px-3 py-2 text-[11px] leading-snug text-faint">
        Hebrew (Leningrad Codex) and Greek (the words of the Textus Receptus behind the KJV) adapted from{" "}
        <a href="https://www.stepbible.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          STEPBible.org
        </a>{" "}
        data by Tyndale House, Cambridge (TAHOT, TAGNT, TBESH, TBESG, TEHMC, TEGMC), under{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          CC BY 4.0
        </a>
        ; definitions shortened.
      </p>
    </div>
  );
}
