import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import index from "../../../../public/themes/index.json";
import { ThemeView } from "@/components/theme-view";
import type { ThemeSummary } from "@/lib/themes";

const THEMES = index as ThemeSummary[];
type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return THEMES.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = THEMES.find((x) => x.id === id);
  if (!t) return {};
  return {
    title: `${t.name} across the world's scriptures`,
    description: `${t.text} Passages on ${t.name.toLowerCase()} from ${t.traditions} traditions and ${t.books} books, side by side.`,
    alternates: { canonical: `/themes/${t.id}` },
  };
}

export default async function ThemePage({ params }: Props) {
  const { id } = await params;
  const t = THEMES.find((x) => x.id === id);
  if (!t) notFound();
  const i = THEMES.indexOf(t);
  const prev = THEMES[i - 1];
  const next = THEMES[i + 1];
  const a = "underline underline-offset-2 hover:text-ink";
  return (
    <main className="h-dvh overflow-y-auto bg-paper text-muted">
      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-2">
          <Link href="/themes" className={`text-sm ${a}`}>
            ← All themes
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">{t.group}</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">{t.name}</h1>
          <p>{t.text}</p>
        </header>
        <ThemeView id={t.id} />
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
