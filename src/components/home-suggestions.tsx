"use client";
/**
 * The home page's "Suggestions" tile: four quick questions, then a few picks that fit (ticket 72cd7cf4, the
 * brother's idea). Verses Across: hand-picked passages, tagged by what they offer, tradition, length and how
 * gentle a start they are. Library Across: books from the matching shelves, by length and fame. The answers
 * stay on this device (localStorage); nothing is sent. Kept simple to build on later.
 */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_VERSIONS, catalog, chapterTitle, findBook, readHref } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { SITE_SIDE } from "@/lib/site";

const library = SITE_SIDE === "library";
const KEY = library ? "la-suggest:v1" : "va-suggest:v1";

type Q = { id: string; ask: string; options: [string, string][] };

const QUESTIONS: Q[] = library
  ? [
      {
        id: "kind",
        ask: "What kind of book?",
        options: [
          ["adventure", "Adventure"],
          ["mystery", "Mystery & crime"],
          ["romance", "Romance"],
          ["spooky", "Spooky"],
          ["sff", "Science fiction & fantasy"],
          ["funny", "Funny"],
          ["poetry", "Poetry & plays"],
          ["children", "For children"],
        ],
      },
      {
        id: "len",
        ask: "How long?",
        options: [
          ["short", "Short"],
          ["medium", "A novel"],
          ["long", "A big one"],
        ],
      },
      {
        id: "mood",
        ask: "In the mood for…",
        options: [
          ["light", "Something light"],
          ["gripping", "Can't put it down"],
          ["thoughtful", "Something to think about"],
        ],
      },
      {
        id: "fame",
        ask: "Famous classics or hidden gems?",
        options: [
          ["famous", "Famous classics"],
          ["gems", "Hidden gems"],
          ["any", "Either"],
        ],
      },
    ]
  : [
      {
        id: "want",
        ask: "What are you looking for today?",
        options: [
          ["comfort", "Comfort and hope"],
          ["wisdom", "Wisdom for daily life"],
          ["stories", "A great story"],
          ["prayer", "Prayer and devotion"],
          ["questions", "The big questions"],
        ],
      },
      {
        id: "trad",
        ask: "Which traditions?",
        options: [
          ["abr", "Christian and Jewish"],
          ["islam", "Islam"],
          ["east", "Eastern (Hindu, Buddhist, Taoist…)"],
          ["any", "Surprise me"],
        ],
      },
      {
        id: "len",
        ask: "How much time do you have?",
        options: [
          ["short", "5 minutes"],
          ["medium", "15 minutes"],
          ["long", "A good while"],
        ],
      },
      {
        id: "level",
        ask: "Are these texts new to you?",
        options: [
          ["new", "Quite new"],
          ["known", "I know my way around"],
        ],
      },
    ];

/** Verses Across picks: [work/book/chapter, a few words on it, what it offers, tradition, length, level]. */
const PICKS: [string, string, string[], string, string, string][] = [
  ["bible/psa/23", "The Lord is my shepherd", ["comfort", "prayer"], "abr", "short", "new"],
  ["bible/mat/5", "The Sermon on the Mount begins", ["wisdom", "comfort"], "abr", "medium", "new"],
  ["bible/jhn/1", "In the beginning was the Word", ["questions"], "abr", "medium", "new"],
  ["bible/ecc/3", "A time for everything", ["questions", "wisdom"], "abr", "short", "new"],
  ["bible/pro/3", "Trust, and lean not on your own understanding", ["wisdom"], "abr", "short", "new"],
  ["bible/gen/1", "The creation", ["stories", "questions"], "abr", "medium", "new"],
  ["bible/rut/1", "Ruth: loyalty in hard times", ["stories", "comfort"], "abr", "long", "new"],
  ["bible/job/38", "God answers Job from the whirlwind", ["questions"], "abr", "medium", "known"],
  ["bible/luk/15", "The lost sheep and the lost son", ["stories", "comfort"], "abr", "short", "new"],
  ["bible/rom/8", "Nothing can separate us", ["comfort"], "abr", "medium", "known"],
  ["bible/isa/40", "Comfort ye my people", ["comfort", "prayer"], "abr", "medium", "known"],
  ["bible/gen/37", "Joseph and his brothers", ["stories"], "abr", "long", "new"],
  ["bible/1co/13", "Love is patient, love is kind", ["comfort", "wisdom"], "abr", "short", "new"],
  ["quran/quran/1", "The Opening (Al-Fatiha)", ["prayer"], "islam", "short", "new"],
  ["quran/quran/12", "The story of Joseph (Yusuf)", ["stories"], "islam", "long", "new"],
  ["quran/quran/93", "The Morning Light (Ad-Duha)", ["comfort"], "islam", "short", "new"],
  ["quran/quran/55", "The Most Merciful (Ar-Rahman)", ["prayer", "comfort"], "islam", "medium", "new"],
  ["gita/gita/2", "Krishna's teaching on duty and the self", ["wisdom", "questions"], "east", "medium", "new"],
  ["gita/gita/12", "The way of devotion", ["prayer"], "east", "short", "known"],
  ["dhammapada/dhp/1", "The twin verses: mind comes first", ["wisdom"], "east", "short", "new"],
  ["tao-te-ching/ttc/1", "The Tao that can be told", ["questions", "wisdom"], "east", "short", "new"],
  ["tao-te-ching/ttc/8", "The highest good is like water", ["wisdom", "comfort"], "east", "short", "new"],
  ["analects/analects/1", "Confucius on learning and friendship", ["wisdom"], "east", "medium", "new"],
  ["zhuangzi/zhuangzi/1", "Free and easy wandering", ["stories", "questions"], "east", "medium", "known"],
  ["upanishads/katha/1", "Nachiketa questions Death", ["questions", "stories"], "east", "medium", "known"],
  ["ramayana/ry1/1", "The Ramayana begins", ["stories"], "east", "long", "known"],
  ["meditations/med/2", "Marcus Aurelius on a calm mind", ["wisdom"], "any", "medium", "new"],
  ["ggs/opening-banis-japji-so-dar-sohila/1", "Japji Sahib, the Sikh morning prayer", ["prayer"], "east", "medium", "known"],
  ["odyssey/odyssey/1", "The Odyssey begins", ["stories"], "any", "long", "new"],
  ["hidden-words/hw/1", "The Hidden Words", ["comfort", "prayer"], "any", "short", "new"],
];
const VA_THEME: Record<string, [string, string]> = {
  comfort: ["grief", "Grief and comfort"],
  wisdom: ["wisdom", "Wisdom"],
  stories: ["heroes", "Heroes"],
  prayer: ["prayer", "Prayer"],
  questions: ["the-soul", "The soul"],
};

