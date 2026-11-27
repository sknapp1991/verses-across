"use client";
/**
 * How far (Time and place, study lab, hub 7a62bb28): pick two places and see the straight-line (great-circle) distance
 * between them, in kilometres and miles, and roughly how many days that is on foot. Positions are OpenBible.info's
 * best-scored locations from the place index; the line on the map follows the great circle.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { noteLab } from "@/lib/lab-badges";
import { kmBetween, project, unproject, type IndexPlace, type MapOutline } from "@/lib/time-and-place";
import { MapView, WIDE, fitBox, type MapApi, type MapDot, type MapRoute } from "./time-and-place-map";
import { Search } from "./time-and-place-search";

/** About how far people walked in a day. */
const KM_A_DAY = 30;
const MILES_PER_KM = 0.621371;

const MILES_A_DAY = Math.round(KM_A_DAY * MILES_PER_KM);
/** Longer than this, a trip usually went partly by sea or by river and caravan routes: no walking estimate. */
const LONG_KM = 800;

/**
 * Quick picks, by OpenBible id. `traditional`: the label says "(traditional)" only while the place's best-scored
 * location in OpenBible's data is still that site (for Mount Sinai, Jebel Musa).
 */
const PICKS: { label: string; a: string; b: string; note?: string; bySea?: true; traditional?: string }[] = [
  { label: "Nazareth → Bethlehem", a: "af5884f", b: "a112427" },
  { label: "Jerusalem → Damascus", a: "a15257a", b: "a69c1d4" },
  { label: "Jerusalem → Rome", a: "a15257a", b: "afc8e7a", note: "Paul went from Caesarea to Italy mostly by ship (Acts 27 and 28).", bySea: true },
  {
    label: "Ur → Haran",
    a: "a6cf75c",
    b: "a6d9af3",
    note: "Ur here is southern Ur (Tell el-Muqayyar); 3 other locations have been proposed.",
  },
  { label: "Egypt (Goshen) → Sinai", a: "a60f092", b: "abfba2a", traditional: "Jebel Musa" },
];

const onMap = (p: IndexPlace) => p.x !== undefined;
const short = (id: string) => id.split("/")[0];

/** Points along the great circle between two map points (for the line). */
function arc(x1: number, y1: number, x2: number, y2: number, steps = 24): [number, number][] {
  const rad = Math.PI / 180;
  const vec = (x: number, y: number) => {
    const [lon, lat] = unproject(x, y);
    return [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
  };
  const p = vec(x1, y1);
  const q = vec(x2, y2);
  const w = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  if (w < 1e-4) return [
    [x1, y1],
    [x2, y2],
  ];
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const s1 = Math.sin((1 - f) * w) / Math.sin(w);
    const s2 = Math.sin(f * w) / Math.sin(w);
    const v = [s1 * p[0] + s2 * q[0], s1 * p[1] + s2 * q[1], s1 * p[2] + s2 * q[2]];
    out.push(project(Math.atan2(v[1], v[0]) / rad, Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad));
  }
  return out;
}

/** Days on foot, to the nearest half day. */
const halfDays = (km: number) => Math.round((km / KM_A_DAY) * 2) / 2;
const dayText = (d: number) => `${Math.floor(d)}${d > Math.floor(d) ? "½" : ""}`;

/** "about 3½ days". */
function days(km: number): string {
  const d = halfDays(km);
  if (d < 1) return "under a day";
  return `about ${dayText(d)} ${d === 1 ? "day" : "days"}`;
}

/** "more like 4½ to 5 days" with the road allowance (20 to 40% longer), rounded the same way. */
function roadDays(km: number): string {
  const lo = halfDays(km * 1.2);
  const hi = halfDays(km * 1.4);
  if (hi < 1) return "still about a day or less";
  const from = Math.max(1, lo);
  return from === hi ? `more like ${dayText(hi)} ${hi === 1 ? "day" : "days"}` : `more like ${dayText(from)} to ${dayText(hi)} days`;
}

