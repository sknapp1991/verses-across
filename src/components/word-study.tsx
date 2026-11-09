"use client";
/**
 * Words mode: tap a word to study it. In Bibles with Strong's numbers, the words that translate the same
 * Hebrew / Greek word light up in every version on screen (strongly in the same verse, softly elsewhere
 * in the chapter), and a card shows the original word and its meaning. Highlights use the CSS Custom
 * Highlight API, so the text itself is never re-rendered.
 */
import { selectXref } from "@/lib/ui-store";
import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { getVersion } from "@/lib/catalog";
import { updateSettings, useSettings } from "@/lib/settings";
import { APPROX, lexicon, loadTags, spans, TAGGED, type LexEntry } from "@/lib/strongs";
import { getLanguage } from "@/lib/languages";
import { translit } from "@/lib/translit";
import { hasWords, lookupWord, type WordCard } from "@/lib/words";
import { CloseIcon, WordsIcon } from "./icons";
import { modeButtonClass } from "./highlight-mode";
import { openSearch } from "./search-panel";

export type WordPick = { work: string; book: string; chapter: number; v: string; version: string; word: string; offset: number };
type State = { pick: WordPick; nums: string[] | null } | null;

let state: State = null;
const subs = new Set<() => void>();
const set = (s: State) => {
  state = s;
  subs.forEach((l) => l());
};
const useWordState = () =>
  useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => state,
    () => null,
  );
export const closeWordStudy = () => set(null);

/* ---------- finding the word under a tap ---------- */

/** Offset of (node, offset) inside `root`'s text. */
function textOffset(root: Element, node: Node, offset: number) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n = 0;
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    if (t === node) return n + offset;
    n += t.textContent?.length ?? 0;
  }
  return -1;
}

/** A DOM range for characters [start, end) of `root`'s text. */
function rangeOf(root: Element, start: number, end: number): Range | null {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let n = 0;
  let begun = false;
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const len = t.textContent?.length ?? 0;
    if (!begun && start < n + len) {
      r.setStart(t, start - n);
      begun = true;
    }
    if (begun && end <= n + len) {
      r.setEnd(t, end - n);
      return r;
    }
    n += len;
  }
  return null;
}

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const p = doc.caretPositionFromPoint?.(x, y);
  if (p) return { node: p.offsetNode, offset: p.offset };
  const r = doc.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

