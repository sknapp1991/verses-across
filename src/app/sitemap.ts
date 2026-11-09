import type { MetadataRoute } from "next";
import { booksOfWork, catalog, isLiteratureWork } from "@/lib/catalog";
import { chapterPath, SITE } from "@/lib/seo-shared";
import themes from "../../public/themes/index.json";

/** Every chapter's main address (no ?v=), so search engines can find all ~27k pages. Built once at build time. */
export default function sitemap(): MetadataRoute.Sitemap {
  const urls: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, priority: 1 },
    { url: `${SITE}/about`, priority: 0.5 },
    { url: `${SITE}/coming-soon`, priority: 0.3 },
    { url: `${SITE}/whats-new`, priority: 0.3 },
    { url: `${SITE}/themes`, priority: 0.6 },
    ...themes.map((t) => ({ url: `${SITE}/themes/${t.id}`, priority: 0.5 })),
  ];
  for (const w of catalog.works)
    for (const b of booksOfWork(w.id)) {
      // Literature: one address per book (every chapter would take the sitemap past search engines' 50,000 limit).
      const last = isLiteratureWork(w.id) ? 1 : b.chapters!;
      for (let c = 1; c <= last; c++) urls.push({ url: `${SITE}${chapterPath({ work: w.id, book: b.id, chapter: c })}` });
    }
  return urls;
}
