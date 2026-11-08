"use client";
/**
 * Progress: your level (1–60), time spent reading and listening, verses and chapters, streaks, study
 * groups and badges. Goals live with the reading plans (Plans & Goals, plans-panel.tsx).
 * All counted on this device (src/lib/activity.ts); nothing is sent anywhere.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { dayKey, fmtDuration, periodStart, startActivityTracking, totals, useActivity, type Activity } from "@/lib/activity";
import { addGoalMet, BADGES, computeStats, earned, goalsMetCount, levelOf, markLevel, markSeen, MAX_LEVEL, seenBadges, seenLevel, XP_RULES, xpOf, type Stats } from "@/lib/achievements";
import { finishedPlans, planDays, PLANS, useStartedPlans } from "@/lib/plans";
import { catalog, findBook } from "@/lib/catalog";
import { addGoal, getGoals, goalProgress, METRICS, removeGoal, useGoals, type Metric } from "@/lib/goals";
import { getItem, useStudy } from "@/lib/study";
import type { StudyItem } from "@/lib/storage";
import { closePanel, openPanel, toast } from "@/lib/ui-store";
import { TrashIcon, TrophyIcon } from "./icons";
import { useReaderState } from "./use-reader-state";
import { startSync } from "@/lib/sync";
import { startGroups } from "@/lib/groups";
import { PanelHeader } from "./panel-header";

type Period = "day" | "week" | "month" | "year" | "all";
const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
];
let lastPeriod: Period = "week";

export function ProgressPanel() {
  const a = useActivity();
  const { items } = useStudy();
  const [period, setPeriod] = useState<Period>(lastPeriod);
  useEffect(() => {
    lastPeriod = period;
  }, [period]);
  const stats = useStats();
  const t = useMemo(() => totals(a, period === "all" ? undefined : periodStart(period)), [a, period]);
  const studiedIn = useMemo(() => {
    const from = period === "all" ? "" : periodStart(period);
    let n = 0;
    for (const it of items.values()) if (it.kind === "studied" && dayKey(it.createdAt) >= from) n++;
    return n;
  }, [items, period]);
  const got = BADGES.filter((b) => earned(b, stats));

  return (
    <div className="flex h-full flex-col">
      <PanelHeader icon={<TrophyIcon width={18} height={18} />} title="Progress" onClose={() => closePanel("progress")} closeLabel="Close Progress" />

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-3">
        <LevelCard stats={stats} />
        <button
          type="button"
          onClick={() => openPanel("plans")}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line px-4 text-sm hover:bg-raised"
        >
          <span>Reading plans and goals</span>
          <span className="text-accent">Plans &amp; Goals →</span>
        </button>

        {/* Streak headline */}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-raised px-4 py-3">
          <span className="text-3xl" aria-hidden>
            🔥
          </span>
          <div>
            <p className="font-serif text-2xl font-semibold leading-tight text-ink">
              {stats.streak} {stats.streak === 1 ? "day" : "days"}
            </p>
            <p className="text-xs text-muted">
              {stats.streak ? "in a row" : "Read or listen for a minute to start a streak"}
              {stats.bestStreak > stats.streak ? ` · best ${stats.bestStreak}` : ""}
            </p>
          </div>
        </div>

        <section className="space-y-3" aria-label="Your reading">
          <div role="tablist" aria-label="Period" className="flex gap-1 overflow-x-auto">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`min-h-9 shrink-0 rounded-full px-3 text-sm ${period === p.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-raised"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Reading" value={fmtDuration(t.read)} />
            <Tile label="Listening" value={fmtDuration(t.listen)} />
            <Tile label="Verses read" value={t.verses.toLocaleString()} />
            <Tile label="Chapters read" value={t.chapters.toLocaleString()} />
            <Tile label="Chapters studied" value={studiedIn.toLocaleString()} />
            <Tile label={period === "day" ? "Traditions today" : "Traditions"} value={String(traditionsIn(t.works))} />
          </div>
          {period !== "day" && <Chart a={a} period={period} />}
        </section>

        <button
          type="button"
          onClick={() => openPanel("groups")}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line px-4 text-sm hover:bg-raised"
        >
          <span>Read with friends or family</span>
          <span className="text-accent">Study groups →</span>
        </button>

        <section className="space-y-2" aria-label="Badges">
          <h3 className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-faint">
            Badges <span className="font-normal normal-case tracking-normal">{got.length} of {BADGES.length}</span>
          </h3>
          <ul className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
            {BADGES.map((b) => {
              const on = earned(b, stats);
              const v = Math.min(b.value(stats), b.target);
              return (
                <li
                  key={b.id}
                  title={`${b.name}: ${b.how}${on ? " ✓" : ` (${fmtProgress(v)} of ${b.target.toLocaleString()})`}`}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center ${on ? "border-accent/60 bg-accent-soft" : "border-line"}`}
                >
                  <span className={`text-2xl ${on ? "" : "opacity-30 grayscale"}`} aria-hidden>
                    {b.icon}
                  </span>
                  <span className={`text-[11px] leading-tight ${on ? "font-medium text-ink" : "text-faint"}`}>{b.name}</span>
                  {!on && (
                    <span className="h-1 w-10/12 overflow-hidden rounded-full bg-line" aria-label={`${fmtProgress(v)} of ${b.target}`}>
                      <span className="block h-full rounded-full bg-accent/70" style={{ width: `${(v / b.target) * 100}%` }} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <p className="pb-2 text-xs text-faint">
          Counted on your devices only (and shared only with groups you join). Reading time counts while a chapter is open and you’re using it; verses count once
          they’ve been on screen for two seconds. Mark chapters as studied at the end of each chapter.
        </p>
      </div>
    </div>
  );
}

