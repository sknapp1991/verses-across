"use client";
/**
 * The home page (/read, inside the reading frame): a grid of tiles, 2 across (1 on a phone). A first visit lands
 * here; the logo at top left opens it. Tiles: Continue reading beside what to study / read next, Suggestions (a short
 * questionnaire, home-suggestions.tsx), the tour, the sister site, Themes,
 * About, Send feedback. Ticket 72cd7cf4 (the brother's idea, Skylar approved, Nov 12): kept simple to
 * build on later.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_LOCATION, DEFAULT_VERSIONS, catalog, chapterTitle, findBook, readHref, type BookRef } from "@/lib/catalog";
import { lastRead } from "@/lib/last-read";
import { getSettings } from "@/lib/settings";
import { OTHER_NAME, OTHER_ORIGIN, SITE_NAME, SITE_SIDE } from "@/lib/site";
import { openFeedback } from "@/lib/feedback";
import { openPanel } from "@/lib/ui-store";
import { openTour } from "./tour";
import { BookIcon, CalendarIcon, ColumnsIcon, LibraryIcon, MailIcon, RocketIcon, SparkIcon, StarIcon } from "./icons";
import { SuggestionsTile } from "./home-suggestions";

const library = SITE_SIDE === "library";
const noSubscribe = () => () => {};

/** A book's first item on the shelves, by work (Library Across's suggestions). */
function bookOf(work: string) {
  for (const r of catalog.religions) for (const c of r.collections) for (const it of c.items) if (it.work === work && it.chapters) return { work, book: it.id, name: it.name };
  return null;
}
type Similar = Record<string, [string, number][]>;
const STARTERS = ["lit-pride-and-prejudice", "lit-frankenstein", "lit-adventures-of-sherlock-holmes"];

const tileCls =
  "group flex min-h-28 w-full flex-col gap-1.5 rounded-2xl border border-line bg-panel p-4 text-left shadow-sm transition-colors hover:border-accent focus-visible:border-accent";

function Tile({ icon, title, children, href, onClick, newTab }: { icon: ReactNode; title: string; children: ReactNode; href?: string; onClick?: () => void; newTab?: boolean }) {
  const inner = (
    <>
      <span className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
        {title}
        {newTab && <span className="text-sm text-faint">↗</span>}
      </span>
      <span className="text-sm text-muted">{children}</span>
    </>
  );
  if (href)
    return (
      <Link href={href} className={tileCls}>
        {inner}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={tileCls}>
      {inner}
    </button>
  );
}

export function HomePage() {
  // Read once on the client (the server can't know this device's reading).
  const lastKey = useSyncExternalStore(noSubscribe, () => JSON.stringify(lastRead()), () => "null"); // a string: a stable snapshot
  const last = useMemo(() => JSON.parse(lastKey) as BookRef | null, [lastKey]);
  const versions = (ref: BookRef) => getSettings().versions[ref.work] ?? DEFAULT_VERSIONS[ref.work];
  const lastEntry = last ? findBook(last.work, last.book) : undefined;
  const start = last ?? DEFAULT_LOCATION;
  const startEntry = findBook(start.work, start.book);

  // Library Across: books like the one being read (else a few favourites to start with).
  const [next, setNext] = useState<{ work: string; book: string; name: string }[]>([]);
  useEffect(() => {
    if (!library) return;
    let live = true;
    void import("../../data/similar-books.json").then((m) => {
      const d = m.default as unknown as Similar;
      const works = last && d[last.work] ? d[last.work].map(([w]) => w) : STARTERS;
      if (live) setNext(works.map(bookOf).filter((b): b is NonNullable<typeof b> => !!b).slice(0, 3));
    });
    return () => {
      live = false;
    };
  }, [last]);
  const nextChapter = last && lastEntry?.chapters && last.chapter < lastEntry.chapters ? { ...last, chapter: last.chapter + 1 } : null;

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain bg-paper">
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
        <h1 className="font-serif text-3xl font-semibold text-ink">{SITE_NAME}</h1>
        <p className="mt-1 text-muted">
          {library ? "Classic books, free to read: fiction, poetry, drama, children's books and more." : "The world's scriptures side by side, in many languages."}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Tile icon={<BookIcon width={18} height={18} />} title={last ? "Continue reading" : "Start reading"} href={readHref(start, versions(start))}>
            {(last ? lastEntry : startEntry) ? chapterTitle(last ? lastEntry : startEntry, start.chapter) : "Open the first chapter"}
            {!last && <span className="block text-faint">or pick any book from the list</span>}
          </Tile>
          {library ? (
            <div className={tileCls}>
              <span className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <CalendarIcon width={18} height={18} />
                </span>
                What to read next
              </span>
              <span className="text-sm text-muted">{last && lastEntry ? `Books like ${lastEntry.name.split(" · ")[0]}:` : "A few favourites to start with:"}</span>
              <ul className="space-y-0.5 text-sm">
                {next.map((b) => (
                  <li key={b.work}>
                    <Link href={readHref({ work: b.work, book: b.book, chapter: 1 }, DEFAULT_VERSIONS[b.work])} className="font-medium text-accent hover:underline">
                      {b.name.split(" · ")[0]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={tileCls}>
              <span className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <CalendarIcon width={18} height={18} />
                </span>
                What to study next
              </span>
              {nextChapter && lastEntry && (
                <Link href={readHref(nextChapter, versions(nextChapter))} className="text-sm font-medium text-accent hover:underline">
                  Next up: {chapterTitle(lastEntry, nextChapter.chapter)} →
                </Link>
              )}
              <button type="button" onClick={() => openPanel("plans")} className="self-start text-left text-sm font-medium text-accent hover:underline">
                Pick a reading plan to follow day by day →
              </button>
            </div>
          )}
          <SuggestionsTile className="sm:col-span-2" />
          <Tile icon={<RocketIcon width={18} height={18} />} title="Take the tour" onClick={() => openTour()}>
            A short walk through what you can do here, one step at a time.
          </Tile>
          <Tile icon={<LibraryIcon width={18} height={18} />} title={OTHER_NAME} href={`${OTHER_ORIGIN}/`} newTab>
            {library ? "Our sister site: the world's scriptures side by side." : "Our sister site: classic books, from novels to poetry and children's stories."}
            <span className="block text-faint">Your places and notes come along.</span>
          </Tile>
          <Tile icon={<SparkIcon width={18} height={18} />} title="Themes" href={library ? "/themes#library" : "/themes"}>
            {library ? "Story themes across the books: love, war, home, the journey…" : "Big themes across the scriptures, with the passages that speak to them."}
          </Tile>
          {!library && (
            <Tile icon={<ColumnsIcon width={18} height={18} />} title="Why Bibles differ" href="/differences">
              Where the King James and modern translations part ways, verse by verse, and why.
            </Tile>
          )}
          <Tile icon={<RocketIcon width={18} height={18} />} title="Coming soon" href="/coming-soon">
            What we&apos;re building next: games, a section for children, a path for teachers and more.
          </Tile>
          <Tile icon={<StarIcon width={18} height={18} />} title={`About ${SITE_NAME}`} href="/about">
            Who made it, where the texts come from, and how your privacy is kept.
          </Tile>
          <Tile icon={<MailIcon width={18} height={18} />} title="Send feedback" onClick={() => openFeedback()}>
            Spotted a mistake, or have an idea? Tell us. It reaches a real person.
          </Tile>
        </div>
      </div>
    </div>
  );
}
