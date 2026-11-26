"use client";
/**
 * Literary shape (study lab, hub 7a62bb28): the hidden structure of passages, from curated examples in
 * src/lib/literary-shape.ts. Acrostics show the Hebrew (WLC) exactly as written, with each line's first letter read
 * from the text and set large beside it, and the KJV below; lines that break the pattern are marked. Parallel lines
 * show the KJV verse cut where its lines turn. Mirrored stories show an indented A B C … C' B' A' outline with links
 * to the reader. The chosen acrostic is kept on this device.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getVersion, readHref } from "@/lib/catalog";
import { fetchBook } from "@/lib/chapter-store";
import {
  ACROSTICS,
  CHIASMS,
  CHIASM_RETURN,
  KIND_NAME,
  PARALLELS,
  cutAtWords,
  firstLetter,
  letterInfo,
  refOf,
  splitLines,
  type Acrostic,
  type ChiasmLine,
  type Parallel,
} from "@/lib/literary-shape";

const STORE = "va-literary-shape";
const NAMES: Record<string, string> = { gen: "Genesis", psa: "Psalm", pro: "Proverbs", isa: "Isaiah", lam: "Lamentations", mrk: "Mark" };
const HEBREW_FONT = { fontFamily: 'var(--font-hebrew), "SBL Hebrew", "Ezra SIL", serif' };

type Verse = { v: string; t: string };
type Texts = { he: Verse[]; en: Verse[] };

/** One chapter of a version, or null while loading / on error. */
async function chapterOf(version: string, book: string, chapter: number): Promise<Verse[]> {
  const b = await fetchBook("bible", version, book);
  return (b.chapters[String(chapter)]?.verses ?? []) as Verse[];
}

const link = (l: { book: string; chapter: number; verse: number }) => readHref({ work: "bible", book: l.book, chapter: l.chapter }, ["kjv", "hebrew"], String(l.verse));

export function LiteraryShape() {
  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <Link href="/study-lab" className="text-sm text-accent hover:underline">
          ← Study lab
        </Link>
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Study lab</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">Literary shape</h1>
          <p className="text-muted">
            Many Bible passages are built with a pattern you can only see once it is pointed out: poems that walk through the
            alphabet, lines that echo each other, and stories that fold in the middle like a mirror. Here are some of the
            clearest examples, checked against the texts on this site.
          </p>
          <nav className="flex flex-wrap gap-2 pt-1 text-sm">
            {[
              ["#acrostics", "Acrostics"],
              ["#parallel", "Parallel lines"],
              ["#mirrored", "Mirrored stories"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full border border-line bg-panel px-3 py-1 text-ink hover:bg-raised">
                {label}
              </a>
            ))}
          </nav>
        </header>
        <Acrostics />
        <Parallels />
        <Mirrored />
        <footer className="space-y-1 border-t border-line pt-4 text-xs text-faint">
          <p>Hebrew: {getVersion("hebrew")?.attribution ?? "Westminster Leningrad Codex (WLC), public domain."}</p>
          <p>English: {getVersion("kjv")?.attribution ?? "King James Version, public domain."}</p>
          <p>Verse numbers follow the English Bible. In Hebrew Bibles a psalm&apos;s heading is often its own verse 1, so the numbers there can be one higher.</p>
        </footer>
      </div>
    </main>
  );
}

/* ---------------- acrostics ---------------- */

