"use client";
/**
 * A book of the other site opened here (an old link, a bookmark, a search result from before the split): go to the
 * same page there at once, taking the reader's saved data along (forwardTo). Search engines are sent there by the
 * chapter page itself (a permanent redirect for crawlers).
 *
 * Loop guard: if this tab was forwarded between the sites a moment ago (the two sites briefly disagreeing about
 * where a book lives, e.g. while one is still deploying), show a link instead of bouncing back and forth.
 */
import { useEffect, useState } from "react";
import { forwardTo } from "./domain-move";

const HOP = "va-site-hop";
const RECENT_MS = 20_000;

export function MovedAway({ origin, name }: { origin: string; name: string }) {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(HOP)) || 0;
      sessionStorage.setItem(HOP, String(Date.now()));
    } catch {
      /* storage blocked: forward anyway */
    }
    if (Date.now() - last < RECENT_MS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- decided once, from this tab's history
      setStuck(true);
      return;
    }
    void forwardTo(origin);
  }, [origin]);
  const here = typeof window === "undefined" ? "" : window.location.pathname + window.location.search;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted" aria-busy={!stuck}>
      <p className="font-serif text-2xl text-ink">This book is on {name} now</p>
      {stuck ? (
        <a href={origin + here} className="min-h-11 rounded-xl bg-accent px-5 py-2.5 font-medium text-accent-ink">
          Open it on {name}
        </a>
      ) : (
        <p>Taking you there…</p>
      )}
    </div>
  );
}
