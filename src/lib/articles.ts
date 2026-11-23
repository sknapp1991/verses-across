/**
 * Articles library (ROADMAP AR, my brother's design, hub 5e5cf67c, Nov 20). Each article has up to three depths of
 * the same piece: Short (~500–700 words), Medium (~2,000+) and Extensive (~3,500–4,500), written from one research
 * pass so they share a thesis. Source: data/articles/<slug>/article.json + short.md / medium.md / long.md, built by
 * scripts/build-articles.mts into public/articles/ (index.json + <slug>.json).
 *
 * Status: "draft" never leaves the repo; "review" builds an unlisted, noindex preview page (for my brother's review
 * before publication); "published" is listed, searchable and in the sitemap. Articles are signed "The Verses Across
 * team"; anything AI wrote says so.
 */

export type Depth = "short" | "medium" | "long";
export const DEPTHS: Depth[] = ["short", "medium", "long"];
export const DEPTH_LABEL: Record<Depth, string> = { short: "Short", medium: "Medium", long: "Extensive" };

export type ArticleStatus = "draft" | "review" | "published";

export type TocEntry = { id: string; text: string; level: 2 | 3 };
export type TierInfo = { words: number; minutes: number };

/**
 * A word from another language, a name or a book the article mentions (hub 9c346b55, b53fdab9): listed in the
 * Study guide, and its first mention in the text opens the same card. `gloss`: how the article itself explains it
 * (the words in brackets after it). `card`: a short summary from Wikipedia or Wiktionary (CC BY-SA, credited and
 * linked), fetched ahead of time by scripts/article-refs.mts.
 */
export type StudyRef = {
  key: string;
  kind: "word" | "name" | "book";
  label: string;
  lang?: string;
  by?: string;
  gloss?: string;
  read?: string;
  card?: { source: "Wikipedia" | "Wiktionary"; title: string; text: string; url: string };
};
export type Tier = TierInfo & { html: string; toc: TocEntry[]; study?: StudyRef[] };
export type RelatedArticle = { slug: string; title: string; volume: number; shared: string[] };

export type ArticleSummary = {
  slug: string;
  title: string;
  subtitle?: string;
  /** 1–10, see VOLUMES */
  volume: number;
  traditions: string[];
  themes: string[];
  status: ArticleStatus;
  /** YYYY-MM-DD */
  date: string;
  summary: string;
  /** e.g. "Written with AI from the team's outline; quotations checked against the texts on this site." */
  aiNote?: string;
  depths: Partial<Record<Depth, TierInfo>>;
};

export type Article = ArticleSummary & { tiers: Partial<Record<Depth, Tier>>; related?: RelatedArticle[] };

/** The ten volumes (my brother's canon, Nov 20). */
export const VOLUMES: { n: number; name: string; scope: string }[] = [
  { n: 1, name: "Pillars of the Soul", scope: "Virtues, vices and inner states" },
  { n: 2, name: "The Sacred Bestiary", scope: "Animals and mythic creatures" },
  { n: 3, name: "Sacred Flora & Harvest", scope: "Trees, herbs, seeds and the harvest" },
  { n: 4, name: "Elements, Cosmos & Geography", scope: "Nature, the heavens and sacred places" },
  { n: 5, name: "Sacred Numbers, Geometry & Objects", scope: "Numbers, ritual objects and sacred order" },
  { n: 6, name: "Archetypal Figures & Roles", scope: "The exile, the prophet, the trickster, the shepherd…" },
  { n: 7, name: "Parables, Myths & Narratives", scope: "Floods, returns, descents and cosmic battles" },
  { n: 8, name: "Sacred Practices & Rituals", scope: "Fasting, pilgrimage, prayer, silence" },
  { n: 9, name: "Comparative Theology & Metaphysics", scope: "Grace and karma, free will, the problem of evil" },
  { n: 10, name: "Eschatology & the Afterlife", scope: "Time, death and last things" },
];

export const volumeName = (n: number) => VOLUMES.find((v) => v.n === n)?.name ?? `Volume ${n}`;

/** "3 min · 10 min · 18 min" for a card. */
export const depthBadges = (a: ArticleSummary) =>
  DEPTHS.filter((d) => a.depths[d]).map((d) => `${DEPTH_LABEL[d]} · ${a.depths[d]!.minutes} min`);
