"use client";
/**
 * Heat map (Time and place, study lab, hub 7a62bb28): where a book's story happens, as a glow on the map, weighted by
 * how many of the book's KJV verses name each place. One book or the whole Bible, or two compared (overlaid in two
 * theme colours, or side by side). Counts come from public/places/heat.json, built by scripts/build-places.mts from
 * OpenBible.info's data; place positions from the place index.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findBook } from "@/lib/catalog";
import type { HeatFile, IndexPlace, MapOutline } from "@/lib/time-and-place";
import { GLOW_COLOR, MapView, fitBox, loadJson, useSvgId, type MapApi, type MapDot, type MapGlow } from "./time-and-place-map";

const field = "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink";
const ALL = "all";
const TOP = 8;

type Row = { p: IndexPlace; n: number };
type Layer = { book: string; name: string; rows: Row[]; tone: 0 | 1 };

const nameOf = (book: string) => (book === ALL ? "The whole Bible" : (findBook("bible", book)?.name ?? book));

export function Heat({
  outline,
  index,
  indexFailed,
  retryIndex,
  books,
  pick,
  openPlace,
}: {
  outline: MapOutline | null;
  index: IndexPlace[] | null;
  indexFailed: boolean;
  retryIndex: () => void;
  books: { id: string; name: string }[];
  /** A dot on the map: show the place's card. */
  pick: (id: string) => void;
  /** A name in the top list: open the place page. */
  openPlace: (id: string) => void;
}) {
  const [heat, setHeat] = useState<HeatFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [bookA, setBookA] = useState(ALL);
  const [bookB, setBookB] = useState(""); // "" = no comparison
  const [side, setSide] = useState(false);

  useEffect(() => {
    let live = true;
    loadJson<HeatFile>("/places/heat.json").then(
      (d) => {
        if (!live) return;
        setHeat(d);
        setFailed(!d);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const byAid = useMemo(() => new Map((index ?? []).map((p) => [p.id.split("/")[0], p])), [index]);

  const layerOf = useCallback(
    (book: string, tone: 0 | 1): Layer => {
      const counts = new Map<string, number>();
      if (heat) {
        const lists = book === ALL ? Object.values(heat) : [heat[book] ?? []];
        for (const list of lists) for (const [id, n] of list) counts.set(id, (counts.get(id) ?? 0) + n);
      }
      const rows: Row[] = [];
      counts.forEach((n, id) => {
        const p = byAid.get(id);
        if (p && p.x !== undefined) rows.push({ p, n });
      });
      rows.sort((x, y) => y.n - x.n || x.p.n.localeCompare(y.p.n));
      return { book, name: nameOf(book), rows, tone };
    },
    [heat, byAid],
  );
  const a = useMemo(() => layerOf(bookA, 0), [layerOf, bookA]);
  const b = useMemo(() => (bookB ? layerOf(bookB, 1) : null), [layerOf, bookB]);
  const layers = useMemo(() => (b ? [a, b] : [a]), [a, b]);
  const aOnly = useMemo(() => [a], [a]);
  const bOnly = useMemo(() => (b ? [b] : []), [b]);
  const ready = !!heat && !!index;

  /** (`not`: the book already shown, which can't be compared with itself) */
  const picker = (value: string, set: (v: string) => void, label: string, none?: string, not?: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      <select className={field} value={value} onChange={(e) => set(e.target.value)}>
        {none !== undefined && <option value="">{none}</option>}
        <option value={ALL} disabled={not === ALL}>
          The whole Bible
        </option>
        {books.map((bk) => (
          <option key={bk.id} value={bk.id} disabled={not === bk.id}>
            {bk.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {picker(
            bookA,
            (v) => {
              setBookA(v);
              if (v === bookB) setBookB(""); // (never a book against itself)
            },
            "Show",
          )}
          {picker(bookB, setBookB, "Compare with", "Nothing (one book)", bookA)}
        </div>
        {b && (
          <div className="flex gap-1 rounded-xl border border-line bg-paper p-1" role="radiogroup" aria-label="How to compare">
            {(
              [
                [false, "Overlaid"],
                [true, "Side by side"],
              ] as [boolean, string][]
            ).map(([v, label]) => (
              <button
                key={label}
                role="radio"
                aria-checked={side === v}
                tabIndex={side === v ? 0 : -1}
                onClick={() => setSide(v)}
                onKeyDown={(e) => {
                  // (two radios: any arrow moves to the other one)
                  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) < 0) return;
                  e.preventDefault();
                  setSide(!side);
                  const other = e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[aria-checked="${side ? "false" : "true"}"]`);
                  other?.focus();
                }}
                className={`min-h-10 flex-1 rounded-lg px-2 text-sm ${side === v ? "bg-accent font-semibold text-accent-ink" : "text-ink hover:bg-raised"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <HeatLegend layers={layers} />
        <p className="text-xs text-faint">
          The glow shows how often places are named in the book&apos;s verses (KJV), not how many people lived there or how important a place
          was. Places whose location is uncertain glow at the best-guess spot, and countries and regions (like Egypt) glow at a single
          point.
        </p>
      </div>

      {failed || indexFailed ? (
        <div className="space-y-2 rounded-xl bg-panel p-4 text-sm text-muted">
          <p>The heat map couldn&apos;t be loaded. Check your connection and try again.</p>
          <button
            onClick={() => {
              if (failed) setAttempt((n) => n + 1);
              if (indexFailed) retryIndex();
            }}
            className="min-h-10 rounded-lg border border-line bg-paper px-3 text-ink hover:bg-raised"
          >
            Try again
          </button>
        </div>
      ) : !ready ? (
        <p className="text-sm text-muted">Loading the heat map…</p>
      ) : b && side ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[aOnly, bOnly].map((ls) => (
            <div key={ls[0].tone} className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Swatch tone={ls[0].tone} /> {ls[0].name}
              </p>
              <HeatMap outline={outline} layers={ls} pick={pick} />
            </div>
          ))}
        </div>
      ) : (
        <HeatMap outline={outline} layers={layers} pick={pick} />
      )}

      {ready && (
        <div className={`grid gap-4 ${b ? "sm:grid-cols-2" : ""}`}>
          {layers.map((l) => (
            <TopList key={l.tone} layer={l} openPlace={openPlace} />
          ))}
        </div>
      )}
    </section>
  );
}

function Swatch({ tone }: { tone: 0 | 1 }) {
  const id = `tp-swatch-${tone}-${useSvgId()}`;
  return (
    <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden className="shrink-0">
      <defs>
        <radialGradient id={id}>
          <stop offset="0%" style={{ stopColor: GLOW_COLOR[tone], stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: GLOW_COLOR[tone], stopOpacity: 0.15 }} />
        </radialGradient>
      </defs>
      <circle r={8} fill={`url(#${id})`} />
    </svg>
  );
}

function HeatLegend({ layers }: { layers: Layer[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {layers.map((l) => (
        <li key={l.tone} className="flex items-center gap-1.5">
          <Swatch tone={l.tone} />
          <span className="font-semibold text-ink">{l.name}</span>
        </li>
      ))}
      <li>Bigger and brighter: named in more verses{layers.length > 1 ? " (each book on its own scale)" : ""}. Not to scale.</li>
    </ul>
  );
}

function HeatMap({ outline, layers, pick }: { outline: MapOutline | null; layers: Layer[]; pick: (id: string) => void }) {
  const control = useRef<MapApi | null>(null);

  // Each layer on its own scale (log, so one great city doesn't hide the rest)
  const glows: MapGlow[] = useMemo(() => {
    const out: MapGlow[] = [];
    for (const l of layers) {
      const max = l.rows.length ? l.rows[0].n : 1;
      const k = Math.log(1 + max) || 1;
      // (the least named first, so the strongest glows are drawn on top)
      for (let i = l.rows.length - 1; i >= 0; i--) {
        const { p, n } = l.rows[i];
        out.push({ id: p.id, x: p.x!, y: p.y!, t: Math.log(1 + n) / k, tone: l.tone });
      }
    }
    return out;
  }, [layers]);

  // The most named places of each layer as dots (tap for the place's card)
  const dots: MapDot[] = useMemo(() => {
    const seen = new Set<string>();
    const out: MapDot[] = [];
    for (const l of layers)
      for (const { p, n } of l.rows.slice(0, TOP))
        if (!seen.has(p.id)) {
          seen.add(p.id);
          out.push({ id: p.id, n: p.n, x: p.x!, y: p.y!, c: p.c, a: p.a, w: n });
        }
    return out;
  }, [layers]);

  const home = fitBox(dots, 300);
  const key = layers.map((l) => l.book).join("+");
  useEffect(() => {
    control.current?.set(fitBox(dots, 300));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the books change
  }, [key]);

  const names = layers.map((l) => l.name).join(" and ");
  return (
    <MapView
      outline={outline}
      initial={home}
      home={home}
      homeLabel="Back to the most named places"
      dots={dots}
      picked={null}
      pick={pick}
      glows={glows}
      controlRef={control}
      label={`Heat map of the places named in ${names}`}
    />
  );
}

function TopList({ layer, openPlace }: { layer: Layer; openPlace: (id: string) => void }) {
  const top = layer.rows.slice(0, TOP);
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Swatch tone={layer.tone} /> Most named in {layer.book === ALL ? "the whole Bible" : layer.name}
      </h2>
      {top.length === 0 ? (
        <p className="text-sm text-muted">{layer.name} names no places that can be found on a map.</p>
      ) : (
        <ol className="divide-y divide-line rounded-xl border border-line bg-panel">
          {top.map(({ p, n }, i) => (
            <li key={p.id}>
              <button
                onClick={() => openPlace(p.id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-raised"
              >
                <span className="text-ink">
                  <span className="mr-2 text-xs text-faint">{i + 1}.</span>
                  {p.n}
                  {p.t === "region" ? <span className="text-xs text-faint"> (region)</span> : p.a ? <span className="text-xs text-faint"> (wide area)</span> : null}
                  {p.c === 0 ? <span className="text-xs text-faint"> (location uncertain)</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {n} {n === 1 ? "verse" : "verses"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {layer.rows.length > TOP && <p className="mt-1 text-xs text-faint">{layer.rows.length} places on the map in all. Tap a name for its page.</p>}
    </div>
  );
}