function Acrostics() {
  const [id, setId] = useState(ACROSTICS[0].id);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring the saved choice once, after hydration
      if (saved && ACROSTICS.some((a) => a.id === saved)) setId(saved);
    } catch {
      /* (no storage here: start at Psalm 119) */
    }
  }, []);
  const choose = (next: string) => {
    setId(next);
    try {
      localStorage.setItem(STORE, next);
    } catch {}
  };
  const a = ACROSTICS.find((x) => x.id === id) ?? ACROSTICS[0];

  return (
    <section id="acrostics" className="scroll-mt-4 space-y-4 rounded-2xl border border-line bg-panel p-4">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-semibold text-ink">Acrostics: poems from aleph to tav</h2>
        <p className="text-sm text-muted">
          In an acrostic each verse, or each line, starts with the next letter of the Hebrew alphabet, all 22 in order. The
          pattern is lost in translation, so here the Hebrew comes first, with its first letter set large beside it.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Acrostic passages">
        {ACROSTICS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === a.id}
            onClick={() => choose(x.id)}
            className={`rounded-full border px-3 py-1 text-sm ${x.id === a.id ? "border-accent bg-accent text-accent-ink" : "border-line bg-raised text-ink hover:bg-paper"}`}
          >
            {x.title}
          </button>
        ))}
      </div>
      <AcrosticView key={a.id} a={a} />
    </section>
  );
}

type Line = { v: string; part: string; head: string; n: number; char: string; name: string; off: boolean; groupStart: boolean };

function linesOf(a: Acrostic, he: Verse[]): Line[] {
  const out: Line[] = [];
  let prev = 0;
  let top = 0; // the highest letter so far
  const inRange = he.filter((x) => (!a.from || +x.v >= a.from) && (!a.to || +x.v <= a.to));
  inRange.forEach((x, vi) => {
    const { head, parts } = cutAtWords(x.t, a.starts?.[x.v] ?? [0]);
    parts.forEach((part, pi) => {
      const info = letterInfo(firstLetter(part));
      const n = info?.n ?? 0;
      const groupStart = a.group ? vi % a.group === 0 && pi === 0 : false;
      const expected = a.group && !groupStart ? prev : top + 1;
      out.push({ v: x.v, part, head: pi === 0 ? head : "", n, char: info?.char ?? "?", name: info?.name ?? "", off: n !== expected, groupStart });
      prev = n;
      top = Math.max(top, n);
    });
  });
  return out;
}

