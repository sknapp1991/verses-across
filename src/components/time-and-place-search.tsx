"use client";
/**
 * The Time and place search box (study lab, hub 7a62bb28): finds any place in the whole Bible by any name it goes
 * by, forgiving a typo or two (matchScore in src/lib/time-and-place.ts). Used above the map and twice in "How far".
 */
import { useMemo, useState } from "react";
import { SURE_LABEL, fold, matchScore, type IndexPlace } from "@/lib/time-and-place";

const field = "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink";

export function Search({
  index,
  failed,
  retry,
  want,
  choose,
  idPrefix = "tp-search",
  label = "Find a place anywhere in the Bible",
  placeholder = "Find a place: Bethlehem, Ur, Patmos…",
  only,
}: {
  index: IndexPlace[] | null;
  failed: boolean;
  retry: () => void;
  want: () => void;
  choose: (id: string) => void;
  /** Unique per box on the page (for the list's ids). */
  idPrefix?: string;
  label?: string;
  placeholder?: string;
  /** Only places that pass (e.g. only places on the map). */
  only?: (p: IndexPlace) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const q = fold(query);
  const results = useMemo(() => {
    if (!q || !index) return [];
    const scored: { p: IndexPlace; s: number; via?: string }[] = [];
    for (const p of index) {
      if (only && !only(p)) continue;
      let s = matchScore(q, p.n);
      let via: string | undefined;
      for (const k of p.k ?? []) {
        const t = matchScore(q, k) - 2; // (the KJV name wins a tie)
        if (t > s) {
          s = t;
          via = k;
        }
      }
      if (s > 0) scored.push({ p, s, via });
    }
    scored.sort((a, b) => b.s - a.s || b.p.w - a.p.w);
    return scored.slice(0, 10);
  }, [q, index, only]);
  const pickAt = (i: number) => {
    const r = results[i];
    if (!r) return;
    choose(r.p.id);
    setQuery("");
    setActive(0);
  };
  const open = q.length > 0 && focused;
  const listId = `${idPrefix}-results`;

  return (
    <div className="relative">
      <label className="block">
        <span className="sr-only">{label}</span>
        <input
          type="search"
          className={field}
          placeholder={placeholder}
          value={query}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? `${idPrefix}-result-${active}` : undefined}
          onFocus={() => {
            setFocused(true);
            want();
          }}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            setFocused(true);
            setQuery(e.target.value);
            setActive(0);
            want();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && results.length) {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp" && results.length) {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pickAt(active);
            } else if (e.key === "Escape") setQuery("");
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <p className="sr-only" aria-live="polite">
        {open && index ? `${results.length} ${results.length === 1 ? "place" : "places"} found` : ""}
      </p>
      {open && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-panel shadow-lg"
        >
          {failed ? (
            <p className="p-3 text-sm text-muted">
              The place list couldn&apos;t be loaded.{" "}
              <button className="text-accent hover:underline" onClick={retry}>
                Try again
              </button>
            </p>
          ) : !index ? (
            <p className="p-3 text-sm text-muted">Loading places…</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted">No place by that name. Try fewer letters.</p>
          ) : (
            <ul id={listId} role="listbox">
              {results.map(({ p, via }, i) => (
                // (an option, not a button inside one; mouse down keeps the box focused so the tap lands)
                <li
                  key={p.id}
                  id={`${idPrefix}-result-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`block min-h-11 w-full cursor-pointer px-3 py-2 text-left hover:bg-raised ${i === active ? "bg-raised" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pickAt(i)}
                >
                  <span className="font-semibold text-ink">{p.n}</span>
                  {via && <span className="text-sm text-muted"> ({via})</span>}
                  <span className="block text-xs text-faint">
                    {p.u ? "Not on the map" : p.m && p.m !== p.n ? `Identified with ${p.m}` : SURE_LABEL[p.c]} · {p.w}{" "}
                    {p.w === 1 ? "verse" : "verses"}, {p.b.length} {p.b.length === 1 ? "book" : "books"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
