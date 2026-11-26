"use client";
/**
 * Study paths (hidden page /study-paths, part of the Study lab): guided four-week courses that read across
 * traditions. A path shows its weeks and days with ticks, a progress bar, "Start this path" (keeps the start date)
 * and "Today" (the first day not done yet). A day shows its readings (links into the reader), a short note on why
 * they sit together, one reflection question with a private answer box, and a "Done" tick. Each week has a folded
 * question for a study group. Everything you do here is kept only on this device (localStorage).
 * The course content is in src/lib/study-paths.ts.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ResolvedDay, ResolvedPath } from "@/lib/study-paths";

type PathState = { start?: string; done: Record<string, boolean>; notes: Record<string, string> };
type Saved = { open?: string; paths: Record<string, PathState> };

const KEY = "study-paths:v1";
const EMPTY: PathState = { done: {}, notes: {} };
const dayKey = (w: number, d: number) => `${w}-${d}`;

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      if (s && typeof s === "object" && s.paths) return s;
    }
  } catch {
    /* (private window or blocked storage: start fresh) */
  }
  return { paths: {} };
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* (not saved: the page still works for this visit) */
  }
}

const dayCount = (p: ResolvedPath) => p.weeks.reduce((n, w) => n + w.days.length, 0);
const doneCount = (p: ResolvedPath, st: PathState) =>
  p.weeks.reduce((n, w, wi) => n + w.days.filter((_, di) => st.done[dayKey(wi, di)]).length, 0);

/** The first day not yet done (or the last day when all are done). */
function firstOpen(p: ResolvedPath, st: PathState): { w: number; d: number } {
  for (let wi = 0; wi < p.weeks.length; wi++)
    for (let di = 0; di < p.weeks[wi].days.length; di++) if (!st.done[dayKey(wi, di)]) return { w: wi, d: di };
  const w = p.weeks.length - 1;
  return { w, d: p.weeks[w].days.length - 1 };
}

function niceDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted">
        {done} of {total} days done
      </p>
    </div>
  );
}

