"use client";
import { openTour } from "./tour";
import Link from "next/link";
import { openFeedback } from "@/lib/feedback";
import { useEffect, useMemo, useRef, useState } from "react";
import { LIBRARY_SHELVES, SIDE_NAME, shelvesOf, sideOfWork, useSide, type Side } from "@/lib/side";
import { recentChapters } from "@/lib/reading-position";
import { getSettings } from "@/lib/settings";
import { catalog, chapterTitle, DEFAULT_VERSIONS, isLiteratureWork, readHref, type BookRef } from "@/lib/catalog";
import { findRefs } from "@/lib/refs";
import { DailyVerse } from "./daily-verse";
import type { CatalogItem, Collection, Religion } from "@/lib/schema";
import { ChevronDown, ChevronRight, CollapseIcon, ExpandIcon, PinIcon, SearchIcon } from "./icons";
import { usePinch } from "./use-gestures";
import { useReaderState } from "./use-reader-state";
import { formatStamp, useStudy } from "@/lib/study";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

type Hit = { religion: Religion; collection: Collection; item: CatalogItem };

const ALL: Hit[] = catalog.religions
  .flatMap((religion) => religion.collections.flatMap((collection) => collection.items.map((item) => ({ religion, collection, item }))))
  // A book on several Literature / Fiction shelves is one search result (its first shelf).
  .filter((h, i, all) => !h.item.work || all.findIndex((x) => x.item.work === h.item.work && x.item.id === h.item.id) === i);

/** "john 3:16", "1 cor 13", "gen" → a jump target when the book is unambiguous. */
function parseJump(q: string): { hit: Hit; chapter: number; verse?: string } | null {
  const m = /^(.+?)\s+(\d+)(?:\s*[:.]\s*(\d+))?$/.exec(q.trim());
  if (!m) return null;
  const name = norm(m[1]).replace(/\s+/g, " ");
  const avail = ALL.filter((h) => h.item.work && h.item.chapters && h.item.status !== "coming-soon");
  const exact = avail.filter((h) => norm(h.item.name) === name || h.item.id === name.replace(/\s/g, ""));
  const prefix = avail.filter((h) => norm(h.item.name).startsWith(name));
  // "joh 3:16" is John, not "John Splendid" on the Fiction shelf: scripture wins a shared prefix.
  const scripturePrefix = prefix.filter((h) => !isLiteratureWork(h.item.work!));
  const hit = exact[0] ?? (prefix.length === 1 ? prefix[0] : scripturePrefix.length === 1 ? scripturePrefix[0] : undefined);
  if (!hit) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > (hit.item.chapters ?? 0)) return null;
  return { hit, chapter, verse: m[3] };
}

/** "MN 10", "SN 12.2", "Surah 2:255", "Gita 2.47"… (the reference finder used for AI answers). */
function refJump(q: string, preferWork: string): { hit: Hit; chapter: number; verse?: string } | null {
  const r = findRefs(q.trim(), preferWork)[0];
  if (!r || r.start > 0 || r.end < q.trim().length) return null;
  const hit = ALL.find((h) => h.item.work === r.ref.work && h.item.id === r.ref.book);
  return hit ? { hit, chapter: r.ref.chapter, verse: r.verse } : null;
}

/** A tradition's shelves in order, those with a `section` gathered under it (at the section's first shelf). */
function sectionsOf(cols: Collection[]): { section?: string; cols: Collection[] }[] {
  const out: { section?: string; cols: Collection[] }[] = [];
  for (const c of cols) {
    const g = c.section ? out.find((x) => x.section === c.section) : undefined;
    if (g) g.cols.push(c);
    else out.push({ section: c.section, cols: [c] });
  }
  return out;
}

/** The last chapter read on a side (from the saved reading positions), other than the one on screen. */
function lastRead(side: Side, now: BookRef): { ref: BookRef; title: string } | null {
  // saved reading places (most recent first), then the open tabs (a chapter opened but not scrolled yet)
  let tabs: string[] = [];
  try {
    tabs = [...getSettings().tabs].reverse();
  } catch {
    /* settings unavailable */
  }
  for (const key of [...recentChapters(), ...tabs]) {
    const [work, book, ch] = key.split("/");
    const chapter = Number(ch);
    if (!work || !book || !chapter || sideOfWork(work) !== side) continue;
    if (work === now.work && book === now.book && chapter === now.chapter) continue;
    const item = catalog.religions.flatMap((r) => r.collections.flatMap((c) => c.items)).find((i) => i.work === work && i.id === book);
    if (item) return { ref: { work, book, chapter }, title: chapterTitle(item, chapter) };
  }
  return null;
}

