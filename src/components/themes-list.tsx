"use client";
/**
 * The Themes list with its own Scriptures | Library switch: scripture themes (forgiveness, the flood…) or Library
 * themes (coming of age, revenge, voyages at sea…). Opens on the side you're reading.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSide, type Side } from "@/lib/side";
import type { ThemeSummary } from "@/lib/themes";

export function ThemesList({ themes }: { themes: ThemeSummary[] }) {
  const pageSide = useSide();
  const [picked, setPicked] = useState<Side | null>(null);
  // "/themes#library" (the way back from a Library theme) opens that list
  useEffect(() => {
    const h = location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address after hydration
    if (h === "library" || h === "scriptures") setPicked(h);
  }, []);
  const side = picked ?? pageSide;
  const list = themes.filter((t) => t.side === side);
  const groups = [...new Set(list.map((t) => t.group))];
  return (
    <div className="space-y-8">
      <div role="radiogroup" aria-label="Themes from" className="flex max-w-sm rounded-xl border border-line bg-raised p-1 text-sm">
        {(["scriptures", "library"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={side === s}
            onClick={() => {
              setPicked(s);
              history.replaceState(null, "", `#${s}`);
            }}
            className={`min-h-10 flex-1 rounded-lg px-3 ${side === s ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:text-ink"}`}
          >
            {s === "scriptures" ? "Scriptures" : "Library"} <span className="text-xs font-normal text-faint">{themes.filter((t) => t.side === s).length}</span>
          </button>
        ))}
      </div>
      <p className="text-sm">
        {side === "scriptures"
          ? "One theme, every tradition: the passages that speak most closely to it in each scripture, side by side, and the Library's books that echo it."
          : "Themes of stories, poems and plays: the books that carry each one most, with a passage from each, and where the scriptures echo it."}
      </p>
      {groups.map((g) => (
        <section key={g} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-faint">{g}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {list
              .filter((t) => t.group === g)
              .map((t) => (
                <li key={t.id}>
                  <Link href={`/themes/${t.id}`} className="flex h-full flex-col gap-1 rounded-xl border border-line px-4 py-3 hover:border-accent">
                    <span className="font-serif text-lg font-semibold text-ink">{t.name}</span>
                    <span className="text-sm">{t.text}</span>
                    <span className="text-xs text-faint">{side === "scriptures" ? `${t.traditions} traditions · ${t.books} books` : `${t.books} books`}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
