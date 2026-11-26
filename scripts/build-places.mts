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
import { gzipSync } from "node:zlib";
import { PROJ, project, type IndexPlace, type Place, type PlaceFile, type WaterLabel } from "../src/lib/time-and-place";
import { eraOf } from "../src/lib/time-and-place-eras";
import { JOURNEYS, type Journey, type JourneyStop } from "../src/lib/time-and-place-journeys";

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
  media?: { thumbnail?: { image_id?: string; description?: string } };
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

type OutPlace = Place; // (shape shared with the page: src/lib/time-and-place.ts)

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

mkdirSync(`${OUT}/p`, { recursive: true });
let placeFiles = 0;

/** Bit i set when a chapter set in era i names the place. */
function eraBits(byBook: Record<string, Record<string, number[]>>): number {
  let bits = 0;
  for (const [bk, ch] of Object.entries(byBook))
    for (const c of Object.keys(ch)) {
      const e = eraOf(bk, Number(c));
      if (e >= 0) bits |= 1 << e;
    }
  return bits;
}

/* Photos: OpenBible's image metadata (author, licence, Wikimedia Commons page) for each place's own thumbnail; only
   photos from Commons under an open licence (CC0, CC BY, CC BY-SA, public domain, Free Art License), never the
   satellite images or copyrighted ones. The page loads them from Wikimedia Commons. */
type ImageMeta = {
  id: string;
  author?: string;
  credit?: string;
  credit_url?: string;
  license?: string;
  thumbnail_url_pattern?: string;
  meters_per_pixel?: number;
  descriptions?: Record<string, string>;
};
const images = new Map<string, ImageMeta>();
for (const l of readFileSync(`${RAW}/image.jsonl`, "utf8").trim().split("\n")) {
  const im = JSON.parse(l) as ImageMeta;
  images.set(im.id, im);
}
// (never NC or ND: "CC-BY-NC-…" fails because "-N" is neither a digit nor the end)
const OPEN = /^(CC0|PD|FAL|CC-BY(-SA)?)(-\d|$)/i;
/** Wikimedia only serves thumbnails at its standard widths (hotlinks at other widths are refused). */
const THUMB_WIDTH = "500";
const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
const stripTags = (h: string) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
function photoOf(p: Ancient): PlaceFile["img"] | undefined {
  const id = p.media?.thumbnail?.image_id;
  const im = id ? images.get(id) : undefined;
  if (!im || im.meters_per_pixel || !im.license || !OPEN.test(im.license)) return undefined;
  const pattern = im.thumbnail_url_pattern;
  // (a real thumbnail, never the full-size original)
  if (!pattern?.startsWith("https://upload.wikimedia.org/") || !pattern.includes("/thumb/") || !pattern.includes("####")) return undefined;
  if (!im.credit_url?.startsWith("https://commons.wikimedia.org/")) return undefined;
  const by = decodeEntities(im.credit || im.author || "").trim();
  if (!by) return undefined;
  return {
    src: pattern.replace("####", THUMB_WIDTH),
    by,
    lic: im.license,
    url: im.credit_url,
    alt: decodeEntities(stripTags(p.media?.thumbnail?.description ?? Object.values(im.descriptions ?? {})[0] ?? "")),
  };
}

const books: Record<string, OutPlace[]> = {};
const index: IndexPlace[] = [];
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
  // The search index: every name it goes by, and the chapters that name it (books in canonical order)
  // (each book's own KJV spelling only: other names found in the same verses belong to other places)
  const variants = new Set<string>([name, p.friendly_id.replace(/ \d+$/, "")]);
  for (const counts of Object.values(kjvNames)) {
    const sp = spell(counts);
    if (sp) variants.add(sp);
  }
  if (out.m) variants.add(out.m);
  variants.delete(name);
  const { v: _v, ...rest } = out;
  void _v;
  index.push({
    ...rest,
    ...(variants.size ? { k: [...variants] } : {}),
    b: Object.entries(byBook).map(([book, chapters]) => [book, Object.keys(chapters).map(Number)] as [string, number[]]),
    w: Object.values(byBook).reduce((s, ch) => s + Object.values(ch).reduce((t, vs) => t + vs.length, 0), 0),
    e: eraBits(byBook),
  });
  // The place page's file: every KJV verse that names it, and a photo when an openly licensed one is known
  const file: PlaceFile = { v: Object.entries(byBook).map(([bk, ch]) => [bk, Object.entries(ch).map(([c, vs]) => [Number(c), [...vs].sort((x, y) => x - y)] as [number, number[]])]) };
  const photo = photoOf(p);
  if (photo) file.img = photo;
  writeFileSync(`${OUT}/p/${p.id}.json`, JSON.stringify(file));
  placeFiles++;
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
const is = JSON.stringify({ places: index });
writeFileSync(`${OUT}/index.json`, is);
/* ---------------- journeys ---------------- */

