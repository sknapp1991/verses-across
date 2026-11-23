"use client";
import { SITE_NAME, SITE_SIDE } from "@/lib/site";
import Link from "next/link";
import { chapterTitle } from "@/lib/catalog";
import { useEffect, useRef, useState } from "react";
import { ArticlesIcon, CalendarIcon, LanguagesIcon, LibraryIcon, HomeIcon, MenuIcon, MoreIcon, SearchIcon, SlidersIcon, UsersIcon } from "./icons";
import { ReadTogether } from "./read-together";
import { isShowing, openSheet, togglePanel, useUi, type PanelId } from "@/lib/ui-store";
import { useSettings } from "@/lib/settings";
import { openSearch } from "./search-panel";
import { ChapterSwipeControl, PrivacyControl, SavedSetups, ThemeToggle, VersionChooser, ZoomControl } from "./controls";
import { useReaderState } from "./use-reader-state";
import { AiButton } from "./ai-window";
import { OfflineDownloadsButton } from "./downloads-dialog";
import { InstallAppButton } from "./install-app";
import { TourButton } from "./tour";
import { ListenTopButton } from "./audio-player";
import { RedLetterToggle } from "./red-letter";
import { ProgressButton } from "./progress-button";
import { MoreSheet } from "./more-sheet";
import { setPageWork } from "@/lib/side";
import { noteVisit } from "@/lib/reading-position";