const fmtProgress = (v: number) => (v % 1 ? v.toFixed(1) : v.toLocaleString());

function traditionsIn(works: Set<string>) {
  const rel = new Set<string>();
  for (const r of catalog.religions) for (const c of r.collections) for (const i of c.items) if (i.work && works.has(i.work)) rel.add(r.id);
  return rel.size;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-serif text-xl font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

/** Minutes per day (week, month) or per month (year, all time): one series, hover for the value. */
function Chart({ a, period }: { a: Activity; period: Exclude<Period, "day"> }) {
  const bars = useMemo(() => {
    const out: { label: string; long: string; mins: number }[] = [];
    const now = new Date();
    if (period === "week" || period === "month") {
      const n = period === "week" ? 7 : 30;
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const day = a.days[dayKey(d)];
        out.push({
          label: period === "week" ? d.toLocaleDateString(undefined, { weekday: "narrow" }) : i % 5 === 0 ? String(d.getDate()) : "",
          long: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
          mins: day ? Math.round((day.r + day.l) / 60) : 0,
        });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const prefix = dayKey(d).slice(0, 7);
        let s = 0;
        for (const [k, day] of Object.entries(a.days)) if (k.startsWith(prefix)) s += day.r + day.l;
        out.push({ label: d.toLocaleDateString(undefined, { month: "narrow" }), long: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), mins: Math.round(s / 60) });
      }
    }
    return out;
  }, [a, period]);
  const max = Math.max(1, ...bars.map((b) => b.mins));
  const caption = period === "week" ? "Minutes a day, last 7 days" : period === "month" ? "Minutes a day, last 30 days" : "Minutes a month, last 12 months";
  return (
    <figure className="space-y-1">
      <figcaption className="flex justify-between text-xs text-muted">
        <span>{caption}</span>
        <span className="tabular-nums text-faint">max {max} min</span>
      </figcaption>
      <div className="flex h-24 items-end gap-[2px] border-b border-line" role="img" aria-label={`${caption}: ${bars.map((b) => `${b.long} ${b.mins}`).join(", ")}`}>
        {bars.map((b, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end" title={`${b.long}: ${b.mins} min`}>
            <div className="w-full rounded-t-[4px] bg-accent group-hover:opacity-80" style={{ height: b.mins ? `${Math.max(3, (b.mins / max) * 100)}%` : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] text-center text-[10px] text-faint" aria-hidden>
        {bars.map((b, i) => (
          <span key={i} className="flex-1">
            {b.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

function Ring({ value, size = 40 }: { value: number; size?: number }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
      {value > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" strokeDasharray={`${c * Math.min(1, value)} ${c}`} />}
    </svg>
  );
}

/** Goals: in Plans & Goals. */
export function Goals() {
  const a = useActivity();
  const goals = useGoals();
  const { items } = useStudy();
  const [adding, setAdding] = useState(false);
  return (
    <section className="space-y-2" aria-label="Goals">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Goals</h3>
      {goals.length === 0 && !adding && <p className="text-sm text-muted">Set a daily or weekly goal, or a date to finish a book.</p>}
      <ul className="space-y-2">
        {goals.map((g) => {
          const p = goalProgress(g, a, items);
          return (
            <li key={g.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
              <div className="relative">
                <Ring value={p.target ? p.value / p.target : 0} />
                {p.done && <span className="absolute inset-0 flex items-center justify-center text-sm text-accent">✓</span>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{p.label}</p>
                <p className="text-xs text-muted">{p.detail}</p>
              </div>
              <button type="button" onClick={() => removeGoal(g.id)} aria-label={`Remove goal: ${p.label}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-raised hover:text-ink">
                <TrashIcon width={16} height={16} />
              </button>
            </li>
          );
        })}
      </ul>
      {adding ? <AddGoal onDone={() => setAdding(false)} /> : (
        <button type="button" onClick={() => setAdding(true)} className="min-h-10 w-full rounded-xl border border-dashed border-line text-sm text-muted hover:bg-raised hover:text-ink">
          + Add a goal
        </button>
      )}
    </section>
  );
}

function AddGoal({ onDone }: { onDone: () => void }) {
  const { ref } = useReaderState();
  const [kind, setKind] = useState<"amount" | "book">("amount");
  const [metric, setMetric] = useState<Metric>("time");
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [target, setTarget] = useState(15);
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const [by, setBy] = useState(dayKey(in30));
  const book = findBook(ref.work, ref.book);
  const minutes = metric === "time" || metric === "read" || metric === "listen";
  const field = "h-10 rounded-lg border border-line bg-raised px-2 text-base md:text-sm";
  const save = () => {
    if (kind === "book") {
      if (!book) return;
      addGoal({ type: "book", work: ref.work, book: ref.book, by, from: dayKey() });
    } else {
      if (!(target > 0)) return;
      addGoal({ type: "amount", metric, period, target: Math.round(target) });
    }
    toast("Goal set");
    onDone();
  };
  return (
    <div className="space-y-3 rounded-xl border border-line bg-raised/50 p-3 text-sm">
      <div className="flex gap-1">
        {(["amount", "book"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-9 flex-1 rounded-full px-3 ${kind === k ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-raised"}`}>
            {k === "amount" ? "Daily or weekly" : "Finish a book"}
          </button>
        ))}
      </div>
      {kind === "amount" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input type="number" min={1} max={10000} value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Target" className={`${field} w-20`} />
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="What to count" className={`${field} min-w-0 flex-1`}>
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.unit === "min" ? `min of ${m.label.toLowerCase()}` : m.unit}
              </option>
            ))}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value as "day" | "week")} aria-label="How often" className={field}>
            <option value="day">a day</option>
            <option value="week">a week</option>
          </select>
          {!minutes && metric === "chapters" && <p className="w-full text-xs text-faint">A chapter counts once you’ve read or listened to it for 30 seconds.</p>}
        </div>
      ) : book ? (
        <label className="flex flex-wrap items-center gap-2">
          <span>
            Study all {book.chapters} chapters of <strong className="text-ink">{book.name}</strong> by
          </span>
          <input type="date" value={by} min={dayKey()} onChange={(e) => setBy(e.target.value)} className={field} />
          <span className="w-full text-xs text-faint">Open another book first to pick it instead. Chapters count when you mark them as studied.</span>
        </label>
      ) : (
        <p className="text-muted">Open a book first, then come back here.</p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={save} className="min-h-10 flex-1 rounded-lg bg-accent font-medium text-accent-ink">
          Set goal
        </button>
        <button type="button" onClick={onDone} className="min-h-10 rounded-lg px-4 text-muted hover:bg-raised">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------- running in the background: tracking, celebrations, the top-bar ring ---------- */

const MET = "va-goals-met:v1";

/** Starts activity tracking and announces new badges and goals met (once each). */
export function ProgressWatcher() {
  const a = useActivity();
  const { items, ready } = useStudy();
  const started = useStartedPlans();
  useEffect(() => {
    startActivityTracking();
    startSync();
    startGroups();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const stats = statsNow(a, items, started);
      const now = BADGES.filter((b) => earned(b, stats)).map((b) => b.id);
      const seen = seenBadges();
      const lvl = levelOf(xpOf(stats)).level;
      const was = seenLevel();
      if (seen === null || was === null) {
        // first run: don't announce what was already done
        markSeen(now);
        markLevel(lvl);
        return;
      }
      if (lvl > was) {
        markLevel(lvl);
        const title = levelOf(xpOf(stats)).title;
        toast(lvl === MAX_LEVEL ? `⬆️ Level ${lvl} — ${title}, the highest level!` : `⬆️ Level ${lvl} — ${title}!`, 5000);
        return; // a badge earned at the same moment is announced on the next check, a few seconds later
      }
      const fresh = BADGES.filter((b) => now.includes(b.id) && !seen.has(b.id));
      if (fresh.length) {
        markSeen(now);
        toast(`${fresh[0].icon} Badge earned: ${fresh[0].name}${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ""}`, 5000);
        return;
      }
      let met: Record<string, string> = {};
      try {
        met = JSON.parse(localStorage.getItem(MET) ?? "{}");
      } catch {
        /* ignore */
      }
      for (const g of getGoals()) {
        const p = goalProgress(g, a, items);
        const when = g.type === "book" ? "done" : periodStart(g.period);
        if (p.done && met[g.id] !== when) {
          met[g.id] = when;
          try {
            localStorage.setItem(MET, JSON.stringify(met));
          } catch {
            /* ignore */
          }
          addGoalMet();
          toast(`🎯 Goal reached: ${p.label}`, 5000);
          break;
        }
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [a, items, ready, started]);
  return null;
}

/** Today's progress toward the first goal (0–1), or null without a goal. */
export function useGoalRing(): number | null {
  const a = useActivity();
  const goals = useGoals();
  const { items } = useStudy();
  const g = goals.find((x) => x.type === "amount") ?? goals[0];
  if (!g) return null;
  const p = goalProgress(g, a, items);
  return p.target ? Math.min(1, p.value / p.target) : 0;
}

/* ---------- stats with plans and goals; the level card ---------- */

function statsNow(a: Activity, items: Map<string, StudyItem>, started: Record<string, { start: number }>, finished = finishedPlans(), goalsMet = goalsMetCount()): Stats {
  const done = new Set(finished);
  for (const p of PLANS) if (started[p.id] && planDays(p).every((d) => d.every((r) => !!getItem("studied", r)))) done.add(`${p.id}@${started[p.id].start}`);
  return computeStats(a, items, { plansDone: done.size, goalsMet });
}

const noSubscribe = () => () => {};
const finishedKey = () => finishedPlans().join("|");

/**
 * Everything counted, with finished plans and goals reached (for badges and the level). The two counts
 * kept in storage are read the hydration-safe way (0 while the server-rendered page is taken over).
 */
export function useStats(): Stats {
  const a = useActivity();
  const { items } = useStudy();
  const started = useStartedPlans();
  const goalsMet = useSyncExternalStore(noSubscribe, goalsMetCount, () => 0);
  const finished = useSyncExternalStore(noSubscribe, finishedKey, () => "");
  return useMemo(() => statsNow(a, items, started, finished ? finished.split("|") : [], goalsMet), [a, items, started, finished, goalsMet]);
}

/** The current level (1–60), for the top-bar trophy. */
export function useLevel() {
  const stats = useStats();
  return levelOf(xpOf(stats));
}

function LevelCard({ stats }: { stats: Stats }) {
  const [how, setHow] = useState(false);
  const xp = xpOf(stats);
  const l = levelOf(xp);
  return (
    <section aria-label="Level" className="space-y-2 rounded-xl border border-line bg-raised px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent font-serif text-xl font-semibold tabular-nums text-accent" aria-hidden>
          {l.level}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-xl font-semibold leading-tight text-ink">
            Level {l.level} <span className="text-base font-normal text-muted">· {l.title}</span>
          </p>
          <p className="text-xs text-muted">
            {l.to ? `${(l.to - xp).toLocaleString()} XP to level ${l.level + 1}` : "The highest level. Well done!"}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={`Experience toward level ${Math.min(MAX_LEVEL, l.level + 1)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(l.progress * 100)}
        className="h-2.5 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${Math.max(2, l.progress * 100)}%` }} />
      </div>
      <p className="flex justify-between text-[11px] tabular-nums text-faint">
        <span>{xp.toLocaleString()} XP</span>
        <span>{l.to ? `${l.to.toLocaleString()} XP` : `Level ${MAX_LEVEL}`}</span>
      </p>
      <button type="button" aria-expanded={how} onClick={() => setHow(!how)} className="min-h-8 text-xs text-accent underline-offset-2 hover:underline">
        {how ? "Hide how to earn XP" : "How to earn XP"}
      </button>
      {how && (
        <ul className="space-y-0.5 text-xs text-muted">
          {XP_RULES.map((r) => (
            <li key={r.label} className="flex justify-between gap-2">
              <span>{r.label}</span>
              <span className="shrink-0 tabular-nums">+{r.xp.toLocaleString()}</span>
            </li>
          ))}
          <li className="pt-1 text-faint">Levels go from 1 to {MAX_LEVEL}; each one takes a little more than the last.</li>
        </ul>
      )}
    </section>
  );
}
