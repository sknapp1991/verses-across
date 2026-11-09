"use client";
/** "Studied" checkbox at the end of a chapter; stores when you marked it (shown as MM/DD/YY h:mm AM). */
import type { BookRef } from "@/lib/catalog";
import { openFeedback } from "@/lib/feedback";
import { formatStamp, itemId, studyAgain, timesStudied, toggle, undoStudyAgain, useStudy } from "@/lib/study";
import { toast } from "@/lib/ui-store";
import { CheckIcon, RepeatIcon } from "./icons";

export function StudiedBox({ bookRef, title }: { bookRef: BookRef; title: string }) {
  // From the hook's snapshot (empty while the server-rendered page is taken over), so it hydrates cleanly.
  const { items } = useStudy();
  const item = items.get(itemId("studied", bookRef));
  const times = timesStudied(item);
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 md:px-8">
      <button
        type="button"
        role="checkbox"
        aria-checked={!!item}
        onClick={() => {
          const on = toggle("studied", bookRef);
          toast(on ? `${title} marked as studied` : `${title} unmarked`);
        }}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-left ${
          item ? "border-accent bg-accent-soft" : "border-dashed border-line hover:border-faint"
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
            item ? "border-accent bg-accent text-accent-ink" : "border-faint"
          }`}
        >
          {item && <CheckIcon width={16} height={16} strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className="block font-medium">{item ? `${title} — studied${times > 1 ? ` ${times} times` : ""}` : `Mark ${title} as studied`}</span>
          <span className="block text-xs text-muted">
            {item
              ? times > 1
                ? `First ${formatStamp(item.createdAt)} · last ${formatStamp(item.again![item.again!.length - 1])}`
                : formatStamp(item.createdAt)
              : "Keeps a dated record in My Study and a ✓ in the library"}
          </span>
        </span>
      </button>
      {item && (
        <div className="mt-2 flex gap-2">
          {/* Read it again: counted as another time through (re-reading badges and experience), the first date kept. */}
          <button
            type="button"
            onClick={() => {
              const n = studyAgain(bookRef);
              toast(`${title} studied ${n} times`);
            }}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-accent hover:border-faint"
          >
            <RepeatIcon width={16} height={16} aria-hidden />
            Studied it again
          </button>
          {/* A tap too many: take back only the latest time; the first date and earlier re-reads stay. */}
          {times > 1 && (
            <button
              type="button"
              onClick={() => {
                const n = undoStudyAgain(bookRef);
                toast(`Took back the last one: ${title} studied ${n === 1 ? "once" : `${n} times`}`);
              }}
              title="Take back the most recent 'studied again' (the earlier dates stay)"
              className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line px-4 text-sm text-muted hover:border-faint hover:text-ink"
            >
              Undo last
            </button>
          )}
        </div>
      )}
      {/* Feedback where a reader finishes: quiet, always there, never over the text. */}
      <p className="mt-3 text-center text-xs text-faint">
        Spotted a mistake or have an idea?{" "}
        <button type="button" onClick={() => openFeedback()} className="min-h-8 font-medium text-accent underline-offset-2 hover:underline">
          Send feedback
        </button>
      </p>
    </div>
  );
}