/** Tap in Words mode: work out the word and its Strong's numbers, then show the card. */
export async function pickWord(x: number, y: number, at: { work: string; book: string; chapter: number; v: string; version: string }) {
  const c = caretAt(x, y);
  if (!c || c.node.nodeType !== Node.TEXT_NODE) return;
  const root = (c.node.parentElement as Element | null)?.closest("[data-text]");
  if (!root) return;
  const offset = textOffset(root, c.node, c.offset);
  const text = root.textContent ?? "";
  let word = "";
  for (const m of text.matchAll(/[\p{L}\p{M}\p{N}'’]+/gu))
    if (m.index! <= offset && offset <= m.index! + m[0].length) {
      word = m[0].replace(/^['’]+|['’]+$/g, "");
      break;
    }
  if (!word) return;
  const pick = { ...at, word, offset };
  set({ pick, nums: null });
  const tags = at.work === "bible" ? await loadTags(at.version, at.book) : null;
  const list = tags?.[`${at.chapter}:${at.v}`];
  const hit = list ? spans(text, list).find((s) => s.start <= offset && offset <= s.end) : undefined;
  if (state?.pick === pick) set({ pick, nums: hit?.nums ?? [] });
}

/* ---------- highlights across versions ---------- */

function useMatchHighlights(scroller: RefObject<HTMLDivElement | null>, rowsKey: unknown) {
  const s = useWordState();
  useEffect(() => {
    const css = CSS as unknown as { highlights?: Map<string, unknown> };
    const H = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!css.highlights || !H) return;
    const clear = () => {
      css.highlights!.delete("word-match");
      css.highlights!.delete("word-match-soft");
    };
    clear();
    const sc = scroller.current;
    if (!s || !sc || !s.nums?.length) return clear;
    const want = new Set(s.nums);
    const { pick } = s;
    let live = true;
    (async () => {
      const strong: Range[] = [];
      const soft: Range[] = [];
      for (const el of sc.querySelectorAll<HTMLElement>("[data-text]")) {
        const version = el.closest<HTMLElement>("[data-ver]")?.dataset.ver;
        const v = el.closest<HTMLElement>("[data-v]")?.dataset.v;
        if (!version || !v || !TAGGED.has(version)) continue;
        const tags = await loadTags(version, pick.book);
        const list = tags?.[`${pick.chapter}:${v}`];
        if (!list) continue;
        for (const sp of spans(el.textContent ?? "", list))
          if (sp.nums.some((n) => want.has(n))) {
            const r = rangeOf(el, sp.start, sp.end);
            if (r) (v === pick.v ? strong : soft).push(r);
          }
      }
      if (!live) return;
      css.highlights!.set("word-match", new H(...strong));
      css.highlights!.set("word-match-soft", new H(...soft));
    })();
    return () => {
      live = false;
      clear();
    };
  }, [s, scroller, rowsKey]);
}

/* ---------- the card ---------- */

function useLex(nums: string[] | null) {
  const [got, setGot] = useState<{ key: string; list: [string, LexEntry | null][] } | null>(null);
  const key = nums?.join(",") ?? "";
  useEffect(() => {
    if (!key) return;
    let live = true;
    Promise.all(key.split(",").map(async (n) => [n, await lexicon(n)] as [string, LexEntry | null])).then((list) => live && setGot({ key, list }));
    return () => {
      live = false;
    };
  }, [key]);
  return got?.key === key ? got.list : null;
}

/** The dictionary card for the picked word (undefined while loading, null = none). */
function useDictionary(pick: WordPick | null) {
  const [got, setGot] = useState<{ pick: WordPick; card: WordCard | null } | null>(null);
  const lang = pick ? (getVersion(pick.version)?.language ?? "en") : "";
  useEffect(() => {
    if (!pick) return;
    let live = true;
    lookupWord(pick.word, lang).then((card) => live && setGot({ pick, card }));
    return () => {
      live = false;
    };
  }, [pick, lang]);
  return got && got.pick === pick ? got.card : undefined;
}

const LEVEL_NOTE: Record<string, string> = {
  A1: "beginner",
  A2: "elementary",
  B1: "intermediate",
  B2: "upper intermediate",
  C1: "advanced",
  C2: "proficient",
  archaic: "old-fashioned English",
};

/** "(lyubóv)" after a Russian, Greek, Hebrew, Arabic or Chinese word: how to say it (read out by rule, or the
 * romanization given with the translation when the word has no vowel marks, and pinyin for Chinese). */
function Say({ word, lang, given, className = "" }: { word: string; lang: string; given?: string; className?: string }) {
  const t = translit(word, lang) ?? (given || null);
  if (!t) return null;
  return (
    <span lang="en" dir="ltr" className={`ml-1 italic text-muted ${className}`} title="How to say it (approximate)">
      ({t})
    </span>
  );
}

function Dictionary({ card, lang }: { card: WordCard; lang: string }) {
  const e = card.entry;
  const tr = Object.entries(e.tr ?? {}).filter(([l]) => l !== lang);
  const [han, setHan] = useState<string | null>(null);
  return (
    <div className="mt-2 space-y-1.5 text-sm">
      {card.archaic && (
        <p className="rounded-md bg-accent-soft px-2 py-1 text-accent">
          Archaic for <strong>“{card.archaic}”</strong>
        </p>
      )}
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">
          {card.head}
          <Say word={card.head} lang={lang} />
        </span>
        {e.pos.length > 0 && <span className="italic text-muted">{e.pos.join(", ")}</span>}
        {e.level && (
          <span className="rounded-full border border-line px-2 text-xs text-muted" title={e.est ? "Estimated from how common the word is" : "From a learner word list (CEFR)"}>
            {e.level === "archaic" ? "archaic" : `${e.level} · ${LEVEL_NOTE[e.level] ?? ""}${e.est ? " (est.)" : ""}`}
          </span>
        )}
      </p>
      {e.old && <p className="text-xs text-muted">In older texts: {e.old}</p>}
      {e.defs.length > 0 && (
        <ol className="list-decimal space-y-0.5 pl-5">
          {e.defs.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ol>
      )}
      {e.syn && e.syn.length > 0 && <p className="text-xs text-muted">Similar: {e.syn.slice(0, 8).join(", ")}</p>}
      {e.of && e.of.length > 0 && <p className="text-xs text-muted">Also a form of: {e.of.join(", ")}</p>}
      {tr.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {tr.slice(0, 11).map(([l, words]) => {
            const nearOnly = e.tra?.includes(l);
            return (
              <span key={l} className="rounded-full bg-raised px-2 py-0.5 text-xs" lang={l} title={nearOnly ? "A near match: from a closely related word" : undefined}>
                <span className="text-faint">
                  {getLanguage(l).name}
                  {nearOnly ? " ≈" : ""}:
                </span>{" "}
                {words.slice(0, 2).map((w, i) => (
                  <span key={`${i}:${w}`}>
                    {i > 0 && ", "}
                    {l === "zh" ? (
                      <button type="button" onClick={() => setHan(han === w ? null : w)} className="underline decoration-dotted underline-offset-2" aria-expanded={han === w} title="What these characters mean">
                        {w}
                      </button>
                    ) : (
                      w
                    )}
                    <Say word={w} lang={l} given={e.trr?.[l]?.[i]} />
                  </span>
                ))}
              </span>
            );
          })}
        </div>
      )}
      {han && <HanChars word={han} onClose={() => setHan(null)} />}
    </div>
  );
}

/** The Chinese characters of a word, one by one: pinyin and what each means (Wiktionary). */
const hanParts = new Map<number, Promise<Record<string, { p: string[]; d: string[] }>>>();
function hanPart(c: string) {
  const i = c.codePointAt(0)! % 16;
  if (!hanParts.has(i))
    hanParts.set(
      i,
      fetch(`/words/zh-chars/${i.toString(16)}.json`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => {
          hanParts.delete(i);
          return {};
        }),
    );
  return hanParts.get(i)!;
}
function HanChars({ word, onClose }: { word: string; onClose: () => void }) {
  const chars = [...word].filter((c) => /\p{Script=Han}/u.test(c));
  const [info, setInfo] = useState<{ word: string; list: ({ p: string[]; d: string[] } | undefined)[] } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(chars.map((c) => hanPart(c).then((part) => part[c]))).then((list) => live && setInfo({ word, list }));
    return () => {
      live = false;
    };
    // chars come from word
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);
  return (
    <div className="mt-1 rounded-lg border border-line bg-raised p-2 text-xs" role="region" aria-label={`The characters of ${word}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium">
          The characters of <span lang="zh">{word}</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface">
          <CloseIcon width={14} height={14} />
        </button>
      </div>
      {info?.word !== word ? (
        <p className="text-muted">Looking up…</p>
      ) : (
        <ul className="space-y-1.5">
          {chars.map((c, i) => {
            const z = info.list[i];
            return (
              <li key={`${i}:${c}`} className="flex gap-2">
                <span lang="zh" className="w-8 shrink-0 text-center text-2xl leading-8">
                  {c}
                </span>
                <span className="min-w-0">
                  {z?.p.length ? <span className="font-medium">{z.p.join(", ")}</span> : null}
                  {z?.d.length ? <span className="block text-muted">{z.d.join(" · ")}</span> : <span className="block text-muted">No meaning on record for this character.</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1.5 text-[11px] text-faint">Pinyin and meanings: Wiktionary (CC BY-SA 4.0). A word&apos;s meaning can differ from its characters&apos; meanings put together.</p>
    </div>
  );
}

export function WordStudy({ scroller, rowsKey, versions, raised }: { scroller: RefObject<HTMLDivElement | null>; rowsKey: unknown; versions: string[]; raised: boolean }) {
  const { wordMode } = useSettings();
  const s = useWordState();
  useMatchHighlights(scroller, rowsKey);
  const lex = useLex(s?.nums ?? null);
  const dict = useDictionary(s?.pick ?? null);
  useEffect(() => {
    if (!wordMode) closeWordStudy();
  }, [wordMode]);
  if (!wordMode) return null;

  // The "tap any word" note is the strip under the top bar (ModeBanner).
  if (!s) return null;

  const { pick, nums } = s;
  const bible = pick.work === "bible";
  const untagged = bible ? versions.filter((id) => !TAGGED.has(id)).map((id) => getVersion(id)?.abbr ?? id) : [];
  const approx = APPROX.has(pick.version);
  return (
    <section
      aria-label={`Word: ${pick.word}`}
      data-no-swipe
      className={`fixed inset-x-0 z-30 max-h-[50dvh] overflow-y-auto border-t border-line bg-panel px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-2xl desk:inset-x-auto desk:right-4 desk:w-[380px] desk:rounded-xl desk:border ${
        raised ? "bottom-24" : "bottom-0 desk:bottom-4"
      }`}
    >
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 font-serif text-xl font-semibold">
          {pick.word}
          <Say word={pick.word} lang={getVersion(pick.version)?.language ?? ""} className="ml-2 font-sans text-base font-normal" />
        </h2>
        <button type="button" onClick={() => openSearch(pick.word, [pick.version])} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink">
          Search
        </button>
        <button type="button" onClick={closeWordStudy} aria-label="Close" className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-ink">
          <CloseIcon />
        </button>
      </div>

      {dict && <Dictionary key={dict.head} card={dict} lang={getVersion(pick.version)?.language ?? "en"} />}
      {dict === null && !bible && (
        <p className="mt-2 text-sm text-muted">
          {hasWords(getVersion(pick.version)?.language ?? "")
            ? "No dictionary entry for this word (often a name)."
            : `No dictionary for ${getLanguage(getVersion(pick.version)?.language ?? "en").name} yet.`}
        </p>
      )}
      {bible && nums !== null && (nums.length > 0 || dict) && <p className="mt-3 border-t border-line pt-2 text-xs font-semibold uppercase tracking-wide text-faint">Original word</p>}
      {(bible ? nums === null : dict === undefined) && <p className="mt-2 text-sm text-muted">Looking up…</p>}
      {bible && nums && nums.length === 0 && (
        <p className="mt-2 text-sm text-muted">
          {TAGGED.has(pick.version)
            ? "This word isn’t linked to a Hebrew or Greek word in this version (small words and added words often aren’t)."
            : "This version has no word links to the Hebrew and Greek. Tap the word in KJV, WEB, Reina-Valera, Luther or the Greek / Hebrew to see it across versions."}
        </p>
      )}
      {bible && nums && nums.length > 0 && (
        <div className="mt-2 space-y-3">
          {(lex ?? nums.map((n) => [n, null] as [string, LexEntry | null])).map(([n, e]) => (
            <div key={n} className="text-sm">
              <p className="flex flex-wrap items-baseline gap-x-2">
                {e?.lemma && <span className="font-serif text-lg">{e.lemma}</span>}
                {e?.translit && <span className="italic text-muted">{e.translit}</span>}
                <span className="text-xs text-faint">Strong’s {n}</span>
              </p>
              {e?.def && <p className="mt-0.5">{e.def}</p>}
              {e?.kjv && <p className="mt-0.5 text-xs text-muted">KJV renders it: {e.kjv}</p>}
              {e?.orig ? (
                <p className="mt-0.5 text-xs text-faint">
                  {e.orig.toLocaleString()} times in the {n.startsWith("H") ? "Hebrew Old Testament" : "Greek New Testament"}
                </p>
              ) : null}
            </div>
          ))}
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="word-match-swatch inline-block h-3 w-6 rounded-sm" /> same word in this verse
            <span className="word-match-soft-swatch inline-block h-3 w-6 rounded-sm" /> elsewhere in the chapter
          </p>
          {approx && <p className="text-xs text-faint">Word links in this version are machine-made and can be off by a word.</p>}
          {untagged.length > 0 && <p className="text-xs text-faint">No word links for: {untagged.join(", ")}.</p>}
        </div>
      )}
    </section>
  );
}

export function WordModeToggle({ full = false, tile = false }: { full?: boolean; tile?: boolean }) {
  const { wordMode } = useSettings();
  return (
    <button
      type="button"
      aria-pressed={wordMode}
      onClick={() => {
        updateSettings(wordMode ? { wordMode: false } : { wordMode: true, highlightMode: false, xrefMode: false });
        if (!wordMode) selectXref(false);
      }}
      title="Words mode: tap a word to see its meaning and the same word in every version"
      aria-label="Words mode"
      className={
        tile
          ? modeButtonClass(wordMode, "tile")
          : `flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm desk:border ${full ? "w-full border" : "w-11 px-0"} ${
              wordMode ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:bg-raised hover:text-ink desk:bg-raised"
            }`
      }
    >
      <WordsIcon />
      {full && <span>Words mode {wordMode ? "on" : "off"}</span>}
      {tile && <span>Words</span>}
    </button>
  );
}