/** Library Across: shelves for each kind, and a story theme to go with it. */
const SHELVES: Record<string, string[]> = {
  adventure: ["fic-adventure", "fic-western", "fic-historical"],
  mystery: ["fic-detective", "fic-crime"],
  romance: ["fic-romance"],
  spooky: ["fic-gothic", "fic-horror"],
  sff: ["fic-scifi", "fic-fantasy", "fic-sff", "fic-scifi-women"],
  funny: ["fic-humor"],
  poetry: ["lit-poetry", "lit-drama"],
  children: ["lit-children"],
};
const MOOD_SHELVES: Record<string, string[]> = { light: ["fic-humor", "lit-children", "fic-adventure"], gripping: ["fic-detective", "fic-crime", "fic-horror", "fic-adventure"], thoughtful: ["lit-fiction", "lit-poetry", "lit-drama", "lit-social"] };
const LA_THEME: Record<string, [string, string]> = {
  adventure: ["adventure-quest", "Adventure and quest"],
  mystery: ["murder-mystery", "Murder mystery"],
  romance: ["first-love", "First love"],
  spooky: ["ghosts", "Ghosts"],
  sff: ["journey-to-space", "Journey to space"],
  funny: ["humour-satire", "Humour and satire"],
  poetry: ["nature-solitude", "Nature and solitude"],
  children: ["animals-companions", "Animal companions"],
};

type Pick = { href: string; title: string; note: string };