function whereIs(ref: BookRef) {
  for (const r of catalog.religions)
    for (const c of r.collections)
      for (const it of c.items)
        if (it.work === ref.work && it.id === ref.book)
          return { religion: r.name, section: c.section ?? null, collection: c.items.length === 1 ? null : c.name, chapter: chapterTitle(it, ref.chapter) };
  return null;
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { ref, versions } = useReaderState();
  const side = useSide();
  const other: Side = side === "library" ? "scriptures" : "library";
  const shelves = shelvesOf(side);
  const [query, setQuery] = useState("");
  // The book finder looks on this side only, unless asked to look on the other one too.
  const [bothSides, setBothSides] = useState(false);
  // Continue reading on this side (read from this device's saved places after the page is on screen).
  const [cont, setCont] = useState<{ ref: BookRef; title: string } | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable in the browser
    setCont(lastRead(side, ref));
  }, [side, ref.work, ref.book, ref.chapter]); // eslint-disable-line react-hooks/exhaustive-deps
  // User toggles override the default (which is: the path to the current book is open).
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const activeRef = useRef<HTMLAnchorElement>(null);

  // The path to the current book: its first shelf only (a book on several shelves, like Pride and Prejudice in
  // Classic Novels and Romance, opens just the first; the others open if you tap them).
  const currentPath = useMemo(() => {
    const ids = new Set<string>();
    for (const r of catalog.religions)
      for (const c of r.collections)
        for (const it of c.items)
          if (it.work === ref.work && it.id === ref.book) {
            ids.add(`r:${r.id}`);
            if (c.section) ids.add(`s:${r.id}/${c.section}`);
            ids.add(`c:${r.id}/${c.id}`);
            ids.add(`b:${it.work}/${it.id}`);
            return ids;
          }
    return ids;
  }, [ref.work, ref.book]);

  // "You are here": the shelf path to the chapter being read (first match, for a book on several shelves).
  const here = whereIs(ref);
  // Open the path to the current chapter again (whatever was collapsed) and scroll it into view.
  const showHere = () => {
    setToggled((t) => {
      const next = { ...t };
      for (const id of currentPath) next[id] = true;
      return next;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })));
  };

  // (the Library side has one shelf, Literature: open, so its sections show straight away)
  const isOpen = (id: string) => toggled[id] ?? (currentPath.has(id) || (side === "library" && shelves.length === 1 && id === `r:${shelves[0].id}`));
  // Reading progress: chapters marked studied, per book ("work/book" → count).
  const { items: studyItems } = useStudy();
  const studiedPerBook = new Map<string, number>();
  for (const [id, it] of studyItems)
    if (id.startsWith("studied:")) {
      const k = `${it.work}/${it.book}`;
      studiedPerBook.set(k, (studiedPerBook.get(k) ?? 0) + 1);
    }
  const progressOf = (list: { work?: string; id: string; chapters?: number; status?: string }[]) => {
    let done = 0;
    let total = 0;
    for (const i of list)
      if (i.work && i.chapters && i.status !== "coming-soon") {
        total += i.chapters;
        done += Math.min(i.chapters, studiedPerBook.get(`${i.work}/${i.id}`) ?? 0);
      }
    return { done, total };
  };
  const toggle = (id: string) => setToggled((t) => ({ ...t, [id]: !isOpen(id) }));
  // Expand all opens every religion and collection (not every book's chapter grid);
  // collapse all closes everything, including the current book.
  const setAll = (open: boolean) => {
    const next: Record<string, boolean> = { ...toggled };
    for (const r of shelves) {
      next[`r:${r.id}`] = open;
      for (const c of r.collections) {
        if (c.section) next[`s:${r.id}/${c.section}`] = open;
        next[`c:${r.id}/${c.id}`] = open;
        // collapse closes every book too; expand forgets those, so the current book opens again by default
        for (const it of c.items) {
          if (!open) next[`b:${it.work}/${it.id}`] = false;
          else delete next[`b:${it.work}/${it.id}`];
        }
      }
    }
    setToggled(next);
  };
  const treeRef = useRef<HTMLDivElement>(null);
  usePinch(treeRef, (dir) => setAll(dir === "out"));

  // Open at the chapter being read (Psalm 23 → the Psalms grid, centred), not at the top of the list.
  // On phones the library is a <dialog> that is shown by the parent's effect, which runs after this
  // one: wait a frame so the list is laid out, or scrollIntoView does nothing.
  useEffect(() => {
    const id = requestAnimationFrame(() => activeRef.current?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(id);
  }, []);

  const q = norm(query);
  const anyJump = q ? (parseJump(query) ?? refJump(query, ref.work)) : null;
  // "John 3:16" from the Library side: only with "Include the Scriptures" (otherwise it counts as a match there)
  const jumpHere = !!anyJump && (bothSides || LIBRARY_SHELVES.has(anyJump.hit.religion.id) === (side === "library"));
  const jump = jumpHere ? anyJump : null;
  const hits = q ? ALL.filter((h) => (bothSides || LIBRARY_SHELVES.has(h.religion.id) === (side === "library")) && (norm(h.item.name).includes(q) || norm(h.collection.name).includes(q))) : [];
  const elsewhere = q && !bothSides ? ALL.filter((h) => LIBRARY_SHELVES.has(h.religion.id) !== (side === "library") && (norm(h.item.name).includes(q) || norm(h.collection.name).includes(q))).length + (anyJump && !jumpHere ? 1 : 0) : 0;

  const href = (r: BookRef, verse?: string) => readHref(r, versions, verse);

  /** One shelf (collection) of a tradition: its books, or the book itself when it holds just one. */
  const renderCollection = (r: Religion, c: Collection) => {
    const cid = `c:${r.id}/${c.id}`;
    if (c.items.length === 1)
      return (
        <li key={c.id} className="pl-3">
          <ItemRow
            item={{ ...c.items[0], name: c.name }}
            open={isOpen(`b:${c.items[0].work}/${c.items[0].id}`)}
            onToggle={() => toggle(`b:${c.items[0].work}/${c.items[0].id}`)}
            current={ref}
            href={href}
            onNavigate={onNavigate}
            activeRef={activeRef}
          />
        </li>
      );
    const soon = c.items.every((i) => i.status === "coming-soon");
    return (
      <li key={c.id} className="pl-3">
        <TreeButton level={1} open={isOpen(cid)} onClick={() => toggle(cid)}>
          <span className={`font-medium ${currentPath.has(cid) ? "text-accent" : ""}`}>{c.name}</span>
          {soon && <Soon />}
          <Progress {...progressOf(c.items)} />
        </TreeButton>
        {isOpen(cid) && (
          <ul className="space-y-0.5 pl-3">
            {c.items.map((it) => (
              <li key={it.id}>
                <ItemRow
                  item={it}
                  open={isOpen(`b:${it.work}/${it.id}`)}
                  onToggle={() => toggle(`b:${it.work}/${it.id}`)}
                  current={ref}
                  href={href}
                  onNavigate={onNavigate}
                  activeRef={activeRef}
                />
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav aria-label="Library" className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-3">
        <label className="flex h-11 items-center gap-2 rounded-lg border border-line bg-raised px-3 focus-within:ring-2 focus-within:ring-accent/50">
          <SearchIcon className="shrink-0 text-faint" width={18} height={18} />
          <span className="sr-only">Search the library</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={side === "library" ? "Search the Library’s books" : "Search books, or “John 3:16”"}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint md:text-sm"
          />
        </label>
      </div>

      {!q && side === "scriptures" && <DailyVerse versionsFor={(w) => (w === ref.work ? versions : (DEFAULT_VERSIONS[w] ?? []))} onNavigate={onNavigate} />}
      {!q && cont && (
        <Link
          href={readHref(cont.ref, cont.ref.work === ref.work ? versions : (DEFAULT_VERSIONS[cont.ref.work] ?? []))}
          onClick={onNavigate}
          className="flex min-h-11 w-full items-center gap-1.5 border-b border-line px-4 text-left text-sm hover:bg-raised"
        >
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-faint">Continue</span>
          <span className="min-w-0 truncate font-medium">{cont.title}</span>
        </Link>
      )}
      {!q && here && sideOfWork(ref.work) === side && (
        <button
          type="button"
          onClick={showHere}
          title="Show where I am in the list"
          className="flex min-h-9 w-full items-center gap-1.5 border-b border-line px-4 text-left text-xs font-medium text-accent hover:bg-raised"
        >
          <PinIcon width={14} height={14} className="shrink-0" />
          <span className="min-w-0 truncate">
            {[here.religion, here.section, here.collection, here.chapter].filter(Boolean).join(" › ")}
          </span>
        </button>
      )}
      {!q && (
        <div className="flex gap-1 border-b border-line px-3 py-1.5">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted hover:bg-raised hover:text-ink"
          >
            <ExpandIcon width={16} height={16} /> Expand all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-muted hover:bg-raised hover:text-ink"
          >
            <CollapseIcon width={16} height={16} /> Collapse all
          </button>
        </div>
      )}
      <div ref={treeRef} className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2 py-2">
        {q ? (
          <ul className="space-y-0.5">
            {jump && (
              <li>
                <Link
                  href={href({ work: jump.hit.item.work!, book: jump.hit.item.id, chapter: jump.chapter }, jump.verse)}
                  onClick={onNavigate}
                  className="flex min-h-11 items-center rounded-lg bg-accent-soft px-3 font-medium text-accent"
                >
                  Go to {chapterTitle(jump.hit.item, jump.chapter)}
                  {jump.verse ? `:${jump.verse}` : ""}
                </Link>
              </li>
            )}
            {hits.length === 0 && !jump && <li className="px-3 py-6 text-center text-sm text-faint">No matches{side === "library" ? " in the Library" : " in the Scriptures"}</li>}
            {hits.map((h) => (
              <li key={`${h.religion.id}/${h.collection.id}/${h.item.id}`}>
                <ItemRow
                  item={h.item}
                  sub={`${h.religion.name} · ${h.collection.name}`}
                  open={isOpen(`b:${h.item.work}/${h.item.id}`)}
                  onToggle={() => toggle(`b:${h.item.work}/${h.item.id}`)}
                  current={ref}
                  href={href}
                  onNavigate={onNavigate}
                  activeRef={activeRef}
                />
              </li>
            ))}
            <li className="px-1 pt-2">
              <label className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted hover:bg-raised">
                <input type="checkbox" checked={bothSides} onChange={(e) => setBothSides(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Include the {SIDE_NAME[other]}
                {elsewhere > 0 && <span className="text-faint">({elsewhere} {elsewhere === 1 ? "match" : "matches"} there)</span>}
              </label>
            </li>
          </ul>
        ) : (
          <ul className="space-y-0.5">
            {shelves.map((r) => {
              const rid = `r:${r.id}`;
              const available = r.collections.some((c) => c.items.some((i) => i.status !== "coming-soon"));
              return (
                <li key={r.id}>
                  <TreeButton level={0} open={isOpen(rid)} onClick={() => toggle(rid)}>
                    <span className={`font-semibold ${currentPath.has(rid) ? "text-accent" : ""}`}>{r.name}</span>
                    {!available && <Soon />}
                    <Progress {...progressOf(r.collections.flatMap((c) => c.items))} />
                  </TreeButton>
                  {isOpen(rid) && r.intro && <p className="px-3 pb-1 pl-8 text-xs leading-relaxed text-muted">{r.intro}</p>}
                  {isOpen(rid) && (
                    <ul className="space-y-0.5">
                      {sectionsOf(r.collections).map((g) => {
                        if (!g.section) return renderCollection(r, g.cols[0]);
                        // A section (Literature › Fiction): one more level, holding its shelves.
                        const sid = `s:${r.id}/${g.section}`;
                        return (
                          <li key={sid} className="pl-3">
                            <TreeButton level={1} open={isOpen(sid)} onClick={() => toggle(sid)}>
                              <span className={`font-medium ${currentPath.has(sid) ? "text-accent" : ""}`}>{g.section}</span>
                              <Progress {...progressOf(g.cols.flatMap((c) => c.items))} />
                            </TreeButton>
                            {isOpen(sid) && <ul className="space-y-0.5">{g.cols.map((c) => renderCollection(r, c))}</ul>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!q && (
          <p className="px-2 pb-2 pt-6 text-xs leading-relaxed text-faint">
            <Link href="/about" onClick={onNavigate} className="underline underline-offset-2 hover:text-muted">
              About, terms &amp; privacy
            </Link>
            {" · "}
            <button type="button" onClick={() => openFeedback()} className="underline underline-offset-2 hover:text-muted">
              Send feedback
            </button>
            {" · "}
            <button type="button" onClick={() => openTour()} className="underline underline-offset-2 hover:text-muted">
              Take the tour
            </button>
          </p>
        )}
      </div>
    </nav>
  );
}

function Soon() {
  return (
    <span className="ml-auto shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-faint">
      Coming soon
    </span>
  );
}

/**
 * Quiet progress: shown only once something here is marked studied — a slim bar and the share,
 * with the exact count on hover.
 */
function Progress({ done, total }: { done: number; total: number }) {
  if (!done || !total) return null;
  const pct = (done / total) * 100;
  const all = done >= total;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2" title={`${done} of ${total} chapters studied (${pct < 1 ? "<1" : Math.round(pct)}%)`}>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={`block h-full rounded-full ${all ? "bg-green-600" : "bg-accent"}`} style={{ width: `${Math.max(4, pct)}%` }} />
      </span>
      <span className={`text-[11px] tabular-nums ${all ? "font-semibold text-green-700 dark:text-green-400" : "text-faint"}`}>
        ✓ {all ? "All" : `${done.toLocaleString()}/${total.toLocaleString()}`}
      </span>
    </span>
  );
}

function TreeButton({
  open,
  onClick,
  children,
  level,
}: {
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
  level: number;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2 text-left hover:bg-raised ${
        level === 0 ? "text-[15px]" : "text-sm"
      }`}
    >
      {open ? (
        <ChevronDown width={16} height={16} className="shrink-0 text-faint" />
      ) : (
        <ChevronRight width={16} height={16} className="shrink-0 text-faint" />
      )}
      {children}
    </button>
  );
}

function ItemRow({
  item,
  sub,
  open,
  onToggle,
  current,
  href,
  onNavigate,
  activeRef,
}: {
  item: CatalogItem;
  sub?: string;
  open: boolean;
  onToggle: () => void;
  current: BookRef;
  href: (r: BookRef) => string;
  onNavigate?: () => void;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
}) {
  if (item.status === "coming-soon" || !item.work || !item.chapters) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-lg px-2 pl-7 text-sm text-faint" aria-disabled="true">
        <span className="min-w-0">
          <span className="block truncate">{item.name}</span>
          {sub && <span className="block truncate text-xs">{sub}</span>}
        </span>
        <Soon />
      </div>
    );
  }
  const isCurrentBook = current.work === item.work && current.book === item.id;
  return <BookRow item={item} sub={sub} open={open} onToggle={onToggle} current={current} href={href} onNavigate={onNavigate} activeRef={activeRef} isCurrentBook={isCurrentBook} />;
}

function BookRow({
  item,
  sub,
  open,
  onToggle,
  current,
  href,
  onNavigate,
  activeRef,
  isCurrentBook,
}: {
  item: CatalogItem;
  sub?: string;
  open: boolean;
  onToggle: () => void;
  current: BookRef;
  href: (r: BookRef) => string;
  onNavigate?: () => void;
  activeRef: React.RefObject<HTMLAnchorElement | null>;
  isCurrentBook: boolean;
}) {
  const { items } = useStudy();
  // Studied chapters of this book: chapter → time studied.
  const studied = new Map<number, number>();
  const prefix = `studied:${item.work}/${item.id}/`;
  for (const [id, it] of items) if (id.startsWith(prefix)) studied.set(it.chapter, it.createdAt);
  const chapters = item.chapters!;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2 text-left text-sm hover:bg-raised ${
          isCurrentBook ? "font-semibold text-accent" : ""
        }`}
      >
        {open ? (
          <ChevronDown width={16} height={16} className="shrink-0 text-faint" />
        ) : (
          <ChevronRight width={16} height={16} className="shrink-0 text-faint" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.name}</span>
          {sub && <span className="block truncate text-xs font-normal text-faint">{sub}</span>}
        </span>
        {studied.size > 0 && (
          <span
            className={`shrink-0 rounded-full px-1.5 text-[11px] font-medium tabular-nums ${
              studied.size >= chapters ? "bg-green-600/15 font-semibold text-green-700 dark:text-green-400" : "bg-accent-soft text-accent"
            }`}
            title={`${studied.size} of ${chapters} chapters studied`}
          >
            ✓ {studied.size >= chapters ? "All" : `${studied.size}/${chapters}`}
          </span>
        )}
      </button>
      {open && (
        <div className="grid grid-cols-6 gap-1 py-1 pl-7 pr-1" role="list" aria-label={`${item.name} chapters`}>
          {Array.from({ length: chapters }, (_, i) => i + 1).map((n) => {
            const active = isCurrentBook && current.chapter === n;
            const done = studied.get(n);
            return (
              <Link
                key={n}
                role="listitem"
                ref={active ? activeRef : undefined}
                href={href({ work: item.work!, book: item.id, chapter: n })}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={done ? `${n} (studied ${formatStamp(done)})` : undefined}
                title={done ? `Studied ${formatStamp(done)}` : undefined}
                className={`relative flex h-11 items-center justify-center rounded-md text-sm tabular-nums ${
                  active ? "bg-accent font-semibold text-accent-ink" : done ? "text-accent hover:bg-raised" : "hover:bg-raised"
                }`}
              >
                {n}
                {done && (
                  <span aria-hidden className={`absolute right-1 top-0.5 text-[10px] font-bold ${active ? "text-accent-ink" : "text-accent"}`}>
                    ✓
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
