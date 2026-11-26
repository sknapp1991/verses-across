"use client";
/**
 * Translation lab (a hidden study page): one Bible verse in the site's five English translations, each compared word by
 * word with a base translation the reader picks; then the original (Hebrew for the Old Testament, Greek for the New),
 * the other languages folded, and the original words one by one with their sounds and English glosses, so a reader can
 * see why the translations part ways. Texts are shown exactly as written; only the marks around words are added.
 */
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AiWindow } from "./ai-window";
import { askAboutVerse, sendAi } from "@/lib/ai-chat";
import { booksOfWork, chapterTitle, findBook, getVersion, readHref, versionsForWork } from "@/lib/catalog";
import { getLanguage } from "@/lib/languages";
import { diffWords, keysOf, tokenize, type DiffPart } from "@/lib/translation-diff";

const ENGLISH = ["kjv", "asv", "web", "ylt", "bbe"];
const STARTERS: { book: string; chapter: number; verse: string }[] = [
  { book: "gen", chapter: 1, verse: "1" },
  { book: "psa", chapter: 23, verse: "1" },
  { book: "isa", chapter: 7, verse: "14" },
  { book: "jhn", chapter: 1, verse: "1" },
  { book: "jhn", chapter: 3, verse: "16" },
  { book: "rom", chapter: 3, verse: "23" },
];
const STORE = "translation-lab";
type Pick = { book: string; chapter: number; verse: string };
const DEFAULT: Pick = { book: "jhn", chapter: 3, verse: "16" };

/* ---------------- texts ---------------- */

type V = { v: string; t: string; to?: string; n?: string; cont?: string };
type BookFile = { chapters: Record<string, { verses: V[] } | undefined> };
const fileCache = new Map<string, Promise<BookFile | null>>();
function loadBook(version: string, book: string): Promise<BookFile | null> {
  const key = `${version}/${book}`;
  let p = fileCache.get(key);
  if (!p) {
    p = fetch(`/texts/bible/${key}.json`).then(
      (r) => (r.ok ? (r.json() as Promise<BookFile>) : null),
      () => null,
    );
    fileCache.set(key, p);
    void p.then((d) => {
      if (d === null) fileCache.delete(key); // (a blip isn't kept: the next look tries again)
    });
  }
  return p;
}

const num = (v: string) => parseInt(v, 10);
type Found = { text: string | null; note?: string };

/**
 * A verse in one version, by the site's shared numbering. Some versions join verses (one cell covering two), place a
 * verse's words inside a neighbour, or number them their own way (Psalm titles, Malachi 4): say so in plain words.
 */
function findVerse(file: BookFile | null | undefined, chapter: number, verse: string): Found | undefined {
  if (file === undefined) return undefined; // still loading
  if (file === null) return { text: null, note: "This version doesn't have this book here." };
  const verses = file.chapters[String(chapter)]?.verses;
  if (!verses) return { text: null, note: "This version doesn't have this chapter." };
  const own = (x: V) => {
    const notes: string[] = [];
    if (x.n && x.n !== x.v) notes.push(`In this version's own numbering it is ${x.n.includes("–") ? "verses" : "verse"} ${x.n.replace("–", " to ")}.`);
    if (x.to) notes.push(`Here one passage covers verses ${x.v} to ${x.to}.`);
    return notes.join(" ") || undefined;
  };
  const exact = verses.find((x) => x.v === verse);
  if (exact && !exact.cont) return { text: exact.t, note: own(exact) };
  if (exact?.cont) {
    const [c, vv] = exact.cont.split(":");
    const host = num(c) === chapter ? verses.find((x) => x.v === vv) : undefined;
    return host
      ? { text: host.t, note: `This version joins this verse with verse ${vv}; the whole passage is shown.` }
      : { text: null, note: `In this version these words are part of ${exact.cont}.` };
  }
  const n = num(verse);
  const cover = verses.find((x) => x.to && !x.to.includes(":") && num(x.v) < n && n <= num(x.to));
  if (cover) return { text: cover.t, note: `This version joins verses ${cover.v} to ${cover.to}; the whole passage is shown.` };
  return { text: null, note: "This verse isn't in this version." };
}

/* ---------------- interlinear ---------------- */

