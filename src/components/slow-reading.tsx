"use client";
/**
 * Slow reading (study lab, hub 7a62bb28): one short passage, read slowly several times, in four movements: Read (one
 * verse at a time, large), Reflect (read again and tap a word or phrase that stands out), Respond (a gentle prompt and
 * a private journal box) and Rest (a quiet minute with only the chosen phrase on screen). In the spirit of lectio
 * divina and the contemplative reading of many traditions, written to fit any of them, or none. Each movement can
 * have a timer that ends with a soft chime (none with the Quran). No streaks, no scores. The journal, the last
 * passage and the settings are kept on this device only. Texts are shown exactly as written.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { booksOfWork, chapterTitle, findBook, getVersion, readHref } from "@/lib/catalog";
import { fetchBook, type BookFile } from "@/lib/chapter-store";
import { getLanguage } from "@/lib/languages";
import { updateSettings } from "@/lib/settings";
import { versionsInOrder, workGroups } from "@/lib/speed-reader";
import {
  addSitting,
  clockTime,
  DEFAULT_TIMERS,
  JOURNAL_KEY,
  journalText,
  localDate,
  longDate,
  MAX_VERSES,
  MOVEMENTS,
  parseJournal,
  passageTitle,
  phraseOf,
  piecesOf,
  PREFS_KEY,
  PROMPTS,
  quietWork,
  samePassage,
  openChime,
  SUGGESTIONS,
  tapWord,
  TIMER_CHOICES,
  verseNumbers,
  versesIn,
  type Chime,
  type Chosen,
  type Entry,
  type Movement,
  type Passage,
  type Timers,
  type Verse,
} from "@/lib/slow-reading";

type Stage = "choose" | Movement | "done";

function fontFor(lang: string): CSSProperties | undefined {
  if (lang === "he") return { fontFamily: 'var(--font-hebrew), "SBL Hebrew", "Ezra SIL", serif' };
  if (lang === "ar") return { fontFamily: 'var(--font-arabic), "Noto Naskh Arabic", serif' };
  if (lang === "el") return { fontFamily: "var(--font-greek), var(--font-serif)" };
  return undefined;
}

/** A passage the catalog can still serve (a kept one may name a version that has since moved). */
function validPassage(p: Partial<Passage> | undefined): Passage | null {
  if (!p || typeof p.work !== "string" || typeof p.version !== "string" || typeof p.book !== "string") return null;
  const v = getVersion(p.version);
  const b = findBook(p.work, p.book);
  if (!v || v.work !== p.work || !b) return null;
  const chapter = typeof p.chapter === "number" && p.chapter >= 1 && p.chapter <= (b.chapters ?? 1) ? Math.floor(p.chapter) : 1;
  const from = typeof p.from === "number" && p.from >= 0 ? Math.floor(p.from) : 1;
  const to = typeof p.to === "number" && p.to >= from ? Math.min(Math.floor(p.to), from + MAX_VERSES - 1) : from;
  return { work: p.work, version: p.version, book: p.book, chapter, from, to };
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* ---------------- the gentle timer ---------------- */

function Timer({ minutes, onMinutes, quiet }: { minutes: number; onMinutes: (m: number) => void; quiet: boolean }) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [total, setTotal] = useState(0);
  const chime = useRef<Chime | null>(null);
  useEffect(() => () => chime.current?.close(), []);
  useEffect(() => {
    if (endAt === null) return;
    // the wall clock decides; when the page comes back (a phone unlocked), check again at once
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 500);
    const seen = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", seen);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", seen);
    };
  }, [endAt]);
  const running = endAt !== null && now < endAt;
  const done = endAt !== null && now >= endAt;
  // time is up: the chime rings once (it stays silent if the audio can't resume)
  useEffect(() => {
    if (done) chime.current?.ring();
  }, [done]);
  const start = () => {
    chime.current?.close();
    const t = Date.now();
    setNow(t);
    setTotal(minutes * 60000);
    setEndAt(t + minutes * 60000);
    // the chime is made now, during the tap, so Safari lets it sound when the time is up
    chime.current = quiet ? null : openChime();
  };
  const stop = () => {
    chime.current?.close();
    chime.current = null;
    setEndAt(null);
  };
  if (endAt !== null) {
    const left = Math.max(0, endAt - now);
    return (
      <div className="space-y-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full bg-accent" style={{ width: `${total ? Math.min(100, ((total - left) / total) * 100) : 100}%`, transition: "width 0.5s linear" }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          {running && <span className="tabular-nums text-muted">{fmt(left)}</span>}
          {/* only the end is announced, not every second */}
          <span role="status" className={done ? "text-accent" : "sr-only"}>
            {done ? "Time is up. Go on whenever you are ready." : ""}
          </span>
          <button type="button" onClick={stop} className="min-h-9 rounded-lg border border-line px-3 text-xs text-muted hover:bg-raised">
            {done ? "Clear" : "Stop the timer"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>Timer</span>
      <div role="group" aria-label="Timer length" className="inline-flex rounded-lg border border-line p-0.5">
        {TIMER_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={minutes === m}
            onClick={() => onMinutes(m)}
            className={`min-h-8 min-w-8 rounded-md px-2 ${minutes === m ? "bg-accent text-accent-ink" : "hover:text-ink"}`}
          >
            {m === 0 ? "Off" : `${m}`}
          </button>
        ))}
      </div>
      {minutes > 0 && (
        <button type="button" onClick={start} className="min-h-9 rounded-lg border border-line px-3 text-ink hover:bg-raised">
          Start {minutes} minute{minutes === 1 ? "" : "s"}
        </button>
      )}
      {minutes > 0 && quiet && <span className="w-full text-faint">With the Quran the timer ends in silence: no chime.</span>}
    </div>
  );
}

