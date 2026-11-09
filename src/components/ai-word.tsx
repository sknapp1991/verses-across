"use client";
/**
 * A Hebrew or Greek word in an AI answer ("ḥērem", "agapē", "חֵרֶם"), tappable when Strong's dictionary knows it:
 * a small card opens under it with the original word, how to say it (▶), its meaning and how the KJV renders it.
 * The spelling index (public/lexicon/index.json, ~550 KB) loads only when an answer has such a word.
 */
import { useEffect, useState } from "react";
import { lexicon, type LexEntry } from "@/lib/strongs";
import { scriptOf, wordKey } from "@/lib/lexicon-key";
import { CloseIcon } from "./icons";
import { SayAloud } from "./say-aloud";

let indexP: Promise<Record<string, string[]>> | null = null;
const loadIndex = () =>
  (indexP ??= fetch("/lexicon/index.json")
    .then((r): Promise<Record<string, string[]>> | Record<string, string[]> => (r.ok ? r.json() : {}))
    .catch(() => {
      indexP = null;
      return {} as Record<string, string[]>;
    }));

/** Italic or Hebrew / Greek words worth checking: one to three words, letters only. */
export const looksForeign = (w: string) => !!scriptOf(w) || /^[\p{L}\p{M}ʼʽʾʿ'’-]{2,24}$/u.test(w.trim());

export function AiWord({ word, italic = false }: { word: string; italic?: boolean }) {
  const [nums, setNums] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    loadIndex().then((i) => live && setNums(i[wordKey(word)] ?? []));
    return () => {
      live = false;
    };
  }, [word]);
  const plain = italic ? <em>{word}</em> : <>{word}</>;
  if (!nums?.length) return plain;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="What this word means"
        className={`underline decoration-accent decoration-dotted underline-offset-4 ${italic ? "italic" : ""}`}
      >
        {word}
      </button>
      {open && <WordCard nums={nums} onClose={() => setOpen(false)} />}
    </>
  );
}

function WordCard({ nums, onClose }: { nums: string[]; onClose: () => void }) {
  const [list, setList] = useState<{ num: string; e: LexEntry }[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(nums.map((n) => lexicon(n).then((e) => (e ? { num: n, e } : null)))).then((l) => live && setList(l.filter((x): x is { num: string; e: LexEntry } => !!x)));
    return () => {
      live = false;
    };
  }, [nums]);
  return (
    <span role="region" aria-label="Word card" className="my-1.5 block rounded-lg border border-line bg-raised p-2.5 text-sm font-normal not-italic">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">{nums[0].startsWith("H") ? "Hebrew" : "Greek"} · Strong&apos;s dictionary</span>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface">
          <CloseIcon width={14} height={14} />
        </button>
      </span>
      {!list ? (
        <span className="block text-muted">Looking it up…</span>
      ) : (
        list.slice(0, 2).map(({ num, e }, i) => {
          const lang = num.startsWith("H") ? "he" : "el";
          return (
            <span key={num} className={`block space-y-1 ${i ? "mt-2 border-t border-line pt-2" : ""}`}>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span lang={lang} dir={lang === "he" ? "rtl" : undefined} className="text-xl text-ink">
                  {e.lemma}
                </span>
                <span className="italic">{e.translit}</span>
                {e.pron && <span className="text-xs text-muted">({e.pron})</span>}
                <span className="text-xs text-faint">{num}</span>
              </span>
              {e.def && <span className="block">{e.def}</span>}
              {e.kjv && <span className="block text-xs text-muted">In the KJV: {e.kjv}</span>}
              {e.lemma && (
                <span className="block pt-0.5">
                  <SayAloud word={e.lemma} lang={lang} romanized={e.translit ?? null} />
                </span>
              )}
            </span>
          );
        })
      )}
    </span>
  );
}
