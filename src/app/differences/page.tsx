import type { Metadata } from "next";
import Link from "next/link";
import data from "../../../data/bible-differences.json";
import { permanentRedirect } from "next/navigation";
import { chapterTitle, findBook, readHref } from "@/lib/catalog";
import { ORIGINS, SITE_SIDE } from "@/lib/site";
import { BackLink, Fold, PageChrome } from "@/components/page-chrome";

export const metadata: Metadata = {
  title: "Why Bibles differ: verses some leave out",
  description:
    "Matthew 17:21, the end of Mark, the woman taken in adultery, 1 John 5:7: the New Testament verses English Bibles print differently, the KJV, WEB and ASV side by side, and why.",
  alternates: { canonical: "/differences" },
};

type Verse = { v: string; t: string };
type Item = {
  id: string;
  group: string;
  book: string;
  chapter: number;
  from: number;
  to?: number;
  through?: string;
  note: string;
  parallel?: string;
  texts: Record<string, Verse[] | null>;
  missingIn: string[];
  more: boolean;
  elsewhere?: Record<string, string>;
};
const GROUPS = data.groups as { id: string; title: string; intro: string }[];
const ITEMS = data.items as Item[];
const SHOWN = [
  ["kjv", "KJV", "King James Version (1769), from the Textus Receptus"],
  ["web", "WEB", "World English Bible, from the Majority Text"],
  ["asv", "ASV", "American Standard Version (1901), from the Greek of the oldest manuscripts (the 1881 revisers’ text)"],
] as const;
const a = "underline underline-offset-2 hover:text-ink";

/** "Matthew 17:21", "Mark 16:9–20", "John 7:53–8:11" */
function label(it: Item) {
  const name = chapterTitle(findBook("bible", it.book), it.chapter, it.book);
  return `${name}:${it.from}${it.through ? `–${it.through}` : it.to && it.to !== it.from ? `–${it.to}` : ""}`;
}
function parallelLabel(p: string) {
  const [book, ch, v] = p.split("/");
  return { href: readHref({ work: "bible", book, chapter: Number(ch) }, ["kjv", "web", "asv"], v), text: `${chapterTitle(findBook("bible", book), Number(ch), book)}:${v}` };
}

/**
 * Phase 1 of TX (ROADMAP): the New Testament verses English Bibles print differently, the KJV, WEB and ASV side
 * by side, with a short note on why (data/bible-differences.json, built by scripts/build-differences.mts).
 * A verse listed here has a small "Not in every Bible" mark in the reader that links to its entry.
 */
export default function DifferencesPage() {
  if (SITE_SIDE !== "scriptures") permanentRedirect(`${ORIGINS.scriptures}/differences`); // a Verses Across page
  return (
    <main className="h-app overflow-y-auto bg-paper text-muted">
      <PageChrome fallback="/" />
      <div className="mx-auto max-w-4xl space-y-8 px-4 pb-16 pt-8 leading-relaxed md:px-8">
        <header className="space-y-3">
          <BackLink fallback="/" className={`text-sm ${a}`}>
            ← Back to reading
          </BackLink>
          <h1 className="font-serif text-3xl font-semibold text-ink">Why Bibles differ</h1>
          <p>
            No original manuscript of the New Testament survives; we have thousands of copies, and they don&rsquo;t all agree.
            Translators choose which Greek text to follow, so some Bibles have verses others leave out. Here are the best-known
            differences, three Bibles side by side:
          </p>
          <ul className="space-y-1 text-sm">
            {SHOWN.map(([, abbr, what]) => (
              <li key={abbr}>
                <strong className="text-ink">{abbr}</strong>: {what}
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">
            The notes were written with AI (Claude) from standard reference works on the manuscripts and checked against the
            texts on this site; they describe what the manuscripts contain without taking sides. More is coming: pages on the
            manuscripts themselves and on how the canon was formed.
          </p>
          <nav aria-label="On this page" className="flex flex-wrap gap-2 text-sm">
            {GROUPS.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="rounded-full border border-line px-3 py-1 hover:border-accent hover:text-accent">
                {g.title}
              </a>
            ))}
          </nav>
        </header>

        {GROUPS.map((g) => (
          // Each part folds away (ticket ff8c9d5b); a link to an entry inside opens it (PageChrome).
          <Fold key={g.id} id={g.id} title={g.title}>
            <p>{g.intro}</p>
            {ITEMS.filter((it) => it.group === g.id).map((it) => (
              <article key={it.id} id={it.id} className="scroll-mt-4 space-y-3 rounded-2xl border border-line bg-raised/40 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-xl font-semibold text-ink">{label(it)}</h3>
                  {it.missingIn.filter((v) => !it.elsewhere?.[v]).length > 0 && (
                    <span className="text-xs text-faint">
                      Not in:{" "}
                      {it.missingIn
                        .filter((v) => !it.elsewhere?.[v])
                        .map((v) => v.toUpperCase())
                        .join(", ")}
                    </span>
                  )}
                </div>
                <p>{it.note}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {SHOWN.map(([id, abbr]) => {
                    const t = it.texts[id];
                    return (
                      <div key={id} className="rounded-lg border border-line bg-paper p-3">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">{abbr}</p>
                        {t ? (
                          <p className="font-serif text-[0.95rem] leading-relaxed text-ink">
                            {t.map((x) => (
                              <span key={x.v}>
                                <sup className="mr-0.5 font-sans text-[10px] font-semibold text-accent">{x.v}</sup>
                                {x.t}{" "}
                              </span>
                            ))}
                            {it.more && <span className="text-faint">…</span>}
                          </p>
                        ) : it.elsewhere?.[id] ? (
                          <p className="text-sm italic text-faint">Printed elsewhere ({it.elsewhere[id]})</p>
                        ) : (
                          <p className="text-sm italic text-faint">Not in this Bible (the verse number is skipped)</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <Link
                    href={readHref({ work: "bible", book: it.book, chapter: it.chapter }, ["kjv", "web", "asv"], String(it.from))}
                    className="font-medium text-accent underline decoration-accent/40 underline-offset-2"
                  >
                    Read it in context →
                  </Link>
                  {it.parallel && (
                    <span>
                      Compare{" "}
                      <Link href={parallelLabel(it.parallel).href} className={a}>
                        {parallelLabel(it.parallel).text}
                      </Link>
                    </span>
                  )}
                </p>
              </article>
            ))}
          </Fold>
        ))}
      </div>
    </main>
  );
}
