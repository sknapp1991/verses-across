"use client";
/**
 * A Hebrew or Greek word in an AI answer ("ḥērem", "agapē", "חֵרֶם"), tappable when Strong's dictionary knows it:
 * a small card opens under it with the original word, how to say it (▶), its meaning and how the KJV renders it.
 * The spelling index (public/lexicon/index.json, ~550 KB) loads only when an answer has such a word.
 */
import { useEffect, useState } from "react";
import { lexicon, type LexEntry } from "@/lib/strongs";
import { lookupArabicRoman, lookupWord, type WordCard as DictCard } from "@/lib/words";
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
export const looksForeign = (w: string) => !!scriptOf(w) || /^[\p{L}\p{M}ʼʽʾʿ'’‘-]{2,24}$/u.test(w.trim());

/**
 * Popular spellings whose wordKey() still misses the dictionary index (it has "proskineo", "shaha"): straight to the
 * Strong's number (hub e9965564). Keys are wordKey() output ("hishtachaveh" → "hishtahabe"); most spellings
 * (chesed, torah, ruach, avodah) already reach their entry through wordKey().
 */
const SPELLINGS: Record<string, string[]> = {
  proskuneo: ["G4352"], // proskuneo
  proskyneo: ["G4352"], // proskyneo
  hishtahabe: ["H7812"], // hishtachaveh
  hishtahaba: ["H7812"], // hishtachavah
  hishtahawe: ["H7812"], // hishtahawe
};

/** An everyday English word (a learner level up to C1): *very*, *holy*, *time*. Rare words (cherem, parthenos) aren't. */
async function everyday(w: string) {
  const card = await lookupWord(w.toLowerCase().replace(/[‘’']/g, ""), "en").catch(() => null);
  return !!card && /^(A1|A2|B1|B2|C1)$/.test(card.entry.level ?? "");
}

/**
 * `arabic`: the text around the word is about Islam or Arabic (an article paragraph naming the Qur'an, Islam or
 * Arabic): look the word up in the Arabic dictionary first, and allow a plain Latin spelling (*din*, *salah*) there.
 */
export function AiWord({ word, italic = false, notEnglish = false, arabic: preferArabic = false }: { word: string; italic?: boolean; notEnglish?: boolean; arabic?: boolean }) {
  const [nums, setNums] = useState<string[] | null>(null);
  const [arabic, setArabic] = useState<DictCard | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    // Arabic, by script or by its Latin spelling (*ibadah*, hub e9965564). A plain ASCII spelling only where the text
    // is about Islam / Arabic (preferArabic) or written as a transliteration (ʿibāda, tawḥīd): never for Ask AI's
    // ordinary English italics (*harm*, *kin*), and never ahead of Strong's elsewhere (*din*, *nabi* are Hebrew too).
    const arabicCard = async () => {
      if (/[؀-ۿ]/.test(word)) return lookupWord(word, "ar");
      if (!/^[\p{Script=Latin}\p{M}ʿʾʼ'’‘-]+$/u.test(word)) return null;
      return /[^\x00-\x7F]/.test(word) || preferArabic ? lookupArabicRoman(word) : null;
    };
    (async () => {
      if (preferArabic) {
        const card = await arabicCard();
        if (card) {
          if (live) setArabic(card);
          return;
        }
      }
      const i = await loadIndex();
      const key = wordKey(word);
      let found = i[key] ?? SPELLINGS[key] ?? [];
      // a plain spelling: only if it isn't an everyday English word
      if (found.length && notEnglish && (await everyday(word))) found = [];
      if (!live) return;
      setNums(found);
      if (found.length || preferArabic) return;
      const card = await arabicCard();
      if (live && card) setArabic(card);
    })();
    return () => {
      live = false;
    };
  }, [word, notEnglish, preferArabic]);
  const plain = italic ? <em>{word}</em> : <>{word}</>;
  if (!nums?.length && !arabic) return plain;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="What this word means"
        className={`font-medium text-accent hover:underline ${italic ? "italic" : ""}`}
      >
        {word}
      </button>
      {open && (nums?.length ? <WordCard nums={nums} onClose={() => setOpen(false)} /> : <ArabicCard card={arabic!} onClose={() => setOpen(false)} />)}
    </>
  );
}

/** An Arabic word's card (Wiktionary, via the site's word data): the word, how to say it, what it means. */
function ArabicCard({ card, onClose }: { card: DictCard; onClose: () => void }) {
  const e = card.entry;
  return (
    <span role="region" aria-label={`Arabic word card: ${card.head}`} className="my-1.5 block rounded-lg border border-line bg-raised p-2.5 text-sm font-normal not-italic">
      <span className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">Arabic · Wiktionary (CC BY-SA 4.0)</span>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface">
          <CloseIcon width={14} height={14} />
        </button>
      </span>
      <span className="block space-y-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span lang="ar" dir="rtl" className="text-xl text-ink">
            {card.head}
          </span>
          {e.pos.length > 0 && <span className="text-xs text-muted">{e.pos.join(", ")}</span>}
        </span>
        {e.defs.slice(0, 3).map((d, i) => (
          <span key={i} className="block">
            {e.defs.length > 1 ? `${i + 1}. ` : ""}
            {d}
          </span>
        ))}
        <span className="block pt-0.5">
          <SayAloud word={card.head} lang="ar" romanized={null} />
        </span>
      </span>
    </span>
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
