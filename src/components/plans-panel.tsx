"use client";
/**
 * Plans & Goals (its own top-bar button): start a reading plan, see today's reading, tick chapters off
 * (the "studied" mark), and set daily or weekly goals or a date to finish a book.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { chapterTitle, DEFAULT_VERSIONS, findBook, readHref, type BookRef } from "@/lib/catalog";
import { dayIndex, planDays, PLANS, recordFinished, startPlan, stopPlan, useStartedPlans, type PlanDef } from "@/lib/plans";
import { getItem, toggle, useStudy } from "@/lib/study";
import { closePanel, toast } from "@/lib/ui-store";
import { CalendarIcon } from "./icons";
import { Goals, Ring } from "./progress-panel";
import { useReaderState } from "./use-reader-state";
import { PanelHeader } from "./panel-header";

const label = (r: BookRef) => chapterTitle(findBook(r.work, r.book), r.chapter, r.book);

export function PlansPanel({ onNavigate }: { onNavigate?: () => void }) {
  const started = useStartedPlans();
  const active = PLANS.filter((p) => started[p.id]);
  const others = PLANS.filter((p) => !started[p.id]);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader icon={<CalendarIcon width={18} height={18} />} title="Plans & Goals" onClose={() => closePanel("plans")} closeLabel="Close Plans and Goals" />
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-2 py-3">
        <div className="px-2">
          <Goals />
        </div>
        <section aria-label="Reading plans" className="space-y-4">
      {active.map((p) => (
        <ActivePlan key={p.id} plan={p} start={started[p.id].start} onNavigate={onNavigate} />
      ))}
      <div>
        <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-faint">{active.length ? "More plans" : "Start a reading plan"}</h3>
        <ul className="divide-y divide-line/70">
          {others.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{p.name}</span>
                <span className="block text-xs text-muted">{p.blurb}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  startPlan(p.id);
                  toast(`Started: ${p.name}. Day 1 is ready.`);
                }}
                className="min-h-10 shrink-0 rounded-lg border border-accent px-3 text-sm font-medium text-accent hover:bg-accent-soft"
              >
                Start
              </button>
            </li>
          ))}
        </ul>
        <p className="px-2 pt-2 text-xs text-faint">Progress uses the “studied” tick on each chapter, so ticking a chapter anywhere counts.</p>
      </div>
        </section>
      </div>
    </div>
  );
}

function ActivePlan({ plan, start, onNavigate }: { plan: PlanDef; start: number; onNavigate?: () => void }) {
  useStudy(); // re-render when chapters are ticked
  const { ref, versions } = useReaderState();
  const days = useMemo(() => planDays(plan), [plan]);
  const done = (r: BookRef) => !!getItem("studied", r);
  const dayDone = (d: BookRef[]) => d.every(done);
  const finished = days.filter(dayDone).length;
  const total = days.length;
  // Show the first day not finished yet (catch up at your own pace); "on track" compares with the calendar.
  const next = days.findIndex((d) => !dayDone(d));
  const calendar = Math.min(total - 1, dayIndex(start));
  const behind = next >= 0 ? calendar - next : 0;
  const today = next >= 0 ? days[next] : null;
  // The chapters the last "Mark day N as read" ticked, so it can be undone.
  const [undo, setUndo] = useState<{ day: number; refs: BookRef[]; at: number } | null>(null);
  const markDay = () => {
    if (!today) return;
    const refs = today.filter((r) => !done(r));
    refs.forEach((r) => toggle("studied", r));
    setUndo({ day: next + 1, refs, at: next + 1 });
  };
  const undoMark = () => {
    undo?.refs.forEach((r) => done(r) && toggle("studied", r));
    setUndo(null);
  };
  const href = (r: BookRef) => readHref(r, r.work === ref.work ? versions : DEFAULT_VERSIONS[r.work]);
  const [open, setOpen] = useState(false);

  const pace = today ? `Day ${next + 1}${behind > 0 ? ` · ${behind} day${behind === 1 ? "" : "s"} behind, no rush` : behind < 0 ? " · ahead of schedule" : " · on track"}` : "Finished: well done! 🎉";
  return (
    // one look with the goals: a ring, the name and the pace; open it for the day's chapters (hub 777e6ee4)
    <section className="rounded-xl border border-line">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <span className="relative">
          <Ring value={total ? finished / total : 0} />
          {!today && <span className="absolute inset-0 flex items-center justify-center text-sm text-accent">✓</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{plan.name}</span>
          <span className="block text-xs text-muted">
            {pace} · {finished}/{total} days
          </span>
        </span>
        <span aria-hidden className={`shrink-0 text-faint transition ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>
      {open && (
      <div className="border-t border-line px-3 pb-2 pt-1">
      {today ? (
        <>
          <ul className="mt-1.5 space-y-1">
            {today.map((r) => {
              const ok = done(r);
              return (
                <li key={`${r.book}/${r.chapter}`} className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={ok ? `Untick ${label(r)}` : `Tick ${label(r)} as read`}
                    onClick={() => toggle("studied", r)}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm ${ok ? "border-accent bg-accent text-accent-ink" : "border-line"}`}
                  >
                    {ok ? "✓" : ""}
                  </button>
                  <Link href={href(r)} onClick={onNavigate} className={`min-h-9 flex-1 content-center text-sm font-medium ${ok ? "text-muted line-through" : "text-accent"}`}>
                    {label(r)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={markDay} className="mt-2 min-h-9 w-full rounded-lg border border-line text-sm hover:border-faint">
            Mark day {next + 1} as read
          </button>
        </>
      ) : null}
      {/* Only while it still applies (gone once anything else is ticked or unticked). */}
      {undo && undo.at === (next >= 0 ? next : days.length) && (
        <p role="status" className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-accent-soft px-3 py-1.5 text-sm text-ink">
          <span>Day {undo.day} marked as read.</span>
          <button type="button" onClick={undoMark} className="min-h-8 rounded-md px-2 font-semibold text-accent hover:underline">
            Undo
          </button>
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          if (!today) recordFinished(plan.id, start); // finished: still counts after stopping
          stopPlan(plan.id);
          toast(`Stopped ${plan.name} (your ticks are kept)`);
        }}
        className="mt-1 text-xs text-faint underline-offset-2 hover:text-ink hover:underline"
      >
        Stop this plan
      </button>
      </div>
      )}
    </section>
  );
}
