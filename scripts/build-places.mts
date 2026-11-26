/**
 * Time and place (study lab, hub 7a62bb28): builds public/places/<book>.json (the places each Bible book names, with
 * coordinates and KJV verses) and public/places/map.json (a small land, lake and river outline for the map).
 *
 * Sources, downloaded once into data/raw/places/ (gitignored):
 * - OpenBible.info Bible Geocoding Data, CC BY 4.0 (https://github.com/openbibleinfo/Bible-Geocoding-Data):
 *   data/raw/places/ancient.jsonl
 * - Natural Earth 1:10m land, lakes, rivers, public domain (https://www.naturalearthdata.com):
 *   data/raw/places/naturalearth/ne_10m_{land,lakes,rivers_lake_centerlines}.geojson
 *
 * Run: npx tsx scripts/build-places.mts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PROJ, project } from "../src/lib/time-and-place";

const RAW = "data/raw/places";
const OUT = "public/places";
mkdirSync(OUT, { recursive: true });

/* ---------------- places ---------------- */

type Verse = {
  osis: string;
  usx: string;
  translations?: string[];
  alternate_verses?: Record<string, string>;
};
type Ancient = {
  id: string;
  friendly_id: string;
  url_slug: string;
  types?: string[];
  translation_name_counts?: Record<string, number>;
  modern_associations?: Record<string, { identification_ids: [number, number][]; name: string; score: number }>;
  identifications: {
    resolutions?: { lonlat?: string; lonlat_type?: string; type?: string }[];
    special?: string;
    score?: { time_total?: number };
  }[];
  verses?: Verse[];
};