export function Distance({
  outline,
  index,
  failed,
  retry,
  want,
  pick,
}: {
  outline: MapOutline | null;
  index: IndexPlace[] | null;
  failed: boolean;
  retry: () => void;
  want: () => void;
  /** A dot on the map: show the place's card. */
  pick: (id: string) => void;
}) {
  const [aId, setAId] = useState(PICKS[0].a);
  const [bId, setBId] = useState(PICKS[0].b);
  const control = useRef<MapApi | null>(null);

  const byAid = useMemo(() => new Map((index ?? []).map((p) => [short(p.id), p])), [index]);
  const a = byAid.get(aId) ?? null;
  const b = byAid.get(bId) ?? null;
  const both = a && b && a.x !== undefined && b.x !== undefined ? ([a, b] as const) : null;
  const km = both ? kmBetween(both[0].x!, both[0].y!, both[1].x!, both[1].y!) : 0;
  const thisPick = PICKS.find((p) => p.a === aId && p.b === bId);
  const pickNote = thisPick?.note;
  const long = km > LONG_KM;
  // Quick picks whose places are in the data (all of them, unless a rebuild drops one)
  const picks = PICKS.filter((p) => !index || (byAid.has(p.a) && byAid.has(p.b))).map((p) => ({
    ...p,
    label: p.traditional && byAid.get(p.b)?.m === p.traditional ? `${p.label} (traditional)` : p.label,
  }));
  /** A place chosen in a search box (the Cartographer badge counts it; the default pair and quick picks don't). */
  const chosen = (id: string) => {
    noteLab("places", short(id));
    return short(id);
  };

  const dots: MapDot[] = useMemo(
    () => (both ? both.map((p) => ({ id: p.id, n: p.n, x: p.x!, y: p.y!, c: p.c, a: p.a })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the two places
    [a, b],
  );
  const kmLabel = `${Math.round(km).toLocaleString("en")} km`;
  const routes: MapRoute[] = useMemo(
    () => (both && km >= 1 ? [{ id: "line", pts: arc(both[0].x!, both[0].y!, both[1].x!, both[1].y!), kind: "main", label: kmLabel }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the two places
    [a, b],
  );
  const home = dots.length ? fitBox(dots, 120) : WIDE;
  const pairKey = `${aId}>${bId}:${dots.length}`;
  useEffect(() => {
    if (dots.length) control.current?.flyTo(fitBox(dots, 120));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the pair changes
  }, [pairKey]);

  const choosePair = (x: string, y: string) => {
    setAId(x);
    setBId(y);
  };

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <p className="text-sm text-muted">Pick two places to see how far apart they are.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <PlaceBox
            which="From"
            place={a}
            index={index}
            failed={failed}
            retry={retry}
            want={want}
            choose={(id) => setAId(chosen(id))}
            idPrefix="tp-far-a"
          />
          <button
            onClick={() => choosePair(bId, aId)}
            className="min-h-11 rounded-xl border border-line bg-paper px-3 text-sm text-ink hover:bg-raised"
            aria-label="Swap the two places"
          >
            ⇄ Swap
          </button>
          <PlaceBox
            which="To"
            place={b}
            index={index}
            failed={failed}
            retry={retry}
            want={want}
            choose={(id) => setBId(chosen(id))}
            idPrefix="tp-far-b"
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Quick picks</p>
          <ul className="flex flex-wrap gap-2">
            {picks.map((p) => {
              const on = p.a === aId && p.b === bId;
              return (
                <li key={p.label}>
                  <button
                    onClick={() => choosePair(p.a, p.b)}
                    className={`min-h-9 rounded-full border px-3 text-sm ${
                      on ? "border-accent bg-accent text-accent-ink" : "border-line bg-paper text-ink hover:bg-raised"
                    }`}
                  >
                    {p.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {failed ? (
        <p className="rounded-xl bg-panel p-4 text-sm text-muted">
          The places couldn&apos;t be loaded.{" "}
          <button className="text-accent hover:underline" onClick={retry}>
            Try again
          </button>
        </p>
      ) : !index ? (
        <p className="text-sm text-muted">Loading places…</p>
      ) : (
        both && (
          <article className="space-y-2 rounded-2xl border border-accent bg-panel p-4" aria-live="polite">
            <h2 className="font-serif text-xl font-semibold text-ink">
              {both[0].n} to {both[1].n}
            </h2>
            {aId === bId ? (
              <p className="text-sm text-muted">That&apos;s the same place twice. Pick another one.</p>
            ) : km < 1 ? (
              <p className="text-sm text-muted">
                These two are at the same spot on the map
                {both[0].m && both[0].m === both[1].m ? ` (both identified with ${both[0].m})` : ""}, so there&apos;s no distance to show.
              </p>
            ) : (
              <>
                <p className="text-ink">
                  <span className="font-serif text-3xl font-semibold">{kmLabel}</span>{" "}
                  <span className="text-muted">({Math.round(km * MILES_PER_KM).toLocaleString("en")} miles) in a straight line</span>
                </p>
                {pickNote && <p className="text-sm text-ink">{pickNote}</p>}
                {long && !thisPick?.bySea && (
                  <p className="text-sm text-ink">
                    Over a distance like this, travellers often went partly by sea or along river and caravan routes, so a walking time
                    would mislead.
                  </p>
                )}
                {!long && !pickNote && (
                  <p className="text-sm text-ink">
                    On foot, at about {KM_A_DAY} km ({MILES_A_DAY} miles) a day: {days(km)} in a straight line. Real roads were longer, often 20
                    to 40% more, so {roadDays(km)}.
                  </p>
                )}
                <p className="text-xs text-faint">
                  This is the straight-line (great-circle) distance between the two map points, an estimate, not the way anyone actually
                  travelled.
                </p>
                <Caveats place={both[0]} />
                <Caveats place={both[1]} />
              </>
            )}
          </article>
        )
      )}

      <MapView
        outline={outline}
        initial={home}
        home={home}
        homeLabel="Back to the two places"
        dots={dots}
        picked={null}
        pick={pick}
        routes={routes}
        controlRef={control}
        label={both ? `Map: ${both[0].n} to ${both[1].n}, ${kmLabel} in a straight line` : "Map"}
      />
    </section>
  );
}

/** Notes on a place's location: uncertain, a region (a rough centre), other proposals. */
function Caveats({ place }: { place: IndexPlace }) {
  const notes: string[] = [];
  if (place.c === 0) notes.push("location uncertain");
  // (only real wide areas: a place OpenBible types as a region but marks with a single point, like Ur, isn't one)
  if (place.a) notes.push(`${place.t === "region" ? "a region" : "a wider area (such as a river or a range)"}, so the distance is to a rough centre`);
  if (place.o) notes.push(`${place.o === 1 ? "one other location has" : `${place.o} other locations have`} also been proposed`);
  if (!notes.length) return null;
  return (
    <p className="text-xs text-muted">
      <span className="font-semibold text-ink">{place.n}</span>
      {place.m && place.m !== place.n ? ` (${place.m})` : ""}: {notes.join("; ")}.
    </p>
  );
}

function PlaceBox({
  which,
  place,
  index,
  failed,
  retry,
  want,
  choose,
  idPrefix,
}: {
  which: string;
  place: IndexPlace | null;
  index: IndexPlace[] | null;
  failed: boolean;
  retry: () => void;
  want: () => void;
  choose: (id: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted">
        {which}: <span className="text-ink">{place ? place.n : "…"}</span>
        {place?.m && place.m !== place.n ? <span className="font-normal text-faint"> ({place.m})</span> : null}
      </p>
      <Search
        index={index}
        failed={failed}
        retry={retry}
        want={want}
        choose={choose}
        idPrefix={idPrefix}
        label={`${which}: find a place`}
        placeholder="Type a place name…"
        only={onMap}
      />
    </div>
  );
}
