import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ORIGINS, SITE_SIDE } from "@/lib/site";
import index from "../../../../public/themes/index.json";
import { ThemeView } from "@/components/theme-view";
import type { ThemeSummary } from "@/lib/themes";

const THEMES = index as ThemeSummary[];
type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return THEMES.filter((t) => (t.side ?? "scriptures") === SITE_SIDE).map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = THEMES.find((x) => x.id === id);
  if (!t) return {};
  return {
    title: t.side === "library" ? `${t.name} in literature` : `${t.name} across the world's scriptures`,
    description:
      t.side === "library"
        ? `${t.text} ${t.books} classic books on ${t.name.toLowerCase()}, with a passage from each.`
        : `${t.text} Passages on ${t.name.toLowerCase()} from ${t.traditions} traditions and ${t.books} books, side by side.`,
    alternates: { canonical: `/themes/${t.id}` },
  };
}

export default async function ThemePage({ params }: Props) {
  const { id } = await params;
  const t = THEMES.find((x) => x.id === id);
  if (!t) notFound();
  // A theme of the other site (Verses Across / Library Across): it lives there.
  const side = t.side ?? "scriptures";
  if (side !== SITE_SIDE) permanentRedirect(`${ORIGINS[side]}/themes/${t.id}`);
  // previous / next within the same side (scripture themes, or Library themes)
  const same = THEMES.filter((x) => x.side === t.side);
  const i = same.indexOf(t);
  const prev = same[i - 1];
  const next = same[i + 1];
  const a = "underline underline-offset-2 hover:text-ink";
  return (
    <main className="h-app overflow-y-auto bg-paper text-muted">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-2">
          <Link href={`/themes#${t.side}`} className={`text-sm ${a}`}>
            ← All themes
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            {t.side === "library" ? "Library" : "Scriptures"} · {t.group}
          </p>
          <h1 className="font-serif text-3xl font-semibold text-ink">{t.name}</h1>
          <p>{t.text}</p>
        </header>
        <ThemeView id={t.id} librarySide={t.side === "library"} />
        <nav className="flex justify-between gap-4 border-t border-line pt-4 text-sm">
          {prev ? (
            <Link href={`/themes/${prev.id}`} className={a}>
              ← {prev.name}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/themes/${next.id}`} className={a}>
              {next.name} →
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
