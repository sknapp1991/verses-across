"use client";
/**
 * A group in My Study (a book's items in book order, or an Articles section): a filled title bar with its count that
 * folds the group open and shut (my brother's ticket ffc92c94, Nov 23: "formatting to title/headers with collapsible
 * functionality"). Open to start; folding is for this visit only.
 */
import type { ReactNode } from "react";

export function StudyGroup({ title, count, children }: { title: ReactNode; count?: number; children: ReactNode }) {
  return (
    <details open className="group/sg">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md bg-raised px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:bg-accent-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate">{title}</span>
        {count != null && (
          <span className="shrink-0 font-normal text-faint">
            {count}
            <span className="sr-only"> items</span>
          </span>
        )}
        <span aria-hidden className="ml-auto shrink-0 text-sm leading-none text-faint transition group-open/sg:rotate-90 motion-reduce:transition-none">
          ›
        </span>
      </summary>
      {children}
    </details>
  );
}