function readAnswers(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function suggest(a: Record<string, string>, seed: number): { picks: Pick[]; theme?: [string, string] } {
  const versions = (work: string) => getSettings().versions[work] ?? DEFAULT_VERSIONS[work];
  if (!library) {
    const scored = PICKS.map((p, i) => {
      const [ref, , wants, trad, len, level] = p;
      let s = 0;
      if (wants.includes(a.want)) s += 4;
      if (a.trad === "any" || trad === a.trad) s += a.trad === "any" ? 1 : 3;
      else if (trad === "any") s += 1;
      if (len === a.len) s += 1;
      if (level === a.level) s += 1;
      return { p, s: s - i / 1000, ref }; // equal scores keep the list's order
    }).sort((x, y) => y.s - x.s);
    // "Show me others": the best 8, four at a time
    const top = scored.slice(0, 8);
    const from = (seed * 4) % top.length;
    const picks = [...top.slice(from), ...top.slice(0, from)].slice(0, 4).map(({ p, ref }) => {
      const [work, book, ch] = ref.split("/");
      const entry = findBook(work, book);
      return { href: readHref({ work, book, chapter: Number(ch) }, versions(work)), title: entry ? chapterTitle(entry, Number(ch)) : ref, note: p[1] };
    });
    return { picks, theme: VA_THEME[a.want] };
  }
  const want = new Set(SHELVES[a.kind] ?? []);
  const moodShelves = new Set(MOOD_SHELVES[a.mood] ?? []);
  const cols = catalog.religions.flatMap((r) => r.collections).filter((c) => want.has(c.id));
  const seen = new Set<string>();
  const books: { work: string; book: string; name: string; chapters: number; rank: number; shelf: string; mood: boolean }[] = [];
  for (const c of cols)
    c.items.forEach((it, rank) => {
      if (!it.chapters || !it.work || seen.has(it.work)) return;
      seen.add(it.work);
      books.push({ work: it.work, book: it.id, name: it.name.split(" · ")[0], chapters: it.chapters, rank, shelf: c.name, mood: moodShelves.has(c.id) });
    });
  const lenOk = (n: number) => (a.len === "short" ? n <= 12 : a.len === "medium" ? n > 8 && n <= 60 : n > 45);
  const fameOk = (r: number) => (a.fame === "famous" ? r < 15 : a.fame === "gems" ? r >= 15 : true);
  let pool = books.filter((b) => lenOk(b.chapters) && fameOk(b.rank));
  if (pool.length < 4) pool = books.filter((b) => fameOk(b.rank));
  if (pool.length < 4) pool = books;
  // Shelves that suit the mood first; then shuffled by the seed ("Show me others"). Famous: the best-known
  // dozen of the pool, shuffled, so "others" still brings classics.
  const shuffled = pool
    .map((b, i) => ({ b, k: (((i + 1) * 2654435761 + seed * 40503) >>> 0) % 1000 }))
    .sort((x, y) => (a.fame === "famous" ? x.b.rank - y.b.rank : 0) || Number(y.b.mood) - Number(x.b.mood) || x.k - y.k);
  const order = (a.fame === "famous" ? shuffled.slice(0, 12).sort((x, y) => Number(y.b.mood) - Number(x.b.mood) || x.k - y.k) : shuffled).slice(0, 4);
  return {
    picks: order.map(({ b }) => ({ href: readHref({ work: b.work, book: b.book, chapter: 1 }, versions(b.work)), title: b.name, note: `${b.shelf} · ${b.chapters} chapters` })),
    theme: LA_THEME[a.kind],
  };
}

export function SuggestionsTile({ className = "" }: { className?: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState<number | null>(null); // null: not started (or showing saved results)
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved answers live in this browser only
    setAnswers(readAnswers());
  }, []);
  const done = QUESTIONS.every((q) => answers[q.id]);
  const result = useMemo(() => (done && step === null ? suggest(answers, seed) : null), [answers, done, step, seed]);
  const choose = (id: string, v: string) => {
    const next = { ...answers, [id]: v };
    setAnswers(next);
    const i = QUESTIONS.findIndex((q) => q.id === id);
    if (i + 1 < QUESTIONS.length) setStep(i + 1);
    else {
      setStep(null);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* private mode: shown, not kept */
      }
    }
  };
  const q = step === null ? null : QUESTIONS[step];

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border border-line bg-panel p-4 shadow-sm ${className}`}>
      <span className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent" aria-hidden>
          ✦
        </span>
        Suggestions
      </span>
      {q ? (
        <div className="space-y-2" role="group" aria-label={q.ask}>
          <p className="text-sm text-ink">
            <span className="text-faint">
              {step! + 1} of {QUESTIONS.length} ·{" "}
            </span>
            {q.ask}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={answers[q.id] === v}
                onClick={() => choose(q.id, v)}
                className={`min-h-9 rounded-full border px-3 text-sm ${answers[q.id] === v ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:border-faint hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {step! > 0 && (
            <button type="button" onClick={() => setStep(step! - 1)} className="text-xs text-faint underline underline-offset-2 hover:text-muted">
              Back
            </button>
          )}
        </div>
      ) : result ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Picked for you:</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {result.picks.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="block rounded-lg border border-line px-3 py-2 hover:border-accent">
                  <span className="block font-medium text-accent">{p.title}</span>
                  <span className="block text-xs text-muted">{p.note}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {result.theme && (
              <Link href={`/themes/${result.theme[0]}`} className="font-medium text-accent hover:underline">
                Theme: {result.theme[1]} →
              </Link>
            )}
            <button type="button" onClick={() => setSeed((s) => s + 1)} className="text-muted underline underline-offset-2 hover:text-ink">
              Show me others
            </button>
            <button type="button" onClick={() => setStep(0)} className="text-muted underline underline-offset-2 hover:text-ink">
              Change my answers
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {library ? "Not sure what to read? Answer 4 quick questions" : "Not sure where to start? Answer 4 quick questions"} and get a few picks that fit. Your
            answers stay on this device.
          </p>
          <button type="button" onClick={() => setStep(0)} className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
            Start
          </button>
        </div>
      )}
    </div>
  );
}
