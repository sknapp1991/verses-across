"use client";
/**
 * Journeys (Time and place, study lab, hub 7a62bb28): a route drawn on the map and played stop by stop, the map
 * following, each stop with its KJV verses. Stops and references are curated in src/lib/time-and-place-journeys.ts
 * and resolved (coordinates, checked references) into public/places/journeys.json by scripts/build-places.mts.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { findBook, readHref } from "@/lib/catalog";
import { fetchBook, type BookFile } from "@/lib/chapter-store";
import { noteLab } from "@/lib/lab-badges";
import { SURE_LABEL, type MapOutline } from "@/lib/time-and-place";
import type { Journey } from "@/lib/time-and-place-journeys";
import { MapView, fitBox, loadJson, type MapApi, type MapDot, type MapRoute } from "./time-and-place-map";

const STEP_MS = 3500;
const field = "min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-ink";

export function Journeys({ outline, openPlace }: { outline: MapOutline | null; openPlace: (id: string) => void }) {
  const [data, setData] = useState<Journey[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [jid, setJid] = useState("abraham");
  const [ri, setRi] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [texts, setTexts] = useState<Record<string, BookFile>>({});
  const control = useRef<MapApi | null>(null);

  useEffect(() => {
    let live = true;
    loadJson<Journey[]>("/places/journeys.json").then(
      (d) => {
        if (live) {
          setData(d);
          setFailed(!d || !d.length); // (a missing file is a failure, not endless loading)
        }
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const journey = data?.find((j) => j.id === jid) ?? data?.[0] ?? null;
  const route = journey ? (journey.routes[ri] ?? journey.routes[0]) : null;
  const stops = useMemo(() => route?.stops ?? [], [route]);
  const at = Math.min(step, Math.max(0, stops.length - 1));
  const stop = stops[at];
  const stopId = stop?.id;
  useEffect(() => {
    if (stopId) noteLab("places", stopId.split("/")[0]); // (the Cartographer badge: each place once)
  }, [stopId]);

  const choose = (id: string, r = 0) => {
    setJid(id);
    setRi(r);
    setStep(0);
    setPlaying(false);
  };

  // The map follows: the whole route when a journey or route is chosen, then each leg
  const routeKey = `${journey?.id}:${route?.id}`;
  const lastRoute = useRef("");
  useEffect(() => {
    const c = control.current;
    if (!c || !stops.length) return;
    if (lastRoute.current !== routeKey) {
      lastRoute.current = routeKey;
      c.set(fitBox(stops, 300));
      return;
    }
    const leg = at > 0 ? [stops[at - 1], stops[at]] : [stops[at]];
    c.flyTo(fitBox(leg, 320));
  }, [routeKey, at, stops]);

  // Play: one stop every few seconds, stopping at the end
  useEffect(() => {
    if (!playing) return;
    if (at >= stops.length - 1) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep(at + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, at, stops.length]);

  // KJV text for this stop's verses
  const needBooks = useMemo(() => Array.from(new Set((stop?.r ?? []).map((r) => r[0]))), [stop]);
  useEffect(() => {
    let live = true;
    for (const b of needBooks)
      if (!texts[b])
        fetchBook("bible", "kjv", b)
          .then((bf) => live && setTexts((t) => ({ ...t, [b]: bf })))
          .catch(() => {});
    return () => {
      live = false;
    };
  }, [needBooks, texts]);

  const dots: MapDot[] = useMemo(() => stops.map((s, i) => ({ id: `${s.id}#${i}`, n: s.n, x: s.x, y: s.y, c: s.c, num: i + 1 })), [stops]);
  const routes: MapRoute[] = useMemo(() => {
    if (!journey || !route) return [];
    const out: MapRoute[] = [];
    journey.routes.forEach((r) => {
      if (r.id === route.id) return;
      out.push({ id: r.id, pts: r.stops.map((s) => [s.x, s.y] as [number, number]), kind: "alt", label: r.label });
    });
    const pts = stops.map((s) => [s.x, s.y] as [number, number]);
    out.push({ id: `${route.id}-ahead`, pts: pts.slice(at), kind: "ahead" });
    out.push({ id: `${route.id}-done`, pts: pts.slice(0, at + 1), kind: "main" });
    return out;
  }, [journey, route, stops, at]);

  if (failed)
    return (
      <p className="rounded-xl bg-panel p-4 text-sm text-muted">
        The journeys couldn&apos;t be loaded.{" "}
        <button className="text-accent hover:underline" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </button>
      </p>
    );
  if (!data || !journey || !route || !stop) return <p className="text-sm text-muted">Loading journeys…</p>;

  const name = (b: string) => findBook("bible", b)?.name ?? b;
  const verse = (b: string, c: number, v: number) => texts[b]?.chapters[String(c)]?.verses.find((x) => x.v === String(v))?.t;
  const btn = "min-h-11 rounded-xl border border-line bg-panel px-3 text-sm text-ink hover:bg-raised disabled:opacity-40";

  return (
    <section className="space-y-4">
      <label className="block">
        <span className="sr-only">Journey</span>
        <select className={field} value={journey.id} onChange={(e) => choose(e.target.value)}>
          {data.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-muted">{journey.summary}</p>
      {journey.caution && <p className="rounded-xl bg-accent-soft p-3 text-sm text-ink">{journey.caution}</p>}
      {journey.routes.length > 1 && (
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Proposed route"
          onKeyDown={(e) => {
            const n = journey.routes.length;
            const cur = journey.routes.indexOf(route);
            const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const next = (cur + d + n) % n;
            choose(journey.id, next);
            const btns = e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
            btns[next]?.focus();
          }}
        >
          {journey.routes.map((r, i) => (
            <button
              key={r.id}
              role="radio"
              aria-checked={r.id === route.id}
              tabIndex={r.id === route.id ? 0 : -1}
              onClick={() => choose(journey.id, i)}
              className={`min-h-10 rounded-full border px-3 text-sm ${
                r.id === route.id ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-ink hover:bg-raised"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {route.note && <p className="text-xs text-muted">{route.note}</p>}

      <MapView
        outline={outline}
        initial={fitBox(stops, 300)}
        home={fitBox(stops, 300)}
        homeLabel="The whole route"
        dots={dots}
        picked={`${stop.id}#${at}`}
        pick={(id) => {
          const i = Number(id.split("#")[1]);
          if (Number.isFinite(i)) {
            setStep(i);
            setPlaying(false);
          }
        }}
        routes={routes}
        controlRef={control}
        label={`${journey.title}: ${stops.length} stops`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={btn}
          disabled={at === 0}
          onClick={() => {
            setPlaying(false);
            setStep(at - 1);
          }}
          aria-label="Previous stop"
        >
          ← Previous
        </button>
        <button
          className={`${btn} min-w-24 font-semibold`}
          onClick={() => {
            if (!playing && at >= stops.length - 1) setStep(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause" : at >= stops.length - 1 ? "Play again" : "Play"}
        </button>
        <button
          className={btn}
          disabled={at >= stops.length - 1}
          onClick={() => {
            setPlaying(false);
            setStep(at + 1);
          }}
          aria-label="Next stop"
        >
          Next →
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          Stop {at + 1} of {stops.length}
        </span>
      </div>

      <article className="space-y-3 rounded-2xl border border-line bg-panel p-4">
        <div>
          <h3 className="font-serif text-2xl font-semibold text-ink">
            {at + 1}. {stop.n}
          </h3>
          {stop.note && <p className="text-ink">{stop.note}</p>}
          {stop.g ? (
            <p className="text-sm text-muted">The region of {stop.n}: the dot only marks roughly where it lay.</p>
          ) : (
            <p className="text-sm text-muted">
              {stop.m && stop.m !== stop.n ? `Identified with ${stop.m}. ` : ""}
              <span className="font-semibold">{SURE_LABEL[stop.c]}</span>
              {stop.c === 0 ? ": this location is uncertain or one proposal among several." : "."}
              {stop.a ? " The dot marks a wider area (an island, a river or a stretch of country), not one spot." : ""}
            </p>
          )}
        </div>
        <ul className="space-y-2">
          {stop.r.map(([b, c, v0, v1]) => {
            const vs = Array.from({ length: v1 - v0 + 1 }, (_, k) => v0 + k);
            return (
              <li key={`${b}${c}:${v0}`} className="text-ink">
                <Link
                  href={readHref({ work: "bible", book: b, chapter: c }, ["kjv"], String(v0))}
                  className="mr-1 text-sm font-semibold text-accent hover:underline"
                >
                  {name(b)} {c}:{v0}
                  {v1 > v0 ? `-${v1}` : ""}
                </Link>
                <span className="font-serif">
                  {vs.map((v) => (
                    <span key={v}>
                      {vs.length > 1 && <sup className="mr-0.5 text-faint">{v}</sup>}
                      {verse(b, c, v) ?? "…"}{" "}
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-faint">KJV.</p>
        <button onClick={() => openPlace(stop.id)} className="text-sm text-accent hover:underline">
          Open the place page for {stop.n} →
        </button>
      </article>
    </section>
  );
}