type Word = [string, string, string, string, number];
type Inter = Record<string, Word[] | undefined>;
const interCache = new Map<string, Promise<Inter | null>>();
function loadInter(book: string, chapter: number): Promise<Inter | null> {
  const key = `${book}/${chapter}`;
  let p = interCache.get(key);
  if (!p) {
    p = fetch(`/api/interlinear/${key}.json`).then(
      (r) => (r.ok ? (r.json() as Promise<Inter>) : null),
      () => null,
    );
    interCache.set(key, p);
    void p.then((d) => {
      if (d === null) interCache.delete(key);
    });
  }
  return p;
}

/* ---------------- small pieces ---------------- */

const fontFor = (lang: string) =>
  lang === "he" ? { fontFamily: 'var(--font-hebrew), "SBL Hebrew", "Ezra SIL", serif' } : lang === "el" ? { fontFamily: "var(--font-greek), var(--font-serif)" } : undefined;

function Diffed({ parts, unique }: { parts: DiffPart[]; unique: (key: string) => boolean }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "space") return p.text;
        if (p.kind === "dropped") return null; // (listed under the verse, never inside its text)
        const cls = [
          p.mark === "changed" ? "rounded bg-accent-soft px-0.5" : p.mark === "added" ? "rounded px-0.5 ring-1 ring-accent" : "",
          p.key && unique(p.key) ? "underline decoration-accent decoration-dotted decoration-2 underline-offset-4" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return cls ? (
          <span key={i} className={cls}>
            {p.text}
          </span>
        ) : (
          p.text
        );
      })}
    </>
  );
}

function Plain({ text, unique }: { text: string; unique: (key: string) => boolean }) {
  return (
    <>
      {tokenize(text).map((t, i) =>
        t.key && unique(t.key) ? (
          <span key={i} className="underline decoration-accent decoration-dotted decoration-2 underline-offset-4">
            {t.text}
          </span>
        ) : (
          t.text
        ),
      )}
    </>
  );
}

const Loading = () => (
  <p role="status" className="animate-pulse text-sm text-muted">
    Loading…
  </p>
);

/* ---------------- the page ---------------- */

