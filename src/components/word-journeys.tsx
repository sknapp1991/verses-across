"use client";
/**
 * Word journeys (study lab, hidden): pick one Hebrew or Greek word (a Strong's number) and follow it through the Old or
 * New Testament: its lexicon card and letter value, a bar for each book in canonical order (tap one to see only that
 * book), and every verse it's in. Opening a verse loads just that verse's KJV text and the original, word by word,
 * with the word lit in both; the KJV's own Strong's tags say which English word stands for it there.
 * Data: STEP Bible (lib/word-journeys.ts), the KJV's Strong's tags and Strong's dictionary (lib/strongs.ts).
 */
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AiWindow } from "./ai-window";
import { askAboutVerse, openAi } from "@/lib/ai-chat";
import { chapterTitle, findBook, readHref } from "@/lib/catalog";
import { lettersOf, valueOf } from "@/lib/letter-values";
import { lexicon, loadTags, spans, type LexEntry, type Tag } from "@/lib/strongs";
import {
  interChapter,
  keyOf,
  kjvBook,
  loadWord,
  normStrong,
  NT_BOOKS,
  NT_GROUPS,
  OT_BOOKS,
  OT_GROUPS,
  placesOf,
  searchWords,
  shortStrong,
  STARTERS,
  type Found,
  type IWord,
  type Place,
  type Sense,
} from "@/lib/word-journeys";

const PAGE = 40;
const fontOf = (hebrew: boolean) => ({ fontFamily: hebrew ? "var(--font-hebrew), 'SBL Hebrew', serif" : "var(--font-greek), var(--font-serif)" });
const bookName = (id: string) => findBook("bible", id)?.name ?? id;
const placeTitle = (p: Place) => `${chapterTitle(findBook("bible", p.book), p.ch, p.book)}${p.v === "0" ? " (title)" : `:${p.v}`}`;
/** "H0430" / "H430" / "H430a" → "H430": how the KJV's tags write a number. */
const plainNum = (n: string) => n.replace(/^([HG])0*(\d+).*$/, "$1$2");
/** The KJV puts a psalm's title in verse 1; the interlinear calls it verse 0. */
const kjvVerse = (v: string) => (v === "0" ? "1" : v);

/* ---------------- picking a word ---------------- */

