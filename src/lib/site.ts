/**
 * Two sites from one codebase (Skylar, Nov 10): **Verses Across** (versesacross.com, the world's scriptures and
 * philosophy) and **Library Across** (libraryacross.com, literature: fiction, poetry, drama, children's books,
 * non-fiction, Freethought and Psychology). Which one a build is comes from NEXT_PUBLIC_SITE ("library" for Library
 * Across; anything else is Verses Across), set by the build command of each Cloudflare Worker.
 *
 * A book of the other site opened here (an old link, a cross reference) goes there, taking the reader's saved
 * data along (src/components/domain-move.tsx). Each build ships only its own texts (scripts/prune-site.mts).
 */
export type Side = "scriptures" | "library";

export const SITE_SIDE: Side = process.env.NEXT_PUBLIC_SITE === "library" ? "library" : "scriptures";
export const OTHER_SIDE: Side = SITE_SIDE === "library" ? "scriptures" : "library";

export const SITE_NAMES: Record<Side, string> = { scriptures: "Verses Across", library: "Library Across" };
export const HOSTS: Record<Side, string> = { scriptures: "versesacross.com", library: "libraryacross.com" };
export const ORIGINS: Record<Side, string> = { scriptures: "https://versesacross.com", library: "https://libraryacross.com" };

export const SITE_NAME = SITE_NAMES[SITE_SIDE];
export const SITE_HOST = HOSTS[SITE_SIDE];
export const SITE_ORIGIN = ORIGINS[SITE_SIDE];
export const OTHER_NAME = SITE_NAMES[OTHER_SIDE];
export const OTHER_ORIGIN = ORIGINS[OTHER_SIDE];

/** The shelves that make up Library Across (everything else is on Verses Across). */
export const LIBRARY_SHELVES = new Set(["literature", "fiction", "freethought", "psychology"]);

/** One line about the site, for descriptions and the install card. */
export const SITE_TAGLINE =
  SITE_SIDE === "library"
    ? "Read the classics free: novels, poetry, drama, children's books and more, with read-aloud, word help and notes."
    : "Read the world's scriptures side by side, in many languages. Free on phone and desktop.";