function Tick({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${
        on ? "border-accent bg-accent text-accent-ink" : "border-line text-faint hover:bg-raised"
      }`}
    >
      ✓
    </button>
  );
}

/* ---------------- one day ---------------- */

function DayView({
  path,
  w,
  d,
  st,
  onTick,
  onNote,
  go,
  back,
}: {
  path: ResolvedPath;
  w: number;
  d: number;
  st: PathState;
  onTick: () => void;
  onNote: (text: string) => void;
  go: (w: number, d: number) => void;
  back: () => void;
}) {
  const day: ResolvedDay = path.weeks[w].days[d];
  const k = dayKey(w, d);
  const done = !!st.done[k];
  const flat = path.weeks.flatMap((wk, wi) => wk.days.map((_, di) => ({ w: wi, d: di })));
  const i = flat.findIndex((x) => x.w === w && x.d === d);
  const prev = i > 0 ? flat[i - 1] : null;
  const next = i < flat.length - 1 ? flat[i + 1] : null;

  return (
    <article className="space-y-5">
      <button type="button" onClick={back} className="text-sm text-accent hover:underline">
        ← {path.title}
      </button>
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent">
          Week {w + 1}, day {d + 1} · {path.weeks[w].title}
        </p>
        <h2 className="font-serif text-2xl font-semibold text-ink">{day.title}</h2>
      </header>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Read</h3>
        <ul className="space-y-2">
          {day.readings.map((r) => (
            <li key={r.href}>
              <a href={r.href} className="block rounded-xl border border-line bg-panel px-4 py-3 hover:bg-raised">
                <span className="block font-medium text-ink">{r.label}</span>
                <span className="block text-xs text-muted">{r.tradition}</span>
              </a>
            </li>
          ))}
          {day.article && (
            <li>
              <Link href={day.article.href} className="block rounded-xl border border-line bg-panel px-4 py-3 hover:bg-raised">
                <span className="block font-medium text-ink">{day.article.title}</span>
                <span className="block text-xs text-muted">Article on Verses Across (optional)</span>
              </Link>
            </li>
          )}
        </ul>
      </section>

      <section className="space-y-1 rounded-xl bg-accent-soft px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Why these together</h3>
        <p className="text-sm leading-relaxed text-ink">{day.note}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Reflect</h3>
        <p className="font-serif text-lg leading-snug text-ink">{day.question}</p>
        <label className="block">
          <span className="sr-only">Your answer</span>
          <textarea
            value={st.notes[k] ?? ""}
            onChange={(e) => onNote(e.target.value)}
            rows={5}
            placeholder="Write a few lines, if you like."
            className="w-full rounded-xl border border-line bg-panel px-3 py-2 text-base text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </label>
        <p className="text-xs text-faint">Your answer stays private: it is kept only on this device and never sent anywhere.</p>
      </section>

      <button
        type="button"
        onClick={onTick}
        aria-pressed={done}
        className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${
          done ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-ink hover:bg-raised"
        }`}
      >
        {done ? "✓ Done" : "Mark this day done"}
      </button>

      <nav className="flex items-center justify-between gap-2 text-sm">
        {prev ? (
          <button type="button" onClick={() => go(prev.w, prev.d)} className="rounded-lg border border-line px-3 py-2 text-ink hover:bg-raised">
            ← Previous day
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button type="button" onClick={() => go(next.w, next.d)} className="rounded-lg border border-line px-3 py-2 text-ink hover:bg-raised">
            Next day →
          </button>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

/* ---------------- one path ---------------- */

function PathView({
  path,
  st,
  onStart,
  onReset,
  onTick,
  open,
  back,
}: {
  path: ResolvedPath;
  st: PathState;
  onStart: () => void;
  onReset: () => void;
  onTick: (w: number, d: number) => void;
  open: (w: number, d: number) => void;
  back: () => void;
}) {
  const total = dayCount(path);
  const done = doneCount(path, st);
  const today = firstOpen(path, st);
  return (
    <article className="space-y-5">
      <button type="button" onClick={back} className="text-sm text-accent hover:underline">
        ← All paths
      </button>
      <header className="space-y-2">
        <h2 className="font-serif text-2xl font-semibold text-ink">{path.title}</h2>
        <p className="text-muted">{path.blurb}</p>
        <p className="text-xs text-faint">4 weeks, 5 days a week. Each day: a few readings, a short note, one question.</p>
      </header>

      <div className="space-y-3 rounded-xl border border-line bg-panel px-4 py-4">
        <Progress done={done} total={total} />
        {st.start ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => open(today.w, today.d)}
              className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink"
            >
              {done === total ? "Look back at the last day" : `Today: week ${today.w + 1}, day ${today.d + 1}`}
            </button>
            <span className="text-xs text-muted">Started {niceDate(st.start)}</span>
          </div>
        ) : (
          <button type="button" onClick={onStart} className="min-h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink">
            Start this path
          </button>
        )}
      </div>

      {path.weeks.map((wk, wi) => (
        <section key={wk.title} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
            Week {wi + 1}: {wk.title}
          </h3>
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {wk.days.map((day, di) => {
              const k = dayKey(wi, di);
              const isToday = !!st.start && today.w === wi && today.d === di && !st.done[k];
              return (
                <li key={k} className="flex items-center gap-3 px-3 py-2">
                  <Tick on={!!st.done[k]} onClick={() => onTick(wi, di)} label={st.done[k] ? "Mark as not done" : "Mark as done"} />
                  <button type="button" onClick={() => open(wi, di)} className="min-w-0 flex-1 py-1 text-left">
                    <span className="block text-xs text-faint">
                      Day {di + 1}
                      {isToday && <span className="ml-2 font-semibold text-accent">Today</span>}
                    </span>
                    <span className="block truncate text-ink">{day.title}</span>
                  </button>
                  <span aria-hidden className="text-faint">
                    ›
                  </span>
                </li>
              );
            })}
          </ol>
          <details className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-ink">For a study group</summary>
            <p className="mt-2 leading-relaxed text-ink">{wk.group}</p>
          </details>
        </section>
      ))}

      {(st.start || done > 0) && (
        <button type="button" onClick={onReset} className="text-xs text-faint underline hover:text-muted">
          Clear my progress and answers for this path
        </button>
      )}
    </article>
  );
}

/* ---------------- the page ---------------- */

export function StudyPaths({ paths }: { paths: ResolvedPath[] }) {
  const [saved, setSaved] = useState<Saved>({ paths: {} });
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<{ w: number; d: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const s = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's record is only readable after hydration
    setSaved(s);
    if (s.open && paths.some((p) => p.id === s.open)) setOpenPath(s.open);
  }, [paths]);

  const update = (fn: (s: Saved) => Saved) =>
    setSaved((old) => {
      const s = fn(old);
      save(s);
      return s;
    });

  const stOf = (id: string): PathState => saved.paths[id] ?? EMPTY;
  const setPath = (id: string, fn: (st: PathState) => PathState) =>
    update((s) => ({ ...s, paths: { ...s.paths, [id]: fn(s.paths[id] ?? EMPTY) } }));

  const toTop = () => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  };
  const choosePath = (id: string | null) => {
    setOpenPath(id);
    setOpenDay(null);
    update((s) => ({ ...s, open: id ?? undefined }));
    toTop();
  };
  const goDay = (w: number, d: number) => {
    setOpenDay({ w, d });
    toTop();
  };

  const path = openPath ? paths.find((p) => p.id === openPath) : undefined;

  return (
    <main ref={mainRef} className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <Link href="/study-lab" className="text-xs text-accent hover:underline">
            ← Study lab
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Study paths</p>
          {!path && (
            <>
              <h1 className="font-serif text-3xl font-semibold text-ink">Read across traditions, a little each day</h1>
              <p className="text-muted">
                Each path is a four-week course: five days a week, a few short readings from different traditions, a note on
                why they sit together, and one question to think over. Each week also has a question for a study group.
              </p>
              <p className="text-xs text-faint">
                The notes compare; they do not rank. Every text is shown in the reader exactly as written, in its own words.
              </p>
            </>
          )}
        </header>

        {!path &&
          paths.map((p) => {
            const st = stOf(p.id);
            const total = dayCount(p);
            const done = doneCount(p, st);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePath(p.id)}
                className="block w-full space-y-2 rounded-xl border border-line bg-panel px-4 py-4 text-left hover:bg-raised"
              >
                <span className="block font-serif text-xl font-semibold text-ink">{p.title}</span>
                <span className="block text-sm text-muted">{p.blurb}</span>
                {st.start || done > 0 ? (
                  <Progress done={done} total={total} />
                ) : (
                  <span className="block text-xs text-faint">{total} days · not started</span>
                )}
              </button>
            );
          })}

        {path && !openDay && (
          <PathView
            path={path}
            st={stOf(path.id)}
            onStart={() => setPath(path.id, (st) => ({ ...st, start: new Date().toISOString() }))}
            onReset={() => {
              let ok = true;
              try {
                ok = window.confirm("Clear your ticks, start date and answers for this path?");
              } catch {
                /* (no dialogs here: go ahead) */
              }
              if (ok) update((s) => ({ ...s, paths: { ...s.paths, [path.id]: EMPTY } }));
            }}
            onTick={(w, d) => setPath(path.id, (st) => ({ ...st, done: { ...st.done, [dayKey(w, d)]: !st.done[dayKey(w, d)] } }))}
            open={goDay}
            back={() => choosePath(null)}
          />
        )}

        {path && openDay && (
          <DayView
            path={path}
            w={openDay.w}
            d={openDay.d}
            st={stOf(path.id)}
            onTick={() =>
              setPath(path.id, (st) => {
                const k = dayKey(openDay.w, openDay.d);
                return { ...st, start: st.start ?? new Date().toISOString(), done: { ...st.done, [k]: !st.done[k] } };
              })
            }
            onNote={(text) => setPath(path.id, (st) => ({ ...st, notes: { ...st.notes, [dayKey(openDay.w, openDay.d)]: text } }))}
            go={goDay}
            back={() => {
              setOpenDay(null);
              toTop();
            }}
          />
        )}

        <footer className="space-y-1 pt-4 text-xs text-faint">
          <p>
            Readings open in the reader in the site&rsquo;s own translations. Hebrew Bible passages open in the Tanakh (JPS
            1917), so a few psalm verse numbers differ by one from Christian Bibles.
          </p>
          <p>Your ticks, start dates and answers are saved only in this browser.</p>
        </footer>
      </div>
    </main>
  );
}
