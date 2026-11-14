import type { Metadata } from "next";
import Link from "next/link";
import index from "../../../public/themes/index.json";
import { ThemesList } from "@/components/themes-list";
import type { ThemeSummary } from "@/lib/themes";
import { SITE_SIDE } from "@/lib/site";
import { BackLink, PageChrome } from "@/components/page-chrome";

export const metadata: Metadata = {
  title: "Themes",
  description:
    SITE_SIDE === "library"
      ? "Coming of age, revenge, voyages at sea and more across the classic books: each theme with a passage from the books that carry it most."
      : "Forgiveness, the flood, exile and mercy across the world's scriptures: over 60 themes, the passages from each tradition side by side.",
  alternates: { canonical: "/themes" },
};

// This site's themes (the other site's are there: /themes/<id> forwards).
const THEMES = (index as ThemeSummary[]).filter((t) => (t.side ?? "scriptures") === SITE_SIDE);
const a = "underline underline-offset-2 hover:text-ink";

/**
 * Themes (TH): scripture themes and Library themes (public/themes/, scripts/themes/build.py), with a Scriptures |
 * Library switch that opens on your side; each theme opens /themes/<id>.
 */
export default function ThemesPage() {
  return (
    <main className="h-app overflow-y-auto bg-paper text-muted">
      <PageChrome fallback="/" />
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <BackLink fallback="/" className={`text-sm ${a}`}>
            ← Back to reading
          </BackLink>
          <h1 className="font-serif text-3xl font-semibold text-ink">Themes</h1>
          <p className="text-xs text-faint">
            The passages are found by comparing meaning (the same method as the cross references), not chosen by hand, so
            some will fit better than others. Each theme&rsquo;s one-line description was written with AI. Study guides,
            quizzes and lesson plans built on these are{" "}
            <Link href="/coming-soon" className={a}>
              coming
            </Link>
            .
          </p>
        </header>
        <ThemesList themes={THEMES} />
      </div>
    </main>
  );
}
