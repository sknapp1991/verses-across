"use client";
/**
 * Eras (Time and place, study lab, hub 7a62bb28): a slider across the periods of the biblical story. The map lights
 * up the places named in the chapters set in that era, over soft shapes for the rough reach of the main powers of the
 * time (hand-drawn, approximate; src/lib/time-and-place-eras.ts).
 */
import { useMemo, useState } from "react";
import { project, spanLabel, type IndexPlace, type MapOutline } from "@/lib/time-and-place";
import { ERAS, POWERS } from "@/lib/time-and-place-eras";
import { MapView, WIDE, type MapDot, type MapRegion } from "./time-and-place-map";

export function Eras({
  outline,
  index,
  picked,
  pick,
}: {
  outline: MapOutline | null;
  index: IndexPlace[] | null;
  picked: string | null;
  pick: (id: string) => void;
}) {
  const [ei, setEi] = useState(3);
  const era = ERAS[ei];

  const dots: MapDot[] = useMemo(() => {
    if (!index) return [];
    const bit = 1 << ei;
    return index
      .filter((p) => p.x !== undefined && ((p.e ?? 0) & bit) !== 0)
      .map((p) => ({ id: p.id, n: p.n, x: p.x!, y: p.y!, c: p.c, a: p.a, w: p.w }));
  }, [index, ei]);

  const regions: MapRegion[] = useMemo(
    () =>
      era.powers.map((id, i) => {
        const pw = POWERS[id];
        const d = pw.shape.map(([lon, lat], k) => `${k ? "L" : "M"}${project(lon, lat).join(" ")}`).join("") + "Z";
        const [lx, ly] = project(pw.label[0], pw.label[1]);
        return { id, d, label: pw.name, sub: pw.when, lx, ly, tone: i % 2 };
      }),
    [era],
  );

  return (
    <section className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-line bg-panel p-4">
        <label className="block">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-serif text-xl font-semibold text-ink">{era.name}</span>
            <span className="text-sm text-muted">c. {spanLabel(era.span)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={ERAS.length - 1}
            step={1}
            value={ei}
            onChange={(e) => setEi(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
            aria-valuetext={`${era.name}, ${spanLabel(era.span)}`}
          />
        </label>
        <div className="flex justify-between text-[10px] text-faint" aria-hidden>
          <span>Patriarchs</span>
          <span>Rome</span>
        </div>
        <p className="text-sm text-ink">{era.dates}</p>
        {era.note && <p className="text-sm text-muted">{era.note}</p>}
        <ul className="space-y-1 text-sm text-muted">
          {regions.map((g) => (
            <li key={g.id} className="flex items-center gap-2">
              <span
                className={`inline-block h-3 w-5 rounded-sm border border-dashed ${g.tone ? "border-muted bg-raised" : "border-accent bg-accent-soft"}`}
                aria-hidden
              />
              <span>
                <span className="font-semibold text-ink">{g.label}</span>: {g.sub} (approximate reach)
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-faint">
          {index ? `${dots.length} places named in the books and chapters set in this era.` : "Loading places…"} Shapes are rough sketches of
          each power&apos;s reach, not borders.
        </p>
      </div>

      <MapView
        outline={outline}
        initial={WIDE}
        home={WIDE}
        homeLabel="The whole region"
        dots={dots}
        picked={picked}
        pick={pick}
        regions={regions}
        label={`${era.name}: ${dots.length} places`}
      />
    </section>
  );
}