function AcrosticView({ a }: { a: Acrostic }) {
  const [texts, setTexts] = useState<Texts | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([chapterOf("hebrew", a.book, a.chapter), chapterOf("kjv", a.book, a.chapter)])
      .then(([he, en]) => live && setTexts({ he, en }))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [a.book, a.chapter]);

  const ref = `${NAMES[a.book]} ${a.chapter}`;
  if (failed) return <p className="text-sm text-muted">The text didn&apos;t load. Check your connection and try again.</p>;
  if (!texts) return <p className="text-sm text-faint">Loading {ref}…</p>;

  const lines = linesOf(a, texts.he);
  const english = new Map(texts.en.map((x) => [x.v, x.t]));
  const strip = lines.filter((l, i) => !a.group || l.groupStart || i === 0);
  const offCount = lines.filter((l) => l.off).length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-ink">{a.about}</p>
        {a.irregular && (
          <p className="rounded-xl border border-line bg-raised p-3 text-sm text-muted">
            <span className="font-semibold text-ink">Where the pattern bends: </span>
            {a.irregular}
          </p>
        )}
      </div>
      {/* the whole pattern at a glance, right to left as Hebrew reads */}
      <div className="space-y-1">
        <p className="text-xs text-faint">
          The first letters in order{a.group ? ` (one for each group of ${a.group} verses)` : ""}, read right to left
          {offCount ? ". Letters that break the pattern are marked." : "."}
        </p>
        <div dir="rtl" lang="he" className="flex flex-wrap gap-1">
          {strip.map((l, i) => (
            <span
              key={i}
              title={`${l.name}, verse ${l.v}`}
              style={HEBREW_FONT}
              className={`flex h-8 w-8 items-center justify-center rounded-md border text-lg ${l.off ? "border-accent bg-accent-soft text-accent" : "border-line bg-paper text-ink"}`}
            >
              {l.char}
            </span>
          ))}
        </div>
      </div>
      <ol className="space-y-2">
        {groupByVerse(lines).map((g) => (
          <li key={g.v} className="space-y-1">
            {a.group && g.lines[0].groupStart && (
              <h3 className="pt-3 font-serif text-lg font-semibold text-ink">
                <span style={HEBREW_FONT} lang="he">
                  {g.lines[0].char}
                </span>{" "}
                {g.lines[0].name}
                <span className="ms-2 text-sm font-normal text-faint">
                  verses {g.v}–{Number(g.v) + a.group - 1}
                </span>
              </h3>
            )}
            <div className="rounded-xl border border-line bg-paper p-3">
              {g.lines.map((l, i) => (
                <div key={i} dir="rtl" className="flex items-start gap-3 py-1">
                  <div className="w-14 shrink-0 text-center" dir="ltr">
                    <div style={HEBREW_FONT} lang="he" className={`text-4xl leading-tight ${l.off ? "text-accent" : "text-ink"}`}>
                      {l.char}
                    </div>
                    <div className="text-xs text-muted">{l.name}</div>
                    {l.off && <div className="text-[10px] uppercase tracking-wide text-accent">off pattern</div>}
                  </div>
                  <p lang="he" style={HEBREW_FONT} className="min-w-0 flex-1 text-xl leading-loose text-ink">
                    {l.head && <span className="text-faint">{l.head}</span>}
                    {l.part}
                  </p>
                </div>
              ))}
              <p className="mt-1 flex gap-2 border-t border-line pt-2 text-sm text-muted">
                <a href={link({ book: a.book, chapter: a.chapter, verse: Number(g.v) })} className="shrink-0 tabular-nums text-accent hover:underline">
                  {a.chapter}:{g.v}
                </a>
                <span>{english.get(g.v) ?? ""}</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-faint">
        Faint Hebrew at the start of a verse is a heading or opening word that stands outside the pattern. The KJV is shown for
        meaning only; its words don&apos;t follow the alphabet.
      </p>
    </div>
  );
}

function groupByVerse(lines: Line[]): { v: string; lines: Line[] }[] {
  const out: { v: string; lines: Line[] }[] = [];
  for (const l of lines) {
    const last = out.length ? out[out.length - 1] : null;
    if (last && last.v === l.v) last.lines.push(l);
    else out.push({ v: l.v, lines: [l] });
  }
  return out;
}

/* ---------------- parallel lines ---------------- */

function Parallels() {
  const [kjv, setKjv] = useState<Record<string, Verse[]> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const keys = Array.from(new Set(PARALLELS.map((p) => `${p.book}/${p.chapter}`)));
    Promise.all(keys.map((k) => chapterOf("kjv", k.split("/")[0], Number(k.split("/")[1])).then((vs) => [k, vs] as const)))
      .then((pairs) => {
        if (!live) return;
        const m: Record<string, Verse[]> = {};
        for (const [k, vs] of pairs) m[k] = vs;
        setKjv(m);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="parallel" className="scroll-mt-4 space-y-4 rounded-2xl border border-line bg-panel p-4">
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">Parallel lines</h2>
        <p className="text-sm text-muted">
          Hebrew poetry rhymes ideas rather than sounds: a line is followed by another that answers it. Because the pattern is in
          the meaning, it survives translation. Robert Lowth&apos;s classic scheme (1753), since refined by later scholars, names three main kinds:
        </p>
        <ul className="space-y-1 text-sm text-muted">
          {(Object.keys(KIND_NAME) as (keyof typeof KIND_NAME)[]).map((k) => (
            <li key={k}>
              <span className="font-semibold text-ink">{KIND_NAME[k].name}:</span> {KIND_NAME[k].short}.
            </li>
          ))}
        </ul>
      </div>
      {failed ? (
        <p className="text-sm text-muted">Couldn&apos;t load the text; try again.</p>
      ) : !kjv ? (
        <p className="text-sm text-faint">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {PARALLELS.map((p) => (
            <ParallelCard key={p.ref} p={p} verses={kjv[`${p.book}/${p.chapter}`] ?? []} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ParallelCard({ p, verses }: { p: Parallel; verses: Verse[] }) {
  return (
    <li className="space-y-2 rounded-xl border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href={link({ book: p.book, chapter: p.chapter, verse: p.verses[0] })} className="font-serif text-lg font-semibold text-accent hover:underline">
          {p.ref}
        </a>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{KIND_NAME[p.kind].name}</span>
      </div>
      {p.verses.map((n, i) => {
        const text = verses.find((x) => Number(x.v) === n)?.t ?? "";
        const split = splitLines(text, p.cuts[i]);
        return (
          <div key={n} className="font-serif text-ink">
            {split?.head && <p className="text-sm text-faint">{split.head}</p>}
            {split ? (
              split.lines.map((line, j) => (
                <p key={j} className={`flex gap-2 py-0.5 ${j % 2 ? "ps-6" : ""}`}>
                  <span className="w-4 shrink-0 font-sans text-xs leading-6 text-faint">{String.fromCharCode(97 + j)}</span>
                  <span>{line}</span>
                </p>
              ))
            ) : (
              <p>{text}</p>
            )}
          </div>
        );
      })}
      <p className="text-sm text-muted">{p.note}</p>
    </li>
  );
}

/* ---------------- mirrored stories ---------------- */

const LETTERS = "ABCDEFGHIJKLMNOP";

function Mirrored() {
  return (
    <section id="mirrored" className="scroll-mt-4 space-y-4 rounded-2xl border border-line bg-panel p-4">
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">Mirrored stories (chiasm)</h2>
        <p className="text-sm text-muted">
          Some passages are built like a mirror: A, B, C, then a turning point, then C&apos;, B&apos;, A&apos;, where each
          part on the way out echoes its partner on the way in. The pattern is named chiasm, after the Greek letter chi (X), whose
          strokes cross.
        </p>
        <p className="rounded-xl border border-line bg-raised p-3 text-sm text-muted">
          <span className="font-semibold text-ink">Please note: </span>
          these outlines are scholarly readings, not part of the text. Scholars agree that chiasm was used in ancient writing,
          but they disagree about how many passages were built this way on purpose, and the same passage is often outlined in
          different ways.
        </p>
      </div>
      {CHIASMS.map((c) => {
        const back = CHIASM_RETURN[c.id] ?? [];
        const depth = c.lines.length;
        return (
          <article key={c.id} className="space-y-3 rounded-xl border border-line bg-paper p-3">
            <h3 className="font-serif text-xl font-semibold text-ink">{c.title}</h3>
            <p className="text-sm text-muted">{c.about}</p>
            <ol className="space-y-1">
              {c.lines.map((l, i) => (
                <ChiasmRow key={`in${i}`} l={l} mark={LETTERS[i]} indent={i} />
              ))}
              {c.centre && <ChiasmRow l={c.centre} mark="X" indent={depth} centre />}
              {back.map((l, i) => {
                const level = depth - 1 - i;
                return <ChiasmRow key={`out${i}`} l={l} mark={`${LETTERS[level]}'`} indent={level} />;
              })}
            </ol>
            <p className="text-xs text-faint">{c.source}</p>
          </article>
        );
      })}
      <p className="text-xs text-faint">Quotations are from the King James Version. Tap a reference to read it in context.</p>
    </section>
  );
}

function ChiasmRow({ l, mark, indent, centre }: { l: ChiasmLine; mark: string; indent: number; centre?: boolean }) {
  // indent shrinks on phones so deep outlines still fit 360 px
  const pad = { paddingInlineStart: `min(${indent * 1.25}rem, ${indent * 4}vw)` };
  return (
    <li style={pad}>
      <div className={`flex gap-2 rounded-lg px-2 py-1 ${centre ? "border border-accent bg-accent-soft" : ""}`}>
        <span className={`w-6 shrink-0 font-mono text-sm font-semibold text-accent`}>{mark}</span>
        <span className="min-w-0 text-sm">
          {l.label && <span className="font-medium text-ink">{l.label}</span>}
          {l.quote && (
            <span className="font-serif italic text-muted">
              {l.label ? " " : ""}“{l.quote}”
            </span>
          )}{" "}
          <a href={link(l)} className="whitespace-nowrap text-xs text-accent hover:underline">
            {refOf(NAMES, l)}
          </a>
        </span>
      </div>
    </li>
  );
}