const OSIS_TO_USX: Record<string, string> = {};
const ancient: Ancient[] = readFileSync(`${RAW}/ancient.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
for (const p of ancient) for (const v of p.verses ?? []) OSIS_TO_USX[v.osis.split(".")[0]] = v.usx.split(" ")[0].toLowerCase();

const kjvCache = new Map<string, Record<string, Map<string, string>>>();
function kjv(book: string) {
  let b = kjvCache.get(book);
  if (!b) {
    b = {};
    const path = `public/texts/bible/kjv/${book}.json`;
    if (existsSync(path)) {
      const j = JSON.parse(readFileSync(path, "utf8")) as {
        chapters: Record<string, { verses: { v: string; t: string }[] }>;
      };
      for (const [c, ch] of Object.entries(j.chapters)) b[c] = new Map(ch.verses.map((x) => [x.v, x.t]));
    }
    kjvCache.set(book, b);
  }
  return b;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A place in one book's file. c: 2 widely agreed, 1 likely, 0 uncertain. */
type OutPlace = {
  id: string;
  n: string; // name as the KJV spells it (when found in the KJV verses)
  m?: string; // the modern location it is identified with
  x?: number;
  y?: number;
  c: number;
  o?: number; // how many other proposed locations
  a?: 1; // the point stands for a wider area (a region, a river, a circle of uncertainty)
  t?: string; // kind of place
  u?: string; // why it is not on the map
  v: Record<string, number[]>; // chapter → KJV verses that name it
};

const UNPLACED: Record<string, string> = {
  unknown_place: "location unknown",
  nonspecific_place: "not a specific place",
  multiple_locations: "more than one place",
};

/**
 * Names used as symbols, where OpenBible's best match is an interpretation rather than a location: kept off the map
 * with a neutral note (by OpenBible id).
 */
const SYMBOLIC: Record<string, string> = {
  ae5ede9: "many readers take Babylon here as a name for Rome; that is an interpretation, not a location", // 1 Peter 5:13
  a3f0756: "many readers take Babylon here as a name for Rome; that is an interpretation, not a location", // Revelation
};

const books: Record<string, OutPlace[]> = {};
let placed = 0;
let unplaced = 0;
for (const p of ancient) {
  // Verses where the KJV names this place (KJV versification when it differs)
  const byBook: Record<string, Record<string, number[]>> = {};
  const kjvNames: Record<string, Record<string, number>> = {}; // book → spelling → verses
  // (people words like "Arbathite" or "Jews" are not the place's name)
  const names = Object.keys(p.translation_name_counts ?? {}).filter((n) => !/(ites?|ians?|Jews|Jewish.*|Jewry)$/.test(n));
  for (const v of p.verses ?? []) {
    if (!v.translations?.includes("kjv")) continue;
    const osis = v.alternate_verses?.kjv ?? v.osis;
    const [ob, c, vs] = osis.split(".");
    const book = OSIS_TO_USX[ob];
    if (!book) continue;
    ((byBook[book] ??= {})[c] ??= []).push(Number(vs));
    const text = kjv(book)[c]?.get(vs)?.replace(/æ/g, "ae").replace(/Æ/g, "Ae");
    if (text) {
      const counts = (kjvNames[book] ??= {});
      for (const n of names) if (new RegExp(`(^|[^A-Za-z])${esc(n)}([^A-Za-z]|$)`).test(text)) counts[n] = (counts[n] ?? 0) + 1;
    }
  }
  if (!Object.keys(byBook).length) continue;
  // The KJV spelling, book by book (Genesis says Ararat, 2 Kings Armenia); the most common one overall as a fallback
  const spell = (counts: Record<string, number> | undefined) =>
    Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0];
  const all: Record<string, number> = {};
  for (const counts of Object.values(kjvNames)) for (const [n, k] of Object.entries(counts)) all[n] = (all[n] ?? 0) + k;
  const kjvName = spell(all);
  const name = kjvName ?? p.friendly_id.replace(/ \d+$/, "");

  // Best-scored identification (OpenBible's score: 500+ means scholars broadly agree)
  const assoc = Object.values(p.modern_associations ?? {}).sort((a, b) => b.score - a.score);
  let out: OutPlace = {
    id: `${p.id}/${p.url_slug}`,
    n: name,
    c: 0,
    v: {},
    t: p.types?.[0],
  };
  const best = assoc[0];
  const [i, r] = best?.identification_ids[0] ?? [-1, -1];
  const res = i >= 0 ? p.identifications[i]?.resolutions?.[r] : undefined;
  // A "special" answer (location unknown, not a place…) that sources favour over every proposed location wins
  const specials = p.identifications.filter((d) => d.special).sort((a, b) => (b.score?.time_total ?? 0) - (a.score?.time_total ?? 0));
  const special = specials[0];
  // (like with like: both sides are an identification's own time-weighted score, before any path adjustment)
  const specialWins = !!special && (!best || (special.score?.time_total ?? 0) > (p.identifications[i]?.score?.time_total ?? 0));
  const symbolic = SYMBOLIC[p.id];
  if (symbolic) {
    out.u = symbolic;
    unplaced++;
  } else if (best && res?.lonlat && !specialWins) {
    const [lon, lat] = res.lonlat.split(",").map(Number);
    const [x, y] = project(lon, lat);
    const others = assoc.filter((a) => a !== best && a.score > 0).length;
    out = {
      ...out,
      m: best.name,
      x,
      y,
      // Sureness from OpenBible's association score (readme, "Modern associations"; roughly 0 to 1000): its readme
      // calls 500 or more high confidence, so 500+ with no rival location is "widely agreed"; 300 is our own midpoint
      // between that and the weakly supported proposals (the median place scores about 330), labelled "likely".
      c: best.score >= 500 && others === 0 ? 2 : best.score >= 300 ? 1 : 0,
      ...(others ? { o: others } : {}),
      ...(res.lonlat_type && res.lonlat_type !== "point" ? { a: 1 as const } : {}),
    };
    placed++;
  } else {
    const why = special?.special;
    if (!why || why === "not_a_place" || why === "not_a_proper_name") continue;
    out.u = UNPLACED[why] ?? "location unknown";
    unplaced++;
  }
  if (!out.t) delete out.t;
  for (const [book, chapters] of Object.entries(byBook)) {
    for (const vs of Object.values(chapters)) vs.sort((a, b) => a - b);
    (books[book] ??= []).push({
      ...out,
      n: spell(kjvNames[book]) ?? name,
      v: chapters,
    });
  }
}

let bytes = 0;
for (const [book, list] of Object.entries(books)) {
  list.sort((a, b) => a.n.localeCompare(b.n));
  const s = JSON.stringify({ places: list });
  bytes += s.length;
  writeFileSync(`${OUT}/${book}.json`, s);
}
console.log(`places: ${placed} placed, ${unplaced} unplaced; ${Object.keys(books).length} books, ${(bytes / 1024).toFixed(0)} KB`);

/* ---------------- the map outline (Natural Earth) ---------------- */

type Ring = number[][];
const [W, S, E, N] = PROJ.bbox;

/** Sutherland-Hodgman clip of a closed ring to the map box. */
function clipRing(ring: Ring): Ring {
  const edges: [(p: number[]) => boolean, (a: number[], b: number[]) => number[]][] = [
    [(p) => p[0] >= W, (a, b) => [W, a[1] + ((b[1] - a[1]) * (W - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= E, (a, b) => [E, a[1] + ((b[1] - a[1]) * (E - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= S, (a, b) => [a[0] + ((b[0] - a[0]) * (S - a[1])) / (b[1] - a[1]), S]],
    [(p) => p[1] <= N, (a, b) => [a[0] + ((b[0] - a[0]) * (N - a[1])) / (b[1] - a[1]), N]],
  ];
  let out = ring;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const cur = input[k];
      const prev = input[(k + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out;
}

/** Douglas-Peucker in projected units; points in the detail box (the Levant, where most chapters zoom in) keep more. */
const [DW, DS, DE, DN] = PROJ.detailBox;
const [dx0, dy1] = project(DW, DS);
const [dx1, dy0] = project(DE, DN);
const inDetail = (p: number[]) => p[0] >= dx0 && p[0] <= dx1 && p[1] >= dy0 && p[1] <= dy1;
function simplify(pts: number[][], tol: number, fine = tol): number[][] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let k = a + 1; k < b; k++) {
      const d = len ? Math.abs(dy * pts[k][0] - dx * pts[k][1] + bx * ay - by * ax) / len : Math.hypot(pts[k][0] - ax, pts[k][1] - ay);
      if (d > worst) {
        worst = d;
        at = k;
      }
    }
    if (at >= 0 && worst > (inDetail(pts[at]) ? fine : tol)) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

function toPath(rings: number[][][], closed: boolean): string {
  let d = "";
  for (const r of rings) {
    let px = 0;
    let py = 0;
    r.forEach(([x, y], k) => {
      d += k === 0 ? `M${x} ${y}` : `l${x - px} ${y - py}`;
      px = x;
      py = y;
    });
    if (closed) d += "z";
  }
  return d.replace(/l0 0/g, "");
}

const inBox = (b: number[]) => b[0] < E && b[2] > W && b[1] < N && b[3] > S;
const projRing = (r: Ring) => r.map(([lon, lat]) => project(lon, lat));
const area = (r: number[][]) =>
  Math.abs(r.reduce((s, [x, y], k) => s + x * r[(k + 1) % r.length][1] - r[(k + 1) % r.length][0] * y, 0) / 2);

type Feature = {
  properties: Record<string, unknown>;
  bbox?: number[];
  geometry: { type: string; coordinates: unknown } | null;
};
const load = (f: string) =>
  (
    JSON.parse(readFileSync(`${RAW}/naturalearth/${f}.geojson`, "utf8")) as {
      features: Feature[];
    }
  ).features;
const bboxOf = (coords: unknown): number[] => {
  const flat = JSON.stringify(coords)
    .match(/-?\d+(\.\d+)?(e-?\d+)?/g)!
    .map(Number);
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < flat.length; k += 2) {
    b[0] = Math.min(b[0], flat[k]);
    b[2] = Math.max(b[2], flat[k]);
    b[1] = Math.min(b[1], flat[k + 1]);
    b[3] = Math.max(b[3], flat[k + 1]);
  }
  return b;
};

function polygons(features: Feature[], tol: number, minArea: number, keepFeature: (f: Feature) => boolean = () => true) {
  const rings: number[][][] = [];
  for (const f of features) {
    if (!f.geometry || !keepFeature(f)) continue;
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
    for (const poly of polys)
      for (const ring of poly) {
        if (!inBox(bboxOf(ring))) continue;
        const clipped = clipRing(ring);
        if (clipped.length < 3) continue;
        const s = simplify(projRing(clipped), tol, 0.6);
        if (s.length >= 3 && area(s) >= (inDetail(s[0]) ? 0.5 : minArea * 20)) rings.push(s);
      }
  }
  return rings;
}

function lines(features: Feature[], tol: number, keepFeature: (f: Feature) => boolean) {
  const out: number[][][] = [];
  for (const f of features) {
    if (!f.geometry || !keepFeature(f)) continue;
    const parts = (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[];
    for (const part of parts) {
      const inside = part.filter(([lon, lat]) => lon >= W && lon <= E && lat >= S && lat <= N);
      if (inside.length < 2) continue;
      const s = simplify(projRing(inside), tol, 0.6);
      if (s.length >= 2) out.push(s);
    }
  }
  return out;
}

// Coarse for the wide view, finer for the land of Israel and around it
const land = polygons(load("ne_10m_land"), 5, 1);
const lakes = polygons(
  load("ne_10m_lakes"),
  4,
  1,
  (f) => Number(f.properties.scalerank) <= 6 || inDetail(project(...(bboxOf(f.geometry!.coordinates).slice(0, 2) as [number, number]))),
);
const rivers = lines(load("ne_10m_rivers_lake_centerlines"), 4, (f) => {
  const rank = Number(f.properties.scalerank);
  const name = String(f.properties.name ?? "");
  return rank <= 3 || /^(Jordan|Orontes|Euphrates|Tigris|Nile|Litani|Yarmuk|Kızılırmak)/i.test(name);
});

const map = {
  land: toPath(land, true),
  lakes: toPath(lakes, true),
  rivers: toPath(rivers, false),
};
const ms = JSON.stringify(map);
writeFileSync(`${OUT}/map.json`, ms);
console.log(`map: ${land.length} land rings, ${lakes.length} lakes, ${rivers.length} rivers, ${(ms.length / 1024).toFixed(0)} KB`);