/* ---------------- the page ---------------- */

export function SlowReading() {
  const groups = useMemo(() => workGroups(), []);
  const [passage, setPassage] = useState<Passage>(SUGGESTIONS[0].passage);
  const [stage, setStage] = useState<Stage>("choose");
  const [load, setLoad] = useState<{ key: string; book?: BookFile; error?: string } | null>(null);
  const [readIdx, setReadIdx] = useState(0);
  const [sel, setSel] = useState<Chosen | null>(null);
  const [promptIdx, setPromptIdx] = useState(0);
  const [note, setNote] = useState("");
  const [timers, setTimers] = useState<Timers>(DEFAULT_TIMERS);
  const [calm, setCalm] = useState(false);
  const [journal, setJournal] = useState<Entry[]>([]);
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [restored, setRestored] = useState(false);
  const main = useRef<HTMLElement>(null);

  const bookKey = `${passage.work}/${passage.version}/${passage.book}`;
  const version = getVersion(passage.version);
  const lang = version?.language ?? "en";
  const dir = version?.dir ?? "ltr";
  const quiet = quietWork(passage.work);

  // The journal and settings kept on this device, after hydration.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's journal is only readable after hydration
      setJournal(parseJournal(localStorage.getItem(JOURNAL_KEY)));
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { timers?: Partial<Timers>; calm?: boolean; passage?: Partial<Passage> };
        if (s.timers) {
          const t = { ...DEFAULT_TIMERS };
          for (const m of MOVEMENTS) {
            const v = s.timers[m.id];
            if (typeof v === "number" && TIMER_CHOICES.includes(v)) t[m.id] = v;
          }
          setTimers(t);
        }
        if (typeof s.calm === "boolean") setCalm(s.calm);
        const p = validPassage(s.passage);
        if (p) {
          setPassage(p);
          setCustom(!SUGGESTIONS.some((x) => samePassage(x.passage, p)));
        }
      }
    } catch {
      /* (no storage here: start fresh) */
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ timers, calm, passage }));
    } catch {
      /* (private mode: nothing kept) */
    }
  }, [restored, timers, calm, passage]);

  // The book's text (each book file is fetched once and shared with the reader's cache).
  useEffect(() => {
    let live = true;
    const [work, ver, book] = bookKey.split("/");
    fetchBook(work, ver, book)
      .then((b) => live && setLoad({ key: bookKey, book: b }))
      .catch((e: unknown) => live && setLoad({ key: bookKey, error: String((e as Error)?.message ?? e) }));
    return () => {
      live = false;
    };
  }, [bookKey]);

  const ready = load?.key === bookKey ? load : null;
  const chapterVerses = useMemo<Verse[] | null>(
    () => (ready?.book ? (ready.book.chapters[String(passage.chapter)]?.verses ?? []) : null),
    [ready, passage.chapter],
  );
  const nums = useMemo(() => (chapterVerses ? verseNumbers(chapterVerses) : []), [chapterVerses]);
  // a range that isn't in this chapter (a new chapter picked): its first few verses instead
  const fixed: Passage =
    chapterVerses && nums.length && !nums.some((n) => n >= passage.from && n <= passage.to)
      ? { ...passage, from: nums[0], to: nums[Math.min(3, nums.length - 1)] }
      : passage;
  // and never past the chapter's last verse
  const cur: Passage = nums.length && fixed.to > nums[nums.length - 1] ? { ...fixed, to: Math.max(fixed.from, nums[nums.length - 1]) } : fixed;
  const verses = chapterVerses ? versesIn(chapterVerses, cur) : [];
  const title = passageTitle(cur, chapterVerses ?? undefined);
  const phrase = phraseOf(verses, sel);
  const textStyle = fontFor(lang);

  const saveJournal = (next: Entry[]) => {
    setJournal(next);
    try {
      localStorage.setItem(JOURNAL_KEY, JSON.stringify(next));
    } catch {
      /* (private mode: kept only while the page is open) */
    }
  };

  const go = (s: Stage) => {
    setStage(s);
    if (main.current) main.current.scrollTop = 0;
  };
  const begin = () => {
    setReadIdx(0);
    setSel(null);
    setNote("");
    // a different prompt each sitting, in turn
    setPromptIdx(journal.reduce((n, e) => n + e.sittings.length, 0) % PROMPTS.length);
    go("read");
  };
  const choose = (p: Passage) => {
    setPassage(p);
    setSel(null);
  };
  const finish = () => {
    const sitting = { time: new Date().toISOString(), phrase, prompt: note.trim() ? PROMPTS[promptIdx] : "", note: note.trim() };
    saveJournal(addSitting(journal, cur, title, sitting));
    go("done");
  };
  const exportJournal = () => {
    const blob = new Blob([journalText(journal)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `slow-reading-journal-${localDate()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const inSession = stage === "read" || stage === "reflect" || stage === "respond" || stage === "rest";
  // calm: the words larger, everything around them dimmed until touched
  const chrome = calm && inSession ? "opacity-50 transition-opacity hover:opacity-100 focus-within:opacity-100" : "";
  const timerFor = (m: Movement) => (
    <Timer key={`${m}-${passage.work}`} minutes={timers[m]} onMinutes={(n) => setTimers({ ...timers, [m]: n })} quiet={quiet} />
  );

  const toggles = (
    <span className="flex gap-2">
      <button
        type="button"
        aria-pressed={calm}
        onClick={() => setCalm(!calm)}
        title="Larger words, everything else dimmed"
        className={`min-h-9 rounded-lg border px-3 text-xs font-medium ${calm ? "border-accent bg-accent-soft text-ink" : "border-line text-ink hover:bg-raised"}`}
      >
        Calm
      </button>
      <button
        type="button"
        aria-label="Dark or light"
        title="Dark or light"
        onClick={() => {
          // (this page isn't inside the reader, which keeps the theme in step: so switch it here too)
          const dark = !document.documentElement.classList.contains("dark");
          document.documentElement.classList.toggle("dark", dark);
          updateSettings({ theme: dark ? "dark" : "light" });
        }}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-raised"
      >
        ◐
      </button>
    </span>
  );

  /* ---------- Rest: only the phrase on screen ---------- */
  if (stage === "rest") {
    return (
      <main ref={main} className="h-app overflow-y-auto bg-paper">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-8">
          <div className="flex flex-1 items-center justify-center py-10">
            {phrase ? (
              <p dir={dir} lang={lang} style={textStyle} className={`text-center font-serif leading-snug text-ink ${calm ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl"}`}>
                {phrase}
              </p>
            ) : (
              <p className="text-center font-serif text-2xl text-faint">Quiet</p>
            )}
          </div>
          <div className="space-y-3 opacity-40 transition-opacity hover:opacity-100 focus-within:opacity-100">
            {timerFor("rest")}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => go("respond")} className="text-xs text-muted hover:underline">
                ← Back
              </button>
              <button type="button" onClick={finish} className="min-h-10 rounded-lg border border-line px-4 text-sm text-ink hover:bg-raised">
                Finish
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const movement = MOVEMENTS.find((m) => m.id === stage);

  return (
    <main ref={main} className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className={`space-y-2 ${chrome}`}>
          <div className="flex items-center justify-between gap-2">
            <Link href="/study-lab" className="text-xs text-accent hover:underline">
              ← Study lab
            </Link>
            {toggles}
          </div>
          {!inSession && (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Slow reading</h1>
              <p className="text-muted">
                Choose one short passage and read it slowly, several times, in four quiet movements: read, reflect, respond and rest.
                Many traditions read this way (Christian lectio divina is one well-known form); here it is open to anyone, with any
                text.
              </p>
              <p className="text-xs text-faint">There is no score and nothing to keep up with. Take as long as you like.</p>
            </>
          )}
        </header>

        {/* ---------- choosing a passage ---------- */}
        {stage === "choose" && (
          <>
            <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
              <h2 className="font-serif text-xl font-semibold text-ink">Choose a passage</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => {
                  const on = !custom && samePassage(s.passage, passage);
                  return (
                    <li key={s.label}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setCustom(false);
                          choose(s.passage);
                        }}
                        className={`block min-h-11 w-full rounded-xl border px-3 py-2 text-start ${on ? "border-accent bg-accent-soft" : "border-line hover:bg-raised"}`}
                      >
                        <span className="block font-serif text-base text-ink">{s.label}</span>
                        <span className="block text-xs text-muted">{s.tradition}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" aria-expanded={custom} onClick={() => setCustom(!custom)} className="text-sm font-medium text-accent hover:underline">
                {custom ? "Hide these choices" : "Or choose any passage on the site"}
              </button>
              {custom && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-muted">
                    <span>Text</span>
                    <select
                      value={passage.work}
                      onChange={(e) => {
                        const work = e.target.value;
                        const v = versionsInOrder(work)[0];
                        const b = booksOfWork(work)[0];
                        if (v && b) choose({ work, version: v.id, book: b.id, chapter: 1, from: 1, to: 4 });
                      }}
                      className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
                    >
                      {groups.map((g) => (
                        <optgroup key={g.shelf} label={g.shelf}>
                          {g.works.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-muted">
                    <span>Version</span>
                    <select
                      value={passage.version}
                      onChange={(e) => choose({ ...cur, version: e.target.value })}
                      className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
                    >
                      {versionsInOrder(passage.work).map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.abbr}: {v.name} ({getLanguage(v.language).name})
                        </option>
                      ))}
                    </select>
                  </label>
                  {booksOfWork(passage.work).length > 1 && (
                    <label className="space-y-1 text-xs text-muted">
                      <span>Book</span>
                      <select
                        value={passage.book}
                        onChange={(e) => choose({ ...passage, book: e.target.value, chapter: 1, from: 1, to: 4 })}
                        className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
                      >
                        {booksOfWork(passage.work).map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="space-y-1 text-xs text-muted">
                    <span>Chapter</span>
                    <select
                      value={passage.chapter}
                      onChange={(e) => choose({ ...passage, chapter: Number(e.target.value), from: 1, to: 4 })}
                      className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
                    >
                      {Array.from({ length: findBook(passage.work, passage.book)?.chapters ?? 1 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {chapterTitle(findBook(passage.work, passage.book), n)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {nums.length > 1 && (
                    <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                      <label className="space-y-1 text-xs text-muted">
                        <span>From verse</span>
                        <select
                          value={cur.from}
                          onChange={(e) => {
                            const from = Number(e.target.value);
                            choose({ ...cur, from, to: Math.max(from, Math.min(cur.to, from + MAX_VERSES - 1)) });
                          }}
                          className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
                        >
                          {nums.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs text-muted">
                        <span>To verse</span>
                        <select
                          value={cur.to}
                          onChange={(e) => choose({ ...cur, to: Number(e.target.value) })}
                          className="min-h-11 w-full rounded-lg border border-line bg-raised px-2 text-sm text-ink"
                        >
                          {nums
                            .filter((n) => n >= cur.from && n < cur.from + MAX_VERSES)
                            .map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                        </select>
                      </label>
                      <p className="col-span-2 text-xs text-faint">Up to {MAX_VERSES} verses: a short passage is best for reading slowly.</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
                {version && <span className="text-xs text-faint">{version.name}</span>}
              </div>
              {!ready ? (
                <p className="text-sm text-faint">Loading…</p>
              ) : ready.error ? (
                <p className="text-sm text-muted">This text could not be loaded ({ready.error}). Try another passage.</p>
              ) : !verses.length ? (
                <p className="text-sm text-muted">This chapter has no verses in this version. Try another.</p>
              ) : (
                <div dir={dir} lang={lang} style={textStyle} className={`space-y-2 font-serif leading-relaxed text-ink ${calm ? "text-xl" : "text-lg"}`}>
                  {verses.map((v, i) => (
                    <p key={i}>
                      <sup className="me-1 text-xs text-faint">{v.n ?? v.v}</sup>
                      {v.t}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!verses.length}
                  onClick={begin}
                  className="min-h-11 rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink disabled:opacity-50"
                >
                  Begin slowly
                </button>
                <Link href={readHref({ work: cur.work, book: cur.book, chapter: cur.chapter }, [cur.version], String(cur.from))} className="text-xs text-accent hover:underline">
                  Read it in context →
                </Link>
              </div>
              <p className="text-xs text-faint">
                Each movement can have a timer of one to five minutes{quiet ? ", ending in silence" : ", ending with a soft chime"}. Calm, at the top, makes the words larger and
                dims everything else.
              </p>
            </section>
          </>
        )}

        {/* ---------- the movements ---------- */}
        {inSession && movement && (
          <>
            <nav aria-label="Movements" className={`flex flex-wrap items-center gap-1 text-sm ${chrome}`}>
              {MOVEMENTS.map((m, i) => (
                <span key={m.id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-faint">·</span>}
                  <button
                    type="button"
                    aria-current={stage === m.id ? "step" : undefined}
                    onClick={() => go(m.id)}
                    className={`min-h-9 rounded-md px-2 ${stage === m.id ? "font-semibold text-accent" : "text-muted hover:text-ink"}`}
                  >
                    {i + 1}. {m.name}
                  </button>
                </span>
              ))}
            </nav>
            <p className={`text-sm text-muted ${chrome}`}>
              <span className="font-serif text-ink">{title}</span> · {movement.lead}
            </p>

            {stage === "read" && verses[readIdx] && (
              <section className="space-y-4">
                <button
                  type="button"
                  onClick={() => (readIdx + 1 < verses.length ? setReadIdx(readIdx + 1) : go("reflect"))}
                  className="block min-h-[40vh] w-full rounded-2xl px-1 py-6 text-start"
                  aria-describedby="slow-read-hint"
                >
                  <span
                    key={readIdx}
                    dir={dir}
                    lang={lang}
                    style={textStyle}
                    className={`block font-serif leading-relaxed text-ink ${calm ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}
                  >
                    {verses[readIdx].t}
                  </span>
                </button>
                <div className={`flex flex-wrap items-center justify-between gap-2 text-xs text-faint ${chrome}`}>
                  <span id="slow-read-hint">
                    {readIdx + 1} of {verses.length} · {readIdx + 1 < verses.length ? "Tap the words to go on" : "Tap to read it again, slowly"}
                  </span>
                  {readIdx > 0 && (
                    <button type="button" onClick={() => setReadIdx(readIdx - 1)} className="text-muted hover:underline">
                      ← Back a line
                    </button>
                  )}
                </div>
                <div className={chrome}>{timerFor("read")}</div>
              </section>
            )}

            {stage === "reflect" && (
              <section className="space-y-4">
                <div dir={dir} lang={lang} style={textStyle} className={`space-y-4 font-serif leading-loose text-ink ${calm ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>
                  {verses.map((v, vi) => (
                    <p key={vi}>
                      {piecesOf(v.t).map((p, i) => {
                        const on = sel !== null && sel.verse === vi && i >= sel.a && i <= sel.b;
                        if (!p.word)
                          return (
                            <span key={i} className={on ? "bg-accent-soft" : undefined}>
                              {p.text}
                            </span>
                          );
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSel(tapWord(sel, vi, i))}
                            aria-pressed={on}
                            className={`inline rounded-sm ${on ? "bg-accent-soft text-ink" : "hover:bg-raised"}`}
                          >
                            {p.text}
                          </button>
                        );
                      })}
                    </p>
                  ))}
                </div>
                <div className={`space-y-3 ${chrome}`}>
                  <p className="text-xs text-faint">
                    Tap a word. Tap another word in the same line to make it a phrase. Tap the highlight to let it go.
                  </p>
                  {phrase && (
                    <p className="text-sm text-muted">
                      You chose:{" "}
                      <span dir={dir} lang={lang} style={textStyle} className="font-serif text-ink">
                        {phrase}
                      </span>
                    </p>
                  )}
                  {timerFor("reflect")}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => go("read")} className="text-xs text-muted hover:underline">
                      ← Read once more
                    </button>
                    <button type="button" onClick={() => go("respond")} className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
                      Go on to respond
                    </button>
                  </div>
                </div>
              </section>
            )}

            {stage === "respond" && (
              <section className="space-y-4">
                <div className="rounded-2xl border border-line bg-panel p-4">
                  {phrase ? (
                    <p dir={dir} lang={lang} style={textStyle} className={`font-serif leading-relaxed text-ink ${calm ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"}`}>
                      {phrase}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">
                      No word chosen this time, and that is fine. You can{" "}
                      <button type="button" onClick={() => go("reflect")} className="text-accent hover:underline">
                        go back and choose one
                      </button>
                      , or stay with the whole passage.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-lg italic text-ink">{PROMPTS[promptIdx]}</p>
                    <button type="button" onClick={() => setPromptIdx((promptIdx + 1) % PROMPTS.length)} className={`text-xs text-muted hover:underline ${chrome}`}>
                      Another prompt
                    </button>
                  </div>
                  <label className="block">
                    <span className="sr-only">Your journal</span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={calm ? 8 : 6}
                      placeholder="A few words, or none. Only you will see this."
                      className={`w-full rounded-xl border border-line bg-raised px-3 py-2 text-ink placeholder:text-faint ${calm ? "text-lg" : "text-base"}`}
                    />
                  </label>
                  <p className={`text-xs text-faint ${chrome}`}>Kept in your journal on this device only, when you finish.</p>
                </div>
                <div className={`space-y-3 ${chrome}`}>
                  {timerFor("respond")}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={finish} className="text-xs text-muted hover:underline">
                      End here and keep this
                    </button>
                    <button type="button" onClick={() => go("rest")} className="min-h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink">
                      Go on to rest
                    </button>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ---------- after a sitting ---------- */}
        {stage === "done" && (
          <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
            <h2 className="font-serif text-xl font-semibold text-ink">Thank you for reading slowly</h2>
            {phrase && (
              <p dir={dir} lang={lang} style={textStyle} className="font-serif text-lg text-ink">
                {phrase}
              </p>
            )}
            <p className="text-sm text-muted">This sitting with {title} is kept in your journal below, on this device only.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={begin} className="min-h-10 rounded-lg border border-line px-4 text-sm text-ink hover:bg-raised">
                Sit with it again
              </button>
              <button type="button" onClick={() => go("choose")} className="min-h-10 rounded-lg border border-line px-4 text-sm text-ink hover:bg-raised">
                Choose another passage
              </button>
            </div>
          </section>
        )}

        {/* ---------- the journal ---------- */}
        {!inSession && (
          <section className="space-y-3 rounded-2xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-xl font-semibold text-ink">Your journal</h2>
              {journal.length > 0 && (
                <button type="button" onClick={exportJournal} className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised">
                  Save as a text file
                </button>
              )}
            </div>
            <p className="text-xs text-faint">Your journal stays in this browser on this device: it is never sent anywhere. (Dark or light follows your site settings.)</p>
            {journal.length === 0 ? (
              <p className="text-sm text-muted">Nothing here yet. After a sitting, the phrase you chose and anything you wrote will be kept here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {journal.map((e) => {
                  const open = openEntry === e.id;
                  const phrases = e.sittings.map((s) => s.phrase).filter(Boolean);
                  return (
                    <li key={e.id} className="py-2">
                      <button type="button" aria-expanded={open} onClick={() => setOpenEntry(open ? null : e.id)} className="block w-full py-1 text-start">
                        <span className="block text-xs text-faint">{longDate(e.date)}</span>
                        <span className="block font-serif text-base text-ink">{e.title}</span>
                        {phrases.length > 0 && <span className="block truncate text-sm text-muted">{phrases.join(" · ")}</span>}
                      </button>
                      {open && (
                        <div className="mt-2 space-y-3 rounded-xl bg-raised p-3">
                          {e.sittings.map((s, i) => (
                            <div key={i} className="space-y-1 text-sm">
                              <p className="text-xs text-faint">{clockTime(s.time)}</p>
                              {s.phrase && <p className="font-serif text-base text-ink">{s.phrase}</p>}
                              {s.prompt && <p className="italic text-muted">{s.prompt}</p>}
                              {s.note && <p className="whitespace-pre-wrap text-ink">{s.note}</p>}
                              {!s.phrase && !s.note && <p className="text-faint">A quiet sitting, nothing written.</p>}
                            </div>
                          ))}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const p = validPassage(e.passage);
                                if (!p) return;
                                setCustom(!SUGGESTIONS.some((x) => samePassage(x.passage, p)));
                                choose(p);
                                go("choose");
                              }}
                              className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-panel"
                            >
                              Read this passage again
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Remove this day's entry from your journal? This can't be undone.")) {
                                  saveJournal(journal.filter((x) => x.id !== e.id));
                                  setOpenEntry(null);
                                }
                              }}
                              className="text-xs text-muted hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <footer className={`space-y-1 text-xs text-faint ${chrome}`}>
          {version && (
            <p>
              Text: {version.name} ({version.license}).{version.attribution ? ` ${version.attribution}` : ""}
            </p>
          )}
          <p>
            <Link href="/" className="text-accent hover:underline">
              Verses Across
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