const byId = new Map(ancient.map((x) => [x.id, x]));
const indexById = new Map(index.map((x) => [x.id.split("/")[0], x]));
let journeyProblems = 0;
const journeys: Journey[] = JOURNEYS.map((j) => ({
  id: j.id,
  title: j.title,
  summary: j.summary,
  ...(j.caution ? { caution: j.caution } : {}),
  routes: j.routes.map((rt) => ({
    id: rt.id,
    label: rt.label,
    ...(rt.note ? { note: rt.note } : {}),
    stops: rt.stops.map((st): JourneyStop => {
      const ip = indexById.get(st.p);
      const raw = byId.get(st.p);
      if (!ip || !raw || ip.x === undefined) throw new Error(`journey ${j.id}: no place ${st.p}`);
      let x = ip.x;
      let y = ip.y!;
      let m = ip.m;
      let c = ip.c;
      if (st.modern) {
        const as = Object.values(raw.modern_associations ?? {}).find((q) => q.name === st.modern);
        const [ii, rr] = as?.identification_ids[0] ?? [-1, -1];
        const lonlat = ii >= 0 ? raw.identifications[ii]?.resolutions?.[rr]?.lonlat : undefined;
        if (!as || !lonlat) throw new Error(`journey ${j.id}: ${st.p} has no proposal "${st.modern}"`);
        const [lon, lat] = lonlat.split(",").map(Number);
        [x, y] = project(lon, lat);
        m = as.name;
        c = 0; // (one proposal among several)
      }
      const r: JourneyStop["r"] = [];
      for (const part of st.refs.split(";")) {
        const mm = /^\s*(\w+) (\d+):([\d,-]+)\s*$/.exec(part);
        if (!mm) throw new Error(`journey ${j.id}: bad reference "${part}"`);
        const [, bk, ch, spec] = mm;
        const verses = kjv(bk)[ch];
        for (const piece of spec.split(",")) {
          const [v0, v1 = v0] = piece.split("-").map(Number);
          for (let v = v0; v <= v1; v++)
            if (!verses?.has(String(v))) throw new Error(`journey ${j.id}: ${bk} ${ch}:${v} is not in the KJV`);
          r.push([bk, Number(ch), v0, v1]);
        }
        // (a warning, not an error: the place may be named a verse or two away, or only implied)
        if (!ip.b.some(([b2, cs]) => b2 === bk && cs.includes(Number(ch)))) {
          console.warn(`  note: ${j.id} stop ${ip.n} is not named in ${bk} ${ch} in the data`);
          journeyProblems++;
        }
      }
      return { id: ip.id, n: ip.n, ...(m ? { m } : {}), x, y, c, ...(st.modern ? {} : ip.t === "region" ? { g: 1 as const } : ip.a ? { a: 1 as const } : {}), r, ...(st.note ? { note: st.note } : {}) };
    }),
  })),
}));
const js = JSON.stringify(journeys);
writeFileSync(`${OUT}/journeys.json`, js);
console.log(`journeys: ${journeys.length}, ${(js.length / 1024).toFixed(0)} KB, ${journeyProblems} stops not named in their chapter (see notes)`);
console.log(`place files: ${placeFiles}, ${[...index].length} in the index`);

console.log(`index: ${index.length} places, ${(is.length / 1024).toFixed(0)} KB (${(gzipSync(is).length / 1024).toFixed(0)} KB gzipped)`);