export function TranslationLab() {
  const [pick, setPick] = useState<Pick>(DEFAULT);
  const [base, setBase] = useState("kjv");
  const [marks, setMarks] = useState(true);
  const [othersOpen, setOthersOpen] = useState(false);
  const [files, setFiles] = useState<Record<string, BookFile | null>>({});
  const [inter, setInter] = useState<{ key: string; data: Inter | null } | null>(null);

  // The last pick, kept on this device (read after hydration).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<Pick & { base: string }>;
      if (s.book && findBook("bible", s.book) && typeof s.chapter === "number" && typeof s.verse === "string") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the saved pick once, after hydration
        setPick({ book: s.book, chapter: s.chapter, verse: s.verse });
      }
      if (s.base && ENGLISH.includes(s.base)) setBase(s.base);
    } catch {
      /* no storage here: start from John 3:16 */
    }
  }, []);
  const choose = (p: Pick, b = base) => {
    setPick(p);
    setBase(b);
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...p, base: b }));
    } catch {
      /* not kept: fine */
    }
  };

  const books = useMemo(() => booksOfWork("bible"), []);
  const entry = findBook("bible", pick.book);
  const testament = entry?.collection.id; // "ot", "nt", "apocrypha"
  const original = testament === "nt" ? "greek" : testament === "ot" ? "hebrew" : "greek"; // (the Apocrypha: the Septuagint's Greek)
  const others = useMemo(
    () =>
      versionsForWork("bible")
        .map((v) => v.id)
        .filter((id) => !ENGLISH.includes(id) && id !== original),
    [original],
  );

  // Load the book in each version needed now (the other languages only once that fold is opened).
  useEffect(() => {
    const want = [...ENGLISH, original, ...(othersOpen ? others : [])];
    let live = true;
    for (const ver of want)
      void loadBook(ver, pick.book).then((f) => {
        if (live) setFiles((prev) => (prev[`${ver}/${pick.book}`] === f ? prev : { ...prev, [`${ver}/${pick.book}`]: f }));
      });
    return () => {
      live = false;
    };
  }, [pick.book, original, others, othersOpen]);

  const hasInter = testament === "ot" || testament === "nt";
  const interKey = `${pick.book}/${pick.chapter}`;
  useEffect(() => {
    if (!hasInter) return;
    let live = true;
    void loadInter(pick.book, pick.chapter).then((data) => {
      if (live) setInter({ key: interKey, data });
    });
    return () => {
      live = false;
    };
  }, [hasInter, pick.book, pick.chapter, interKey]);

  const fileOf = (ver: string): BookFile | null | undefined => files[`${ver}/${pick.book}`];
  const verseOf = (ver: string) => findVerse(fileOf(ver), pick.chapter, pick.verse);

  // The verses of this chapter across the English versions and the original (one may have a verse another lacks).
  const verseList = useMemo(() => {
    const set = new Set<string>();
    for (const ver of [...ENGLISH, original]) {
      const f = files[`${ver}/${pick.book}`];
      for (const x of f?.chapters[String(pick.chapter)]?.verses ?? []) set.add(x.v);
    }
    set.add(pick.verse);
    return Array.from(set).sort((a, b) => num(a) - num(b) || (a < b ? -1 : a > b ? 1 : 0));
  }, [files, original, pick.book, pick.chapter, pick.verse]);

  const english = ENGLISH.map((id) => ({ id, v: getVersion(id), found: verseOf(id) }));
  const baseText = english.find((e) => e.id === base)?.found?.text ?? null;
  // Words found in only one of the English versions (case and punctuation aside).
  const keySets = english.map((e) => (e.found?.text ? keysOf(e.found.text) : null));
  const uniqueFor = (idx: number) => (key: string) => {
    let n = 0;
    keySets.forEach((s) => {
      if (s?.has(key)) n++;
    });
    return n === 1 && !!keySets[idx]?.has(key) && keySets.filter(Boolean).length > 1;
  };

  const reference = `${chapterTitle(entry, pick.chapter, pick.book)}:${pick.verse}`;
  const ask = () => {
    const texts = english
      .filter((e) => e.found?.text)
      .map((e) => ({ abbr: e.v?.abbr ?? e.id, name: e.v?.name ?? e.id, language: "English", text: e.found!.text! }));
    if (!texts.length) return;
    askAboutVerse({ reference, at: { work: "bible", book: pick.book, chapter: pick.chapter, verse: pick.verse }, texts });
    void sendAi(
      `Why do these English translations of ${reference} differ? Point to the words that change and explain, from the original ${original === "hebrew" ? "Hebrew" : "Greek"}, what each translation was trying to bring out.`,
    );
  };

  const orig = getVersion(original);
  const origFound = verseOf(original);
  const interWords = inter?.key === interKey && inter.data ? inter.data[pick.verse] : undefined;
  const titleWords = pick.verse === "1" && inter?.key === interKey && inter.data ? inter.data["0"] : undefined;
  const hebrew = testament === "ot";
  const chapters = entry?.chapters ?? 1;
  const groups = useMemo(() => {
    const g: { name: string; items: typeof books }[] = [];
    for (const b of books) {
      const last = g[g.length - 1];
      if (last && last.name === b.collection.name) last.items.push(b);
      else g.push({ name: b.collection.name, items: [b] });
    }
    return g;
  }, [books]);

  const sel = "min-h-10 rounded-lg border border-line bg-raised px-2 text-sm text-ink";
  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-muted hover:text-accent">
            ← Study lab
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-ink">Translation lab</h1>
          <p className="text-muted">
            One verse, five English translations, side by side. Pick one to compare against and the words the others put
            differently light up. Underneath: the words the writers first wrote, one by one, so you can see where the
            choices come from.
          </p>
        </header>

        {/* the verse */}
        <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Book
              <select
                className={sel}
                value={pick.book}
                onChange={(e) => choose({ book: e.target.value, chapter: 1, verse: "1" })}
              >
                {groups.map((g) => (
                  <optgroup key={g.name} label={g.name}>
                    {g.items.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Chapter
              <select className={sel} value={pick.chapter} onChange={(e) => choose({ ...pick, chapter: Number(e.target.value), verse: "1" })}>
                {Array.from({ length: chapters }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Verse
              <select className={sel} value={pick.verse} onChange={(e) => choose({ ...pick, verse: e.target.value })}>
                {verseList.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s) => {
              const label = `${chapterTitle(findBook("bible", s.book), s.chapter, s.book)}:${s.verse}`;
              const on = s.book === pick.book && s.chapter === pick.chapter && s.verse === pick.verse;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => choose(s)}
                  className={`min-h-9 rounded-full border px-3 text-xs ${on ? "border-accent bg-accent text-accent-ink" : "border-line text-ink hover:bg-raised"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* English */}
        <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl font-semibold text-ink">{reference}</h2>
            <a href={readHref({ work: "bible", book: pick.book, chapter: pick.chapter }, ENGLISH, pick.verse)} className="text-xs text-accent hover:underline">
              Read the chapter
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>Compare with</span>
            {ENGLISH.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={base === id}
                onClick={() => choose(pick, id)}
                className={`min-h-9 rounded-lg border px-2.5 font-medium ${base === id ? "border-accent bg-accent text-accent-ink" : "border-line text-ink hover:bg-raised"}`}
              >
                {getVersion(id)?.abbr ?? id}
              </button>
            ))}
            <label className="ml-auto flex min-h-9 items-center gap-1.5">
              <input type="checkbox" checked={marks} onChange={(e) => setMarks(e.target.checked)} /> Show differences
            </label>
          </div>
          {marks && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span>
                <span className="rounded bg-accent-soft px-1 text-ink">worded differently</span>
              </span>
              <span>
                <span className="rounded px-1 text-ink ring-1 ring-accent">added here</span>
              </span>
              <span>
left out: {getVersion(base)?.abbr} words listed under a verse
              </span>
              <span>
                <span className="text-ink underline decoration-accent decoration-dotted decoration-2 underline-offset-4">only in this one</span> of the five
              </span>
            </p>
          )}
          <ul className="space-y-3">
            {english.map((e, idx) => {
              const isBase = e.id === base;
              const f = e.found;
              const d = marks && !isBase && f?.text && baseText ? diffWords(baseText, f.text) : null;
              return (
                <li key={e.id} className={`space-y-1 rounded-xl border p-3 ${isBase ? "border-accent bg-raised" : "border-line"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                    <span className="font-semibold text-ink">
                      {e.v?.abbr ?? e.id} <span className="font-normal text-muted">{e.v?.name}</span>
                    </span>
                    {isBase ? (
                      <span className="text-accent">the one compared against</span>
                    ) : d ? (
                      <span className="text-faint">
                        {Math.round(d.shared * 100)}% the same words as {getVersion(base)?.abbr}
                      </span>
                    ) : null}
                  </div>
                  {f === undefined ? (
                    <Loading />
                  ) : f.text === null ? (
                    <p className="text-sm italic text-muted">{f.note}</p>
                  ) : (
                    <>
                      <p lang="en" className="font-serif text-lg leading-relaxed text-ink">
                        {!marks ? f.text : d ? <Diffed parts={d.parts} unique={uniqueFor(idx)} /> : <Plain text={f.text} unique={uniqueFor(idx)} />}
                      </p>
                      {d && d.parts.some((p) => p.kind === "dropped") && (
                        <p className="text-xs text-muted">
                          Leaves out these {getVersion(base)?.abbr} words:{" "}
                          {d.parts
                            .flatMap((p) => (p.kind === "dropped" ? [p.words.join(" ")] : []))
                            .map((w, k) => (
                              <span key={k}>
                                {k > 0 && " · "}
                                <del className="text-faint">{w}</del>
                              </span>
                            ))}
                        </p>
                      )}
                      {f.note && <p className="text-xs text-faint">{f.note}</p>}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {marks && !baseText && english.find((e) => e.id === base)?.found && (
            <p className="text-xs text-muted">{getVersion(base)?.abbr} doesn&rsquo;t have this verse, so pick another to compare against.</p>
          )}
          <button
            type="button"
            onClick={ask}
            disabled={!english.some((e) => e.found?.text)}
            className="min-h-10 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-50"
          >
            ✦ Ask AI why these differ
          </button>
        </section>

        {/* the original */}
        <section className="space-y-2 rounded-2xl border border-line bg-panel p-4">
          <h2 className="font-serif text-xl font-semibold text-ink">
            {testament === "ot" ? "The original (Hebrew and Aramaic)" : testament === "nt" ? "The Greek" : "The Greek (Septuagint)"}
          </h2>
          <p className="text-xs text-muted">{orig?.name}</p>
          {origFound === undefined ? (
            <Loading />
          ) : origFound.text === null ? (
            <p className="text-sm italic text-muted">{origFound.note}</p>
          ) : (
            <>
              <p lang={orig?.language} dir={orig?.dir} className="text-2xl leading-loose text-ink" style={fontFor(orig?.language ?? "")}>
                {origFound.text}
              </p>
              {origFound.note && <p className="text-xs text-faint">{origFound.note}</p>}
            </>
          )}
          <details
            className="rounded-xl border border-line p-3"
            onToggle={(e) => {
              setOthersOpen((e.currentTarget as HTMLDetailsElement).open); // fetch the other languages only while open
            }}
          >
            <summary className="cursor-pointer text-sm font-medium text-ink">Other languages ({others.length})</summary>
            <ul className="mt-3 space-y-3">
              {others.map((id) => {
                const v = getVersion(id);
                const f = othersOpen ? verseOf(id) : undefined;
                const lang = v?.language ?? "";
                return (
                  <li key={id} className="space-y-1">
                    <p className="text-xs text-muted">
                      <span className="font-semibold text-ink">{v?.abbr ?? id}</span> {v?.name} · {getLanguage(lang).name}
                    </p>
                    {f === undefined ? (
                      <Loading />
                    ) : f.text === null ? (
                      <p className="text-sm italic text-muted">{f.note}</p>
                    ) : (
                      <>
                        <p lang={lang} dir={v?.dir} className="font-serif text-base leading-relaxed text-ink" style={fontFor(lang)}>
                          {f.text}
                        </p>
                        {f.note && <p className="text-xs text-faint">{f.note}</p>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        </section>

        {/* word by word */}
        <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
          <h2 className="font-serif text-xl font-semibold text-ink">Word by word</h2>
          {!hasInter ? (
            <p className="text-sm text-muted">The word-by-word view covers the Old Testament (Hebrew) and the New Testament (Greek), not the Apocrypha.</p>
          ) : inter?.key !== interKey ? (
            <Loading />
          ) : !inter.data ? (
            <p className="text-sm text-muted">Couldn&rsquo;t load the words for this chapter. Check the connection and pick the verse again.</p>
          ) : !interWords && !titleWords ? (
            <p className="text-sm text-muted">No original words are listed for this verse (a few verses are numbered differently in the original).</p>
          ) : (
            <>
              <p className="text-xs text-muted">
                {hebrew ? "Hebrew reads right to left. " : ""}Each word with its sound and a plain English meaning: where the
                meaning has room in it, the translations choose differently.
              </p>
              {titleWords && (
                <WordRow words={titleWords} hebrew={hebrew} label="The psalm's title (part of verse 1 in the English here)" />
              )}
              {interWords && <WordRow words={interWords} hebrew={hebrew} label={titleWords ? "Then the verse" : undefined} />}
            </>
          )}
          <p className="text-xs text-faint">
            Words, sounds and meanings: STEP Bible (Tyndale House, Cambridge), licensed{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener" className="underline">
              CC BY 4.0
            </a>
            .
          </p>
        </section>

        <footer className="space-y-1 text-xs text-faint">
          <p>
            The translations are public domain and shown exactly as written; only the marks are added. Hebrew: Westminster
            Leningrad Codex. Greek: Textus Receptus (New Testament) and the Septuagint (Old Testament).
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

function WordRow({ words, hebrew, label }: { words: Word[]; hebrew: boolean; label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs font-medium text-muted">{label}</p>}
      <ol dir={hebrew ? "rtl" : "ltr"} className="flex flex-wrap gap-1.5">
        {words.map((w, i) => (
          <li key={i} className="flex min-w-16 flex-col items-center rounded-lg border border-line bg-raised px-2 py-1.5 text-center">
            <span lang={hebrew ? "he" : "grc"} dir={hebrew ? "rtl" : "ltr"} className="text-xl leading-snug text-ink" style={fontFor(hebrew ? "he" : "el")}>
              {w[0]}
            </span>
            <span dir="ltr" className="text-[11px] italic text-faint">
              {w[1]}
            </span>
            <span dir="ltr" className="text-xs text-muted">
              {w[2]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
