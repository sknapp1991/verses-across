/**
 * Themes (TH): ~60 themes traced across every tradition and the Library's books, built by
 * scripts/themes/build.py from the cross references' embeddings into public/themes/ (static files).
 * The theme descriptions were written with AI; the passages are the texts' own words, found by similarity.
 */
import { chapterTitle, findBook } from "./catalog";

export type ThemePassage = { ref: string; text: string; score: number };
export type ThemeSummary = { id: string; name: string; group: string; text: string; side: "scriptures" | "library"; traditions: number; books: number; passages: number };
export type Theme = Omit<ThemeSummary, "traditions" | "books" | "passages"> & {
  traditions: { id: string; name: string; passages: ThemePassage[] }[];
  books: { work: string; title: string; shelf: string; passages: ThemePassage[] }[];
};

/** "bible/gen/1:3" → its parts, a label ("Genesis 1:3") and where it opens. */
export function parseRef(ref: string) {
  const m = /^([^/]+)\/([^/]+)\/(\d+):(.+)$/.exec(ref);
  if (!m) return null;
  const [, work, book, ch, verse] = m;
  const chapter = Number(ch);
  const entry = findBook(work, book);
  return { work, book, chapter, verse, label: `${chapterTitle(entry, chapter, book)}:${verse}`, bookName: entry?.name ?? book };
}

const themeP = new Map<string, Promise<Theme>>();
export function loadTheme(id: string) {
  if (!themeP.has(id))
    themeP.set(
      id,
      fetch(`/themes/${encodeURIComponent(id)}.json`)
        .then((r) => {
          if (!r.ok) throw new Error("This theme couldn't be loaded.");
          return r.json() as Promise<Theme>;
        })
        .catch((e: Error) => {
          themeP.delete(id);
          throw e;
        }),
    );
  return themeP.get(id)!;
}

type ThemeRefs = Record<string, string[]>;
let refsP: Promise<ThemeRefs> | null = null;
/** Which themes a passage is one of the strongest examples of ("bible/gen/1:3" → ["creation", "light-darkness"]). */
export function loadThemeRefs() {
  return (refsP ??= fetch("/themes/refs.json")
    .then((r): Promise<ThemeRefs> | ThemeRefs => (r.ok ? (r.json() as Promise<ThemeRefs>) : {}))
    .catch(() => {
      refsP = null;
      return {} as ThemeRefs;
    }));
}

let indexP: Promise<ThemeSummary[]> | null = null;
/** The list of themes (names for the chips). */
export function loadThemeIndex() {
  return (indexP ??= fetch("/themes/index.json")
    .then((r) => (r.ok ? (r.json() as Promise<ThemeSummary[]>) : []))
    .catch(() => {
      indexP = null;
      return [] as ThemeSummary[];
    }));
}