export function TopBar({ onOpenLibrary, menuOnDesk = false }: { onOpenLibrary: () => void; menuOnDesk?: boolean }) {
  const { ref, entry: chapterEntry, versions, home } = useReaderState();
  const entry = home ? undefined : chapterEntry; // the home page: the site name, not a chapter
  // the side (Scriptures / Library) follows the work on screen
  useEffect(() => setPageWork(ref.work), [ref.work]);
  // remembered as the last chapter opened (the Library list's "Last read")
  useEffect(() => {
    if (!home) noteVisit(`${ref.work}/${ref.book}/${ref.chapter}`);
  }, [ref.work, ref.book, ref.chapter, home]);
  const { sheet } = useUi();

  return (
    // Phone: menu, where you are, and four buttons (Search, My Study, Listen, More); the rest is in the More
    // sheet. Desktop: every tool has its own button.
    <header className="flex min-h-14 shrink-0 items-center gap-0 border-b border-line bg-panel px-2 pt-[env(safe-area-inset-top)] desk:gap-2 md:px-4">
      <button
        type="button"
        onClick={onOpenLibrary}
        aria-label="Open library"
        className={`flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-ink ${menuOnDesk ? "" : "desk:hidden"}`}
      >
        <MenuIcon />
      </button>
      {/* Phone: the home page, one tap away (the logo is desktop only). Ticket 72cd7cf4. */}
      <Link
        href="/read"
        aria-label="Home"
        aria-current={home ? "page" : undefined}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-raised hover:text-ink desk:hidden ${home ? "text-accent" : "text-muted"}`}
      >
        <HomeIcon />
      </Link>

      <Link href="/read" className="hidden items-center gap-2 pr-2 desk:flex" aria-label={`${SITE_NAME} home`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG logo */}
        <img src="/icon.svg" alt="" width={28} height={28} className="rounded-md" />
        <span className="hidden font-serif text-lg font-semibold tracking-tight xl:inline">
          <span className="text-[#b8935f]">{SITE_NAME.split(" ")[0]}</span> <span className="text-[#5f8fc4]">Across</span>
          <sup className="ml-0.5 align-super font-sans text-[9px] font-normal text-faint">™</sup>
        </span>
      </Link>

      {/* Phone: current location as the title; tap opens the library */}
      <button
        type="button"
        onClick={onOpenLibrary}
        aria-label="Open library"
        className="min-w-0 flex-1 truncate px-1 text-left font-serif text-[17px] font-semibold desk:hidden"
      >
        {entry ? chapterTitle(entry, ref.chapter) : SITE_NAME}
      </button>

      {/* (the Scriptures | Library switch is at the top of the Library list: on a computer the left panel, on a phone the menu) */}
      <div className="hidden flex-1 desk:block" />

      {/* Buttons in groups of related ones (a thin line between groups on a wide screen). */}
      <Group label="Search and study panels">
        <PanelButton id="search" label="Search the text" title="Search (/)" icon={<SearchIcon />} onOpen={() => openSearch()} />
        <PanelButton id="study" label="My Study" title="My Study: favorites, notes, highlights" icon={<LibraryIcon />} />
        {/* Articles (my brother, hub 0ce4b4a3, Nov 23): a page of its own, so a link; on a phone it is in the More sheet.
            Verses Across only: on Library Across /articles leaves the site. */}
        {SITE_SIDE === "scriptures" && (
          <Link
            href="/articles"
            title="Articles: essays across the traditions, in up to three depths"
            className="hidden h-11 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-sm text-muted hover:text-ink desk:flex"
          >
            <ArticlesIcon width={18} height={18} />
            <span className="sr-only xl:not-sr-only">Articles</span>
          </Link>
        )}
      </Group>
      <Divider />
      <Group label="Progress, plans, goals and reading together">
        <ProgressButton />
        <PanelButton id="plans" label="Plans and goals" title="Plans & Goals: reading plans and daily goals" icon={<CalendarIcon />} className="hidden desk:flex" />
        {/* Study groups and Read together in one menu (hub 1e79e2c3, Nov 21) */}
        <span className="hidden desk:flex">
          <TopPopover label="Together: study groups and read together" title="Together: study groups, or send a link to this exact spot" icon={<UsersIcon />}>
            {(close) => (
              <>
                <TogetherGroups close={close} />
                <ReadTogether />
              </>
            )}
          </TopPopover>
        </span>
      </Group>
      <Divider />
      <Group label="Listen and ask">
        <ListenTopButton />
        <span className="hidden desk:contents">
          <AiButton />
        </span>
      </Group>

      {/* Desktop controls (the text settings and the tap-a-verse modes are above the text). */}
      <Divider />
      <div className="hidden items-center gap-1 desk:flex">
        <Group label="Versions">
          <VersionsPopover count={versions.length} />
        </Group>
        <Divider />
        <Group label="More">
          <ThemeToggle />
          <TopPopover label="Display options" title="Saved setups, words of Jesus in red, swiping, offline and more" icon={<SlidersIcon />}>
            {/* the whole app's zoom (hub c3ae6ef4) */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Zoom</span>
              <ZoomControl />
            </div>
            <SavedSetups />
            <RedLetterToggle />
            <ChapterSwipeControl />
            <PrivacyControl heading />
            <OfflineDownloadsButton />
            <InstallAppButton />
            <TourButton />
          </TopPopover>
        </Group>
      </div>

      {/* Phone: one More button → the sheet with the other tools and every reading setting */}
      <button
        type="button"
        onClick={() => openSheet()}
        aria-label="More: tools and reading settings"
        aria-expanded={sheet != null}
        className={`flex h-11 w-11 items-center justify-center rounded-lg hover:bg-raised hover:text-ink desk:hidden ${sheet != null ? "bg-accent-soft text-accent" : "text-muted"}`}
      >
        <MoreIcon />
      </button>
      <MoreSheet />
    </header>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0 desk:gap-1">
      {children}
    </div>
  );
}
const Divider = () => <span aria-hidden className="hidden h-7 w-px shrink-0 bg-line desk:block" />;

/** A top-bar button for a panel of the side dock (pressed while it shows). */
function PanelButton({ id, label, title, icon, onOpen, className = "flex" }: { id: PanelId; label: string; title: string; icon: React.ReactNode; onOpen?: () => void; className?: string }) {
  const u = useUi();
  const { xrefMode } = useSettings();
  const showing = isShowing(u, xrefMode, id);
  return (
    <button
      type="button"
      onClick={() => (!showing && onOpen ? onOpen() : togglePanel(id))}
      aria-label={label}
      aria-pressed={showing}
      title={title}
      className={`${className} h-11 w-11 items-center justify-center rounded-lg hover:bg-raised hover:text-ink desk:border desk:border-line ${
        showing ? "bg-accent-soft text-accent" : "text-muted desk:bg-raised"
      }`}
    >
      {icon}
    </button>
  );
}

function VersionsPopover({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-lg border border-line bg-raised px-3 text-sm hover:border-faint"
      >
        <LanguagesIcon width={18} height={18} className="text-accent" />
        <span className="hidden xl:inline">Versions</span>
        <span className="rounded-full bg-accent-soft px-1.5 text-xs font-semibold tabular-nums text-accent">{count}</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Versions and languages"
          className="absolute right-0 top-full z-30 mt-2 flex max-h-[calc(var(--app-h,100dvh)-5rem)] w-96 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-xl"
        >
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-3 py-4">
            <VersionChooser />
            <p className="px-2 text-xs text-faint">Saved setups (your favourite sets of versions) are in Display options.</p>
          </div>
          <span aria-hidden className="fade-edge fade-top" />
          <span aria-hidden className="fade-edge fade-bottom" />
        </div>
      )}
    </div>
  );
}

/**
 * A top-bar button with a pop-up under it: the button opens and closes it (like My Study), so does
 * Escape or a click outside. The pop-up never runs off the screen: it scrolls inside.
 */
/** In the Together menu: open the Study groups panel (and close the menu). */
function TogetherGroups({ close }: { close: () => void }) {
  const u = useUi();
  const { xrefMode } = useSettings();
  const showing = isShowing(u, xrefMode, "groups");
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Study groups</h3>
      <p className="text-sm text-muted">Read with friends or family: shared progress, notes and a group chat.</p>
      <button
        type="button"
        onClick={() => {
          if (!showing) togglePanel("groups");
          close();
        }}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-raised px-3 text-sm font-medium hover:text-accent"
      >
        <UsersIcon width={18} height={18} />
        {showing ? "Study groups are open" : "Open study groups"}
      </button>
    </section>
  );
}

function TopPopover({ label, title, icon, children }: { label: string; title: string; icon: React.ReactNode; children: React.ReactNode | ((close: () => void) => React.ReactNode) }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        title={title}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-11 w-11 items-center justify-center rounded-lg border border-line ${open ? "bg-accent-soft text-accent" : "bg-raised text-muted hover:text-ink"}`}
      >
        {icon}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-full z-30 mt-2 flex max-h-[calc(var(--app-h,100dvh)-5rem)] w-80 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-xl"
        >
          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </div>
          <span aria-hidden className="fade-edge fade-top" />
          <span aria-hidden className="fade-edge fade-bottom" />
        </div>
      )}
    </div>
  );
}