/* ---------------- the map outline (Natural Earth), in two levels ---------------- */

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

/** Projected, unrounded (the detail level keeps a tenth of a unit). */
const projF = (lon: number, lat: number) => [(lon - W) * PROJ.k * PROJ.cos, (N - lat) * PROJ.k];
const boxTest = (box: number[]) => {
  const [a, b] = projF(box[0], box[3]);
  const [c, d] = projF(box[2], box[1]);
  return (p: number[]) => p[0] >= a && p[0] <= c && p[1] >= b && p[1] <= d;
};
const inLevant = boxTest(PROJ.detailBox);
const inRegion = boxTest(PROJ.regionBox);

/** A level: how far a simplified line may stray (in map units, ~km) in the Levant, the wider region, and elsewhere. */
type Level = { levant: number; region: number; rest: number; digits: number };
const OVERVIEW: Level = { levant: 1.5, region: 4, rest: 6, digits: 0 };
const DETAIL: Level = { levant: 0.15, region: 0.4, rest: 1.5, digits: 1 };
const tolAt = (lv: Level, p: number[]) => (inLevant(p) ? lv.levant : inRegion(p) ? lv.region : lv.rest);

/** Douglas-Peucker with a tolerance that depends on where the point is. */
function simplify(pts: number[][], lv: Level): number[][] {
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
    if (at >= 0 && worst > tolAt(lv, pts[at])) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

/** SVG path with relative moves, rounded to the level's precision. */
function toPath(rings: number[][][], closed: boolean, digits: number): string {
  const f = Math.pow(10, digits);
  let d = "";
  for (const r of rings) {
    let px = 0;
    let py = 0;
    let first = true;
    for (const [x0, y0] of r) {
      const x = Math.round(x0 * f);
      const y = Math.round(y0 * f);
      if (first) d += `M${x / f} ${y / f}`;
      else if (x !== px || y !== py) d += `l${(x - px) / f} ${(y - py) / f}`;
      first = false;
      px = x;
      py = y;
    }
    if (closed) d += "z";
  }
  return d;
}

const inBox = (b: number[]) => b[0] < E && b[2] > W && b[1] < N && b[3] > S;
const projRing = (r: Ring) => r.map(([lon, lat]) => projF(lon, lat));
const area = (r: number[][]) =>
  Math.abs(r.reduce((s, [x, y], k) => s + x * r[(k + 1) % r.length][1] - r[(k + 1) % r.length][0] * y, 0) / 2);

type Feature = {
  properties: Record<string, unknown>;
  bbox?: number[];
  geometry: { type: string; coordinates: unknown } | null;
};
const load = (f: string) => (JSON.parse(readFileSync(`${RAW}/naturalearth/${f}.geojson`, "utf8")) as { features: Feature[] }).features;
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

function polygons(features: Feature[], lv: Level, keepFeature: (f: Feature) => boolean = () => true) {
  const rings: number[][][] = [];
  for (const f of features) {
    if (!f.geometry || !keepFeature(f)) continue;
    const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
    for (const poly of polys)
      for (const ring of poly) {
        if (!inBox(bboxOf(ring))) continue;
        const clipped = clipRing(ring);
        if (clipped.length < 3) continue;
        const s = simplify(projRing(clipped), lv);
        // drop islets smaller than the level can show
        if (s.length >= 3 && area(s) >= tolAt(lv, s[0]) * tolAt(lv, s[0]) * 3) rings.push(s);
      }
  }
  return rings;
}

const named = (f: Feature) => String(f.properties.name ?? "");
function lines(features: Feature[], lv: Level, keepFeature: (f: Feature) => boolean) {
  const out: number[][][] = [];
  for (const f of features) {
    if (!f.geometry || !keepFeature(f)) continue;
    const parts = (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[];
    for (const part of parts) {
      const inside = part.filter(([lon, lat]) => lon >= W && lon <= E && lat >= S && lat <= N);
      if (inside.length < 2) continue;
      const s = simplify(projRing(inside), lv);
      if (s.length >= 2) out.push(s);
    }
  }
  return out;
}

const landF = load("ne_10m_land");
const lakesF = load("ne_10m_lakes");
const riversF = load("ne_10m_rivers_lake_centerlines");
// Natural lakes only (no modern reservoirs), and rivers without modern canals
const naturalLake = (f: Feature) =>
  !/reservoir/i.test(String(f.properties.featurecla ?? "")) && !/(Dam|Baraj|Assad|Nasser|Karakaya)/i.test(named(f));
const BIBLE_RIVERS = /^(Jordan|Orontes|Euphrates|Al Furat|Firat|Tigris|Dicle|Nile|Rosetta Branch|Damietta Branch|Litani|Yarmuk|Shatt al Arab)$/i;
const keepRiver = (rank: number) => (f: Feature) =>
  !/canal|channel/i.test(named(f)) && (BIBLE_RIVERS.test(named(f)) || Number(f.properties.scalerank) <= rank);

function level(lv: Level, lakeRank: number, riverRank: number) {
  const land = polygons(landF, lv);
  const lakes = polygons(lakesF, lv, (f) => naturalLake(f) && Number(f.properties.scalerank) <= lakeRank);
  const rivers = lines(riversF, lv, keepRiver(riverRank));
  return {
    land: toPath(land, true, lv.digits),
    lakes: toPath(lakes, true, lv.digits),
    rivers: toPath(rivers, false, lv.digits),
  };
}

/** Labels for water: a river's label sits on the river vertex nearest the hint; a lake's at its middle. */
function riverLabel(n: string, names: RegExp, hint: [number, number], z: number): WaterLabel | null {
  let best: number[] | null = null;
  let bestD = Infinity;
  for (const f of riversF) {
    if (!f.geometry || !names.test(named(f))) continue;
    const parts = (f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[];
    for (const part of parts)
      for (const p of part) {
        const d = Math.hypot(p[0] - hint[0], p[1] - hint[1]);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
  }
  if (!best) return null;
  const [x, y] = project(best[0], best[1]);
  return { n, x, y, k: "river", z };
}
function lakeLabel(n: string, name: string, z: number): WaterLabel | null {
  const fs = lakesF.filter((f) => named(f) === name && f.geometry);
  if (!fs.length) return null;
  const b = fs.map((f) => bboxOf(f.geometry!.coordinates)).reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])]);
  const [x, y] = project((b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  return { n, x, y, k: "lake", z };
}
const sea = (n: string, lon: number, lat: number, z: number): WaterLabel => {
  const [x, y] = project(lon, lat);
  return { n, x, y, k: "sea", z };
};
/** z: the widest view (in map units across) at which the label shows. */
const labels = [
  sea("Mediterranean Sea", 19, 34.6, 9999),
  sea("Black Sea", 34.5, 43.4, 9999),
  sea("Red Sea", 38.3, 20.8, 9999),
  sea("Persian Gulf", 51.3, 27.2, 9999),
  sea("Caspian Sea", 50.8, 41.8, 9999),
  sea("Aegean Sea", 25, 39.2, 2600),
  riverLabel("Nile", /^Nile$/, [32.0, 26.5], 4000),
  riverLabel("Euphrates", /^(Euphrates|Al Furat|Firat)$/, [41.2, 34.5], 4000),
  riverLabel("Tigris", /^(Tigris|Dicle)$/, [43.4, 35.2], 4000),
  riverLabel("Jordan", /^Jordan$/, [35.56, 32.3], 700),
  lakeLabel("Sea of Galilee", "Sea of Galilee", 500),
  lakeLabel("Dead Sea", "Dead Sea", 900),
].filter(Boolean) as WaterLabel[];

const overview = { ...level(OVERVIEW, 6, 3), labels };
const detail = level(DETAIL, 9, 6);
const os = JSON.stringify(overview);
const ds = JSON.stringify(detail);
writeFileSync(`${OUT}/map.json`, os);
writeFileSync(`${OUT}/map-detail.json`, ds);
const gz = (s: string) => (gzipSync(s).length / 1024).toFixed(0);
console.log(`map: overview ${(os.length / 1024).toFixed(0)} KB (${gz(os)} KB gzipped), detail ${(ds.length / 1024).toFixed(0)} KB (${gz(ds)} KB gzipped)`);