function Picker({ current, onPick }: { current: string | null; onPick: (base: string) => void }) {
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"both" | "H" | "G">("both");
  const [res, setRes] = useState<{ key: string; list: Found[] | null } | null>(null);
  const direct = normStrong(q);
  const want = q.trim().length >= 2 && !direct ? `${lang}|${q.trim().toLowerCase()}` : "";

  useEffect(() => {
    if (!want) return;
    let live = true;
    const t = setTimeout(() => {
      const langs: ("H" | "G")[] = lang === "both" ? ["H", "G"] : [lang];
      searchWords(q, langs).then(
        (list) => live && setRes({ key: want, list }),
        () => live && setRes({ key: want, list: null }),
      );
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [want]); // eslint-disable-line react-hooks/exhaustive-deps

  const found = res?.key === want ? res.list : undefined;
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
      <h2 className="font-serif text-lg font-semibold text-ink">Pick a word</h2>
      <div className="flex flex-wrap gap-2">
        {STARTERS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            aria-pressed={current === s.id}
            className={`min-h-9 rounded-full border px-3 text-sm ${current === s.id ? "border-accent bg-accent text-accent-ink" : "border-line text-ink hover:bg-raised"}`}
          >
            <span className="italic">{s.name}</span> <span className={current === s.id ? "" : "text-muted"}>· {s.hint}</span>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <label htmlFor="wj-search" className="block text-sm text-muted">
          Or search by sound, spelling, English meaning or Strong&rsquo;s number (like <em>hesed</em>, <em>love</em>, <em>ἀγάπη</em> or <em>G26</em>)
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="wj-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && direct) onPick(direct);
            }}
            placeholder="Search words"
            autoComplete="off"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 text-ink placeholder:text-faint"
          />
          <div role="group" aria-label="Which language" className="flex overflow-hidden rounded-lg border border-line text-xs">
            {(
              [
                ["both", "Both"],
                ["H", "Hebrew"],
                ["G", "Greek"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={lang === id}
                onClick={() => setLang(id)}
                className={`min-h-10 px-3 ${lang === id ? "bg-accent text-accent-ink" : "text-ink hover:bg-raised"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {direct ? (
          <button type="button" onClick={() => onPick(direct)} className="min-h-9 text-sm text-accent hover:underline">
            Follow Strong&rsquo;s {shortStrong(direct)} →
          </button>
        ) : want && found === undefined ? (
          <p role="status" className="animate-pulse text-sm text-muted">
            Loading words…
          </p>
        ) : want && found === null ? (
          <p className="text-sm text-muted">Couldn&rsquo;t load the word list. Check the connection and try again.</p>
        ) : want && found && !found.length ? (
          <p className="text-sm text-muted">No words found for that. Try another spelling or an English word.</p>
        ) : want && found ? (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {found.map((f) => (
              <li key={f.base}>
                <button type="button" onClick={() => onPick(f.base)} className="flex min-h-10 w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-raised">
                  <span lang={f.base[0] === "H" ? "he" : "grc"} className="shrink-0 text-lg text-ink" style={fontOf(f.base[0] === "H")}>
                    {f.lemma}
                  </span>
                  <span className="shrink-0 text-sm italic text-muted">{f.translit}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.glosses.slice(0, 3).join(" · ")}</span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {shortStrong(f.base)} · {f.verses.toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------- one verse, opened ---------------- */

type Detail = { kjv: string | null; tags: Tag[] | null; words: IWord[] | null };

function PlaceDetail({ p, base, hebrew }: { p: Place; base: string; hebrew: boolean }) {
  const [d, setD] = useState<Detail | null | false>(null);
  useEffect(() => {
    let live = true;
    const v = kjvVerse(p.v);
    void Promise.all([kjvBook(p.book), loadTags("kjv", p.book), interChapter(p.book, p.ch)]).then(([text, tags, inter]) => {
      if (!live) return;
      if (!text && !inter) return setD(false);
      const kjv = text?.chapters[String(p.ch)]?.verses.find((x) => x.v === v)?.t ?? null;
      setD({ kjv, tags: tags?.[`${p.ch}:${v}`] ?? null, words: inter?.[p.v] ?? null });
    });
    return () => {
      live = false;
    };
  }, [p.book, p.ch, p.v]);

  const num = plainNum(base);
  const parts = useMemo(() => {
    if (!d || !d.kjv) return null;
    const lit = d.tags ? spans(d.kjv, d.tags).filter((s) => s.nums.some((n) => plainNum(n) === num)) : [];
    const out: { t: string; on: boolean }[] = [];
    let at = 0;
    for (const s of lit) {
      if (s.start < at) continue;
      if (s.start > at) out.push({ t: d.kjv.slice(at, s.start), on: false });
      out.push({ t: d.kjv.slice(s.start, s.end), on: true });
      at = s.end;
    }
    if (at < d.kjv.length) out.push({ t: d.kjv.slice(at), on: false });
    return out;
  }, [d, num]);

  if (d === null)
    return (
      <p role="status" className="animate-pulse px-3 pb-3 text-sm text-muted">
        Loading the verse…
      </p>
    );
  if (d === false) return <p className="px-3 pb-3 text-sm text-muted">Couldn&rsquo;t load this verse. Check the connection and try again.</p>;
  const kjvWords = parts ? parts.filter((x) => x.on).map((x) => x.t) : [];
  const mine = (w: IWord) => {
    const k = keyOf(w[3]);
    return !!k && k.slice(0, 5) === base;
  };
  const lit = d.words ? d.words.filter(mine) : [];
  const ref = { work: "bible", book: p.book, chapter: p.ch };
  return (
    <div className="space-y-3 px-3 pb-3">
      {d.kjv && parts && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">KJV</p>
          <p className="font-serif leading-relaxed text-ink">
            {parts.map((x, i) =>
              x.on ? (
                <mark key={i} className="rounded bg-accent-soft px-0.5 font-semibold text-ink">
                  {x.t}
                </mark>
              ) : (
                <span key={i}>{x.t}</span>
              ),
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            {kjvWords.length ? (
              <>
                The KJV&rsquo;s word for it here: <strong className="text-ink">{kjvWords.join(", ")}</strong>
              </>
            ) : (
              "The KJV's tags don't mark a word for it in this verse (it may be part of a phrase, or left untranslated)."
            )}
          </p>
        </div>
      )}
      {d.words && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{hebrew ? "Hebrew" : "Greek"}, word by word</p>
          <p lang={hebrew ? "he" : "grc"} dir={hebrew ? "rtl" : "ltr"} className="text-xl leading-loose text-ink" style={fontOf(hebrew)}>
            {d.words.map((w, i) => (
              <span key={i}>
                {i > 0 && !d.words![i - 1][0].endsWith("־") ? " " : ""}
                {mine(w) ? (
                  <mark className="rounded bg-accent-soft px-0.5 text-accent" title={`${w[1]}: ${w[2]}`}>
                    {w[0]}
                  </mark>
                ) : (
                  w[0]
                )}
              </span>
            ))}
          </p>
          {lit.map((w, i) => (
            <p key={i} className="text-xs text-muted">
              <span lang={hebrew ? "he" : "grc"} className="text-sm text-ink" style={fontOf(hebrew)}>
                {w[0]}
              </span>{" "}
              <span className="italic">{w[1]}</span>: {w[2]}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href={readHref(ref, ["kjv", hebrew ? "hebrew" : "greek"], kjvVerse(p.v))} className="text-xs text-accent hover:underline">
          Read {chapterTitle(findBook("bible", p.book), p.ch, p.book)} →
        </Link>
        <button
          type="button"
          onClick={() =>
            askAboutVerse({
              reference: placeTitle(p),
              texts: [
                ...(d.kjv ? [{ abbr: "KJV", name: "King James Version", language: "English", text: d.kjv }] : []),
                ...(d.words
                  ? [
                      {
                        abbr: hebrew ? "Hebrew" : "Greek",
                        name: hebrew ? "Hebrew (STEP Bible's tagged Leningrad Codex)" : "Greek (STEP Bible's tagged Textus Receptus)",
                        language: hebrew ? "Hebrew" : "Greek",
                        text: d.words.map((w) => w[0]).join(" "),
                      },
                    ]
                  : []),
              ],
            })
          }
          className="text-xs font-medium text-accent hover:underline"
        >
          ✦ Ask AI about this verse
        </button>
      </div>
    </div>
  );
}

/* ---------------- the journey ---------------- */

function Journey({ base }: { base: string }) {
  const hebrew = base[0] === "H";
  const [senses, setSenses] = useState<Sense[] | null | undefined>(undefined);
  const [dict, setDict] = useState<LexEntry | null>(null);
  const [off, setOff] = useState<string[]>([]); // senses switched off
  const [book, setBook] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string[]>([]);
  const [tally, setTally] = useState<{ done: number; of: number; words: [string, number][]; none: number } | null>(null);
  const tallyRun = useRef(0); // a newer count (or a sense switched) makes an older one stop

  useEffect(() => {
    let live = true;
    void loadWord(base).then((s) => live && setSenses(s));
    void lexicon(plainNum(base)).then((e) => live && setDict(e));
    return () => {
      live = false;
    };
  }, [base]);

  const on = useMemo(() => new Set((senses ?? []).map((s) => s.key).filter((k) => off.indexOf(k) < 0)), [senses, off]);
  const places = useMemo(() => (senses ? placesOf(senses, on) : []), [senses, on]);
  const books = hebrew ? OT_BOOKS : NT_BOOKS;
  const perBook = useMemo(() => {
    const n = new Array<number>(books.length).fill(0);
    for (const p of places) if (p.bi >= 0) n[p.bi]++;
    return n;
  }, [places, books]);
  const max = Math.max(1, ...perBook);
  const list = useMemo(() => (book ? places.filter((p) => p.book === book) : places), [places, book]);
  const glosses = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of places) n.set(p.gloss, (n.get(p.gloss) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1]);
  }, [places]);

  if (senses === undefined)
    return (
      <p role="status" className="animate-pulse text-muted">
        Loading the word…
      </p>
    );
  if (senses === null || !senses.length)
    return (
      <p className="rounded-2xl border border-line bg-panel p-4 text-muted">
        {senses === null ? "Couldn't load this word. Check the connection and try again." : `There's no word with the number ${shortStrong(base)} in the lexicon.`}
      </p>
    );

  const head = senses.find((s) => s.lex) ?? senses[0];
  const lemma = head.lex?.[0] ?? head.conc?.f[0] ?? "";
  const translit = head.lex?.[1] ?? "";
  const script = hebrew ? "hebrew" : "greek";
  const letters = lettersOf(lemma, script);
  const total = valueOf(lemma, script);
  /** The lexicon's gloss, or (an entry the lexicon doesn't list) the gloss the interlinear uses most for it. */
  const senseLabel = (s: Sense) => {
    if (s.lex?.[2]) return s.lex[2];
    if (!s.conc) return shortStrong(s.key);
    const n = new Array<number>(s.conc.g.length).fill(0);
    for (const x of s.conc.r) n[+x.slice(x.lastIndexOf(" ") + 1)]++;
    return s.conc.g[n.indexOf(Math.max(...n))] ?? s.key;
  };
  const topBooks = perBook
    .map((n, i) => ({ n, id: books[i] }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  const groups = hebrew ? OT_GROUPS : NT_GROUPS;

  const countKjv = async () => {
    const num = plainNum(base);
    const ids = books.filter((b) => places.some((p) => p.book === b));
    const words = new Map<string, number>();
    let none = 0;
    const run = ++tallyRun.current;
    setTally({ done: 0, of: ids.length, words: [], none: 0 });
    for (let i = 0; i < ids.length; i++) {
      const tags = await loadTags("kjv", ids[i]);
      if (run !== tallyRun.current) return;
      for (const p of places) {
        if (p.book !== ids[i]) continue;
        const here = (tags?.[`${p.ch}:${kjvVerse(p.v)}`] ?? []).filter((t) => t.slice(1).some((n) => plainNum(n) === num)).map((t) => t[0].toLowerCase().replace(/[’'.,;:!?]+$/, ""));
        if (!here.length) none++;
        for (const w of new Set(here)) words.set(w, (words.get(w) ?? 0) + 1);
      }
      setTally({ done: i + 1, of: ids.length, words: [...words].sort((a, b) => b[1] - a[1]), none });
    }
  };

  return (
    <>
      <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span lang={hebrew ? "he" : "grc"} dir={hebrew ? "rtl" : "ltr"} className="text-4xl text-ink" style={fontOf(hebrew)}>
            {lemma}
          </span>
          <span className="text-xl italic text-ink">{translit}</span>
          <span className="text-xs text-faint">Strong&rsquo;s {shortStrong(base)}</span>
        </div>
        <p className="text-lg text-ink">{head.lex?.[2] ?? head.conc?.g[0]}</p>
        {head.lex?.[3] && (
          <details className="text-sm text-muted">
            <summary className="cursor-pointer text-accent">The longer entry</summary>
            <p className="mt-1 leading-relaxed">{head.lex[3]}</p>
          </details>
        )}
        {senses.length > 1 && (
          <div className="space-y-1">
            <p className="text-xs text-muted">The lexicon splits this number into {senses.length} entries. Tap one to leave it out or bring it back:</p>
            <div className="flex flex-wrap gap-2">
              {senses.map((s) => {
                const isOn = on.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => {
                      setOff(isOn ? off.concat(s.key) : off.filter((k) => k !== s.key));
                      setShown(PAGE);
                      tallyRun.current++;
                      setTally(null);
                    }}
                    className={`min-h-9 rounded-full border px-3 text-xs ${isOn ? "border-accent bg-accent-soft text-ink" : "border-line text-faint line-through"}`}
                  >
                    {senseLabel(s)} <span className="text-muted">({(s.conc?.n ?? 0).toLocaleString()})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {total > 0 && (
          <p className="text-sm text-muted">
            {hebrew ? "Gematria" : "Isopsephy"} (letters as numbers): <strong className="text-ink">{total.toLocaleString()}</strong>{" "}
            <span className="text-xs text-faint">
              ={" "}
              {letters.map((l, i) => (
                <span key={i}>
                  {i > 0 && " + "}
                  <span lang={hebrew ? "he" : "grc"} style={fontOf(hebrew)}>
                    {l.ch}
                  </span>{" "}
                  {l.value}
                </span>
              ))}
            </span>
          </p>
        )}
        <button
          type="button"
          onClick={() =>
            askAboutVerse({
              reference: `${translit || lemma} (${lemma}, Strong's ${shortStrong(base)})`,
              texts: [
                {
                  abbr: "Lexicon",
                  name: "STEP Bible lexicon (Tyndale House, Cambridge)",
                  language: hebrew ? "Hebrew" : "Greek",
                  text:
                    `${lemma} (${translit}): ${head.lex?.[2] ?? ""}. ${head.lex?.[3] ?? ""} ` +
                    `Found in ${places.length} verses of the ${hebrew ? "Old" : "New"} Testament, most in ${topBooks.map((b) => `${bookName(b.id)} (${b.n})`).join(", ")}. ` +
                    `Interlinear glosses: ${glosses
                      .slice(0, 8)
                      .map(([g, n]) => `${g} (${n})`)
                      .join(", ")}.` +
                    (dict?.kjv ? ` KJV renderings (Strong's): ${dict.kjv}` : ""),
                },
              ],
            })
          }
          className="text-xs font-medium text-accent hover:underline"
        >
          ✦ Ask AI about this word
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <h2 className="font-serif text-lg font-semibold text-ink">Where it goes</h2>
        <p className="text-sm text-muted">
          In {places.length.toLocaleString()} verse{places.length === 1 ? "" : "s"} of the {hebrew ? "Old" : "New"} Testament
          {topBooks.length > 0 && <>, most often in {topBooks.map((b) => `${bookName(b.id)} (${b.n})`).join(", ")}</>}. Each bar is a book, in order from{" "}
          {hebrew ? "Genesis to Malachi" : "Matthew to Revelation"}.
        </p>
        <div>
          <div className="flex h-32 items-end gap-px border-b border-line" role="group" aria-label="Verses per book">
            {books.map((id, i) => {
              const n = perBook[i];
              const sel = book === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!n}
                  aria-pressed={sel}
                  aria-label={`${bookName(id)}: ${n} verse${n === 1 ? "" : "s"}`}
                  title={`${bookName(id)}: ${n}`}
                  onClick={() => {
                    setBook(sel ? null : id);
                    setShown(PAGE);
                  }}
                  className="flex h-full min-w-0 flex-1 items-end"
                >
                  <span
                    className={`block w-full rounded-t-sm ${!n ? "" : book && !sel ? "bg-accent-soft" : "bg-accent"}`}
                    style={{ height: n ? `${Math.max(3, (n / max) * 100)}%` : 0 }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex gap-px text-[10px] text-faint">
            {groups.map((g) => (
              <span key={g.name} style={{ flexGrow: g.n, flexBasis: 0 }} className="min-w-0 truncate border-l border-line pl-0.5">
                {g.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <label htmlFor="wj-book">Tap a bar, or choose a book:</label>
          <select
            id="wj-book"
            value={book ?? ""}
            onChange={(e) => {
              setBook(e.target.value || null);
              setShown(PAGE);
            }}
            className="min-h-9 rounded-lg border border-line bg-paper px-2 text-sm text-ink"
          >
            <option value="">Every book ({places.length.toLocaleString()})</option>
            {books.map((id, i) =>
              perBook[i] ? (
                <option key={id} value={id}>
                  {bookName(id)} ({perBook[i]})
                </option>
              ) : null,
            )}
          </select>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <h2 className="font-serif text-lg font-semibold text-ink">How it&rsquo;s put into English</h2>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">The interlinear&rsquo;s word-for-word glosses</h3>
          <p className="text-sm leading-relaxed text-muted">
            {glosses.slice(0, 12).map(([g, n], i) => (
              <span key={g}>
                {i > 0 && " · "}
                {g} <span className="text-faint">({n})</span>
              </span>
            ))}
            {glosses.length > 12 && <span className="text-faint"> · and {glosses.length - 12} more</span>}
          </p>
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">The King James Version</h3>
          {dict?.kjv && (
            <p className="text-sm text-muted">
              Strong&rsquo;s list of the KJV&rsquo;s renderings: <span className="text-ink">{dict.kjv}</span>
            </p>
          )}
          {!tally ? (
            <button type="button" onClick={() => void countKjv()} className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised">
              Count the KJV&rsquo;s words in all {places.length.toLocaleString()} verses
            </button>
          ) : (
            <>
              {tally.done < tally.of && (
                <p role="status" className="animate-pulse text-xs text-muted">
                  Reading book {tally.done + 1} of {tally.of}…
                </p>
              )}
              <p className="text-sm leading-relaxed text-muted">
                {tally.words.slice(0, 20).map(([w, n], i) => (
                  <span key={w}>
                    {i > 0 && " · "}
                    <span className="text-ink">{w}</span> <span className="text-faint">({n})</span>
                  </span>
                ))}
                {tally.words.length > 20 && <span className="text-faint"> · and {tally.words.length - 20} more</span>}
              </p>
              {tally.done === tally.of && tally.none > 0 && (
                <p className="text-xs text-faint">
                  In {tally.none.toLocaleString()} verse{tally.none === 1 ? "" : "s"} the KJV&rsquo;s tags mark no word for it (part of a phrase, left
                  untranslated, or numbered a little differently).
                </p>
              )}
            </>
          )}
          <p className="text-xs text-faint">
            From the KJV&rsquo;s own Strong&rsquo;s tags, counted once per verse. The tags use Strong&rsquo;s plain numbers, so they don&rsquo;t tell
            the lexicon&rsquo;s separate entries apart.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-serif text-lg font-semibold text-ink">
          Every place{book ? ` in ${bookName(book)}` : ""} <span className="text-sm font-normal text-muted">({list.length.toLocaleString()})</span>
        </h2>
        <p className="text-xs text-muted">Tap a verse to see it in the KJV and in the {hebrew ? "Hebrew" : "Greek"}, with the word lit up.</p>
        <ol className="divide-y divide-line rounded-xl border border-line bg-panel">
          {list.slice(0, shown).map((p) => {
            const id = `${p.book} ${p.ch}:${p.v}`;
            const isOpen = open.indexOf(id) >= 0;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? open.filter((x) => x !== id) : open.concat(id))}
                  className="flex min-h-10 w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-raised"
                >
                  <span className="w-28 shrink-0 text-sm text-ink">{placeTitle(p)}</span>
                  <span lang={hebrew ? "he" : "grc"} dir={hebrew ? "rtl" : "ltr"} className="shrink-0 text-base text-ink" style={fontOf(hebrew)}>
                    {p.form}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{p.gloss}</span>
                  <span aria-hidden className="shrink-0 text-xs text-faint">
                    {isOpen ? "▴" : "▾"}
                  </span>
                </button>
                {isOpen && <PlaceDetail p={p} base={base} hebrew={hebrew} />}
              </li>
            );
          })}
        </ol>
        {shown < list.length && (
          <button type="button" onClick={() => setShown(shown + PAGE)} className="min-h-9 text-sm text-accent hover:underline">
            Show more ({(list.length - shown).toLocaleString()} left)
          </button>
        )}
      </section>
    </>
  );
}

/* ---------------- the page ---------------- */

export function WordJourneys() {
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    // a shared address (?w=H2617) opens that word; read after hydration
    const w = new URLSearchParams(window.location.search).get("w");
    const b = w ? normStrong(w) : null;
    if (b) setBase(b); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  const pick = (b: string) => {
    setBase(b);
    try {
      window.history.replaceState(null, "", `?w=${shortStrong(b)}`);
    } catch {
      /* (an address that can't change is fine) */
    }
    requestAnimationFrame(() => document.getElementById("wj-journey")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-accent hover:underline">
            ← Study lab
          </Link>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Word journeys</p>
            <button type="button" onClick={() => openAi()} className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised">
              ✦ Ask AI
            </button>
          </div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Follow one word</h1>
          <p className="text-muted">
            Choose a Hebrew or Greek word and follow it through the Old or New Testament: what it means, where it turns up, and how the King James
            Version puts it into English, verse by verse.
          </p>
        </header>
        <Picker current={base} onPick={pick} />
        <div id="wj-journey" className="scroll-mt-4 space-y-5">
          {base && <Journey key={base} base={base} />}
        </div>
        <footer className="space-y-1 text-xs text-faint">
          <p>
            Hebrew and Greek words, glosses, lexicon entries and where each word appears: STEP Bible (
            <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener" className="underline">
              Tyndale House, Cambridge
            </a>
            ), licensed CC BY 4.0. Hebrew: the Leningrad Codex. Greek: the Textus Receptus words as tagged by STEP. Verse numbers follow the KJV.
          </p>
          <p>
            King James Version and its Strong&rsquo;s word tags (eBible.org): public domain. Strong&rsquo;s Hebrew and Greek dictionaries: public domain, from{" "}
            <a href="https://github.com/openscriptures/strongs" target="_blank" rel="noopener" className="underline">
              Open Scriptures
            </a>
            .
          </p>
          <p>
            <Link href="/" className="text-accent hover:underline">
              Verses Across
            </Link>
          </p>
        </footer>
      </div>
      <Suspense fallback={null}>
        <AiWindow />
      </Suspense>
    </main>
  );
}
