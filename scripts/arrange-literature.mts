/**
 * Arrange the book shelves into one Literature shelf with sections (Skylar, Nov 8):
 *
 *   Literature
 *     Fiction ▸ Classic Novels, Crime, Detective, Romance, Adventure, Short Stories, Historical, Gothic, Horror,
 *               Science Fiction & Fantasy, Science Fiction, …, Fantasy, Humor, Western
 *     Poetry      (one shelf)
 *     Drama       (one shelf)
 *     For Children
 *     Non-fiction ▸ Social Sciences, Countries, Religion, Law, Wars, Animals, Education, Music, Science, Technology
 *     Emmy's Picks
 *
 * Rewrites the shelves of data/literature-list.json (the importer's input) and data/literature-catalog.json
 * (what the site reads) the same way, so no re-import is needed. Safe to run again (it works from the
 * shelf ids, wherever they are now). Run after scripts/pick-fiction.mts if that is ever re-run.
 *
 *   npx tsx scripts/arrange-literature.mts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIST = path.join(ROOT, "data", "literature-list.json");
const CAT = path.join(ROOT, "data", "literature-catalog.json");

/** Gutenberg numbers of the plays and poetry (moved out of "Classic Novels, Plays & Poems" or added from other shelves). */
const DRAMA = [1513, 1524, 1533, 1514, 1523, 1510, 1534, 2542, 844, 14591, 59112, 1311, 19393, 11283, 16435, 9829];
const POETRY = [1322, 1004, 26, 16328, 2002, 2620, 13647, 13649];
/** Leaves "Classic Novels" for Non-fiction › Social Sciences (an essay). */
const TO_SOCIAL = [1080];

type Col<B> = { id: string; name: string; section?: string; books: B[] };
type Shelf<B> = { id: string; name: string; collections: Col<B>[] };

const FICTION_ORDER = ["lit-fiction", "fic-crime", "fic-detective", "fic-romance", "fic-adventure", "fic-short", "fic-historical", "fic-gothic", "fic-horror", "fic-sff", "fic-scifi", "fic-scifi-women", "fic-precursors", "fic-fantasy", "fic-humor", "fic-western"];
const NONFICTION_ORDER = ["lit-social", "lit-countries", "lit-religion", "lit-law", "lit-wars", "lit-animals", "lit-education", "lit-music", "lit-science", "lit-technology"];

function arrange<B>(shelves: Shelf<B>[], gidOf: (b: B) => number, byGid: (gid: number) => B | undefined): Shelf<B>[] {
  const all = new Map(shelves.flatMap((s) => s.collections).map((c) => [c.id, c]));
  const get = (id: string) => all.get(id);
  const pick = (gids: number[]) => gids.map(byGid).filter((b): b is B => !!b);
  const out: Col<B>[] = [];
  // Fiction: the classic novels first (without plays, poems and the essay), Literature's Crime folded into
  // "Crime, Thrillers & Mystery", then the genre shelves.
  const notNovel = new Set([...DRAMA, ...POETRY, ...TO_SOCIAL]);
  const fiction = FICTION_ORDER.map(get).filter((c): c is Col<B> => !!c);
  for (const c of fiction) {
    let books = c.books;
    if (c.id === "lit-fiction") books = books.filter((b) => !notNovel.has(gidOf(b)));
    if (c.id === "fic-crime") {
      const seen = new Set<number>();
      books = [...(get("lit-crime")?.books ?? []), ...books].filter((b) => !seen.has(gidOf(b)) && !!seen.add(gidOf(b)));
    }
    out.push({ id: c.id, name: c.id === "lit-fiction" ? "Classic Novels" : c.name, section: "Fiction", books });
  }
  out.push({ id: "lit-poetry", name: "Poetry", books: pick(POETRY) });
  out.push({ id: "lit-drama", name: "Drama", books: pick(DRAMA) });
  const children = get("lit-children");
  if (children) out.push({ ...children, section: undefined });
  for (const id of NONFICTION_ORDER) {
    const c = get(id);
    if (!c) continue;
    let books = c.books;
    if (id === "lit-social") books = [...books, ...pick(TO_SOCIAL).filter((b) => !books.some((x) => gidOf(x) === gidOf(b)))];
    out.push({ id: c.id, name: c.name, section: "Non-fiction", books });
  }
  const emmy = get("lit-emmy");
  if (emmy) out.push({ ...emmy, section: undefined });
  // Anything not placed above (a shelf added later) stays, at the end.
  const placed = new Set(out.map((c) => c.id).concat(["lit-crime"]));
  for (const c of all.values()) if (!placed.has(c.id)) out.push(c);
  return [{ id: "literature", name: "Literature", collections: out.map((c) => (c.section ? c : { id: c.id, name: c.name, books: c.books })) }];
}

// The importer's list: books are entries with a Gutenberg number.
type Entry = { gid: number };
const list = JSON.parse(await readFile(LIST, "utf8")) as { shelves: Shelf<Entry>[] };
const entries = new Map<number, Entry>();
for (const s of list.shelves) for (const c of s.collections) for (const b of c.books) if (!entries.has(b.gid)) entries.set(b.gid, b);
list.shelves = arrange(list.shelves, (b) => b.gid, (g) => entries.get(g));
await writeFile(LIST, JSON.stringify(list, null, 1) + "\n");

// The site's catalog: books are work ids; their Gutenberg number is the first edition's.
const cat = JSON.parse(await readFile(CAT, "utf8")) as { books: [string, string, string, number, [number, ...unknown[]][]][]; shelves: Shelf<string>[] };
const gidOfWork = new Map(cat.books.map((b) => [b[0], b[4][0][0]]));
const workOfGid = new Map<number, string>();
for (const b of cat.books) for (const ed of b[4]) if (!workOfGid.has(ed[0])) workOfGid.set(ed[0], b[0]);
cat.shelves = arrange(cat.shelves, (w) => gidOfWork.get(w) ?? -1, (g) => workOfGid.get(g));
const text = JSON.stringify(cat).replace(/\],\["lit-/g, '],\n["lit-');
await writeFile(CAT, text + "\n");

for (const c of cat.shelves[0].collections) console.log(`${(c.section ?? "").padEnd(12)} ${c.id.padEnd(18)} ${c.name.padEnd(34)} ${c.books.length}`);
