"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BackupNudge } from "./backup-nudge";
import { updateSettings, useMediaQuery, useSettings, WIDE_QUERY } from "@/lib/settings";
import { Modal } from "./modal";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { ModeBanner } from "./highlight-mode";
import { TabBar, useTabsSync } from "./tabs";
import { useEdgeSwipes } from "./use-gestures";
import { openSearch, SearchPanel } from "./search-panel";
import { StudyPanel } from "./study-panel";
import { ProgressPanel, ProgressWatcher } from "./progress-panel";
import { SyncDialog } from "./sync-dialog";
import { DownloadsDialog } from "./downloads-dialog";
import { Tour } from "./tour";
import { GroupInvite, GroupsPanel } from "./groups-section";
import { InstallCard } from "./install-app";
import { AiWindow } from "./ai-window";
import { closePanel, openPanel, openSheet, selectXref, setSplit, useUi, type PanelId } from "@/lib/ui-store";
import { closeXref, XrefDockPanel } from "./xref-panel";
import { PlansPanel } from "./plans-panel";
import { DockPanelContext } from "./panel-header";
import { CalendarIcon, CloseIcon, LibraryIcon, SearchIcon, TrophyIcon, UsersIcon } from "./icons";
import { SideSwitch, SideTip } from "./side-switch";

/** Keeps the <html> dark class in sync with the saved theme (and the OS when "system"). */
function useThemeSync() {
  const { theme } = useSettings();
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  useThemeSync();
  useTabsSync();
  const { panel, toast } = useUi();
  const wide = useMediaQuery(WIDE_QUERY, true);
  // "/" opens search (desktop keyboard shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      openSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Phone: swipe in from the left edge for the library, up from the bottom edge for the More sheet.
  useEdgeSwipes(
    () => setDrawerOpen(true),
    () => openSheet(),
  );

  return (
    <div className="flex h-dvh flex-col">
      <BackupNudge />
      <TopBar onOpenLibrary={() => setDrawerOpen(true)} />
      <TabBar />
      <ModeBanner />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-line bg-panel desk:block lg:w-80">
          <Sidebar showSwitch />
        </aside>
        <main className="relative min-w-0 flex-1">{children}</main>
        {wide && <Dock />}
      </div>

      <Modal open={!wide && !!panel} onClose={() => closePanel()} variant="sheet" label={panel ? PANEL_LABEL[panel] : "Panel"} noSwipe>
        {panel && (
          <ResizableSheet>
            <PanelBody panel={panel} onNavigate={() => closePanel()} />
          </ResizableSheet>
        )}
      </Modal>

      <AiWindow />
      <ProgressWatcher />
      <SyncDialog />
      <DownloadsDialog />
      <Tour />
      <GroupInvite />
      <InstallCard />
      <SideTip />

      {toast && <Toast key={toast.id} text={toast.text} />}

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} variant="drawer" label="Scriptures and Library">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line py-1 pl-4 pr-1">
            {/* the drawer's title is the Scriptures | Library switch */}
            <SideSwitch />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-raised"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Toast in the browser's top layer (popover), so it shows above open dialogs too. */
function Toast({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current as (HTMLDivElement & { showPopover?: () => void }) | null;
    try {
      el?.showPopover?.();
    } catch {
      /* older browser: shown in normal flow */
    }
  }, []);
  return (
    <div
      ref={ref}
      popover="manual"
      role="status"
      aria-live="polite"
      className="toast pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] m-0 mx-auto w-fit max-w-[90vw] rounded-full border-0 bg-ink px-4 py-2 text-center text-sm text-paper shadow-lg"
    >
      {text}
    </div>
  );
}

const PANEL_LABEL: Record<DockId, string> = {
  search: "Search",
  study: "My Study",
  progress: "Progress",
  plans: "Plans & Goals",
  groups: "Study groups",
  xref: "Cross references",
};
/** Shorter names for the dock's tabs, so every tab fits without scrolling. */
const TAB_LABEL: Record<DockId, string> = { search: "Search", study: "My Study", progress: "Progress", plans: "Plans & Goals", groups: "Groups", xref: "Cross refs" };
const PANEL_ICON: Record<DockId, React.ReactNode> = {
  search: <SearchIcon width={16} height={16} />,
  study: <LibraryIcon width={16} height={16} />,
  progress: <TrophyIcon width={16} height={16} />,
  plans: <CalendarIcon width={16} height={16} />,
  groups: <UsersIcon width={16} height={16} />,
  xref: (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4h4v6H7zM13 14h4v6h-4z" />
      <path d="M11 7h3a3 3 0 013 3v4M13 17h-3a3 3 0 01-3-3v-4" />
    </svg>
  ),
};

type DockId = PanelId | "xref";

function PanelBody({ panel, onNavigate }: { panel: DockId; onNavigate?: () => void }) {
  if (panel === "search") return <SearchPanel onNavigate={onNavigate} />;
  if (panel === "progress") return <ProgressPanel />;
  if (panel === "plans") return <PlansPanel onNavigate={onNavigate} />;
  if (panel === "groups") return <GroupsPanel />;
  if (panel === "xref") return <XrefDockPanel />;
  return <StudyPanel onNavigate={onNavigate} />;
}

/**
 * Wide screens: the panel anchored at the right. Search, My Study, Cross references, Progress,
 * Plans & Goals and Study groups open in it as tabs (all always in view); "Side by side" shows them
 * all at once in a grid of two columns (three on a very wide screen), so each keeps a usable size.
 * Drag the left edge to resize (double-click: back to the default width).
 */
function Dock() {
  const { panel, tabs, split: splitSetting, xrefActive, shownN, shownAt } = useUi();
  const { xrefMode, panelWidth } = useSettings();
  const huge = useMediaQuery("(min-width: 1800px)", false);
  // Side by side: panels folded up to their title bar (the others share the room).
  // Each folded panel with the count it was folded at: a panel asked to show after that (its button, a
  // search, a verse's cross references) is open again.
  const [foldedAt, setFoldedAt] = useState<Partial<Record<DockId, number>>>({});
  const folded = (Object.keys(foldedAt) as DockId[]).filter((id) => (foldedAt[id] ?? -1) >= (shownAt[id] ?? 0));
  const all: DockId[] = xrefMode ? [...tabs, "xref"] : tabs;
  // Side by side needs two panels; with one left it shows as a plain panel (the setting is kept).
  const split = splitSetting && all.length > 1;
  if (!all.length) return null;
  const active: DockId = xrefMode && (xrefActive || !panel) ? "xref" : (panel ?? all[0]);
  const shown = split ? all : [active];
  const cols = Math.min(shown.length, huge ? 3 : 2);
  // Panels go down the columns in turn: 1 3 5 | 2 4.
  const columns = Array.from({ length: cols }, (_, c) => shown.filter((_, i) => i % cols === c));
  const each = panelWidth ?? 384;
  const select = (id: DockId) => {
    if (split) setSplit(false);
    if (id === "xref") selectXref(true);
    else openPanel(id);
  };
  const close = (id: DockId) => {
    setFoldedAt((f) => without(f, id));
    if (id === "xref") closeXref();
    else closePanel(id);
  };
  return (
    <aside
      aria-label={split ? "Side panels" : PANEL_LABEL[active]}
      // Side by side never takes more than about half the screen, so the text keeps room to read.
      style={{ width: cols > 1 ? `min(${each * cols}px, max(50vw, calc(100vw - 44rem)))` : `min(${each}px, 60vw)` }}
      className="relative flex shrink-0 flex-col border-l border-line bg-panel"
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const n = cols;
          const onMove = (ev: PointerEvent) =>
            updateSettings({
              panelWidth: Math.round(
                Math.min((n > 1 ? Math.max(window.innerWidth * 0.5, window.innerWidth - 704) : window.innerWidth * 0.6) / n, Math.max(260, each - (ev.clientX - startX) / n)),
              ),
            });
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }}
        onDoubleClick={() => updateSettings({ panelWidth: null })}
        title="Drag to resize (double-click to reset)"
        aria-hidden
        className="absolute inset-y-0 -left-1 z-10 w-2 cursor-ew-resize hover:bg-accent/30"
      />
      {all.length > 1 && (
        <div className="flex shrink-0 items-stretch gap-1 border-b border-line bg-raised/60 p-1">
          {/* Every open panel has a named tab of the same width, so none is ever off screen. */}
          <div role="group" aria-label="Open panels" className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1">
            {all.map((id) => {
              const on = !split && id === active;
              return (
                // Each tab is a container: when a tab gets too narrow (many panels, narrow dock) it shows just its
                // icon, and the small close X goes (each panel also has its own close button).
                <span key={id} className={`@container relative flex min-w-0 overflow-hidden rounded-lg ${on ? "bg-panel shadow-sm ring-1 ring-line" : "hover:bg-panel/60"}`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={split ? `Show only ${PANEL_LABEL[id]}` : `Show ${PANEL_LABEL[id]}`}
                    title={PANEL_LABEL[id]}
                    onClick={() => select(id)}
                    className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pb-1 pt-2 text-[11px] leading-tight ${
                      on ? "font-semibold text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    <span className={on ? "text-accent" : ""}>{PANEL_ICON[id]}</span>
                    <span className="hidden max-w-full text-center @min-[4.5rem]:block">{TAB_LABEL[id]}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => close(id)}
                    aria-label={`Close ${PANEL_LABEL[id]}`}
                    title={`Close ${PANEL_LABEL[id]}`}
                    className="absolute right-0 top-0 hidden h-5 w-5 items-center justify-center rounded-md text-faint hover:bg-raised hover:text-ink @min-[4rem]:flex"
                  >
                    <CloseIcon width={11} height={11} />
                  </button>
                </span>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setSplit(!splitSetting)}
            aria-pressed={split}
            aria-label={split ? "Show the panels as tabs" : "Show the open panels side by side"}
            title={split ? "Show the panels as tabs" : "Show the open panels side by side"}
            className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-line bg-panel px-1 text-center text-[11px] leading-tight text-muted hover:text-ink"
          >
            {split ? <TabsIcon /> : <SplitIcon />}
            {split ? "Tabs" : "Side by side"}
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-px bg-line">
        {columns.map((col, c) => (
          <div key={c} className="flex min-h-0 min-w-0 flex-1 flex-col gap-px">
            {col.map((id) => {
              const isFolded = split && folded.includes(id);
              const toggle = () => setFoldedAt((f) => (isFolded ? without(f, id) : { ...f, [id]: shownN }));
              return (
                <DockPanelContext.Provider
                  key={id}
                  value={{ split, collapsed: isFolded, toggle }}
                >
                  <section
                    aria-label={PANEL_LABEL[id]}
                    // Folded: just the title bar. Open: shares the column; when that's short, the whole panel
                    // scrolls (its own lists still scroll inside it), so nothing is out of reach.
                    // Folded, everything under the title bar is hidden (not just clipped), so the keyboard skips it.
                    className={`min-w-0 bg-panel ${isFolded ? "h-9 shrink-0 overflow-hidden [&_header~*]:hidden" : "min-h-0 flex-1 overflow-y-auto"}`}
                  >
                    <div className={split && !isFolded ? "h-full min-h-[20rem]" : "h-full"}>
                      <PanelBody panel={id} />
                    </div>
                  </section>
                </DockPanelContext.Provider>
              );
            })}
            {/* Every panel in this column folded: the space below stays empty. */}
            {split && col.every((id) => folded.includes(id)) && <div className="flex-1 bg-panel" />}
          </div>
        ))}
      </div>
    </aside>
  );
}

function without<T extends object>(o: T, key: keyof T): T {
  const r = { ...o };
  delete r[key];
  return r;
}

const SplitIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </svg>
);
const TabsIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <rect x="3" y="8" width="18" height="12" rx="2" />
    <path d="M3 8V6a2 2 0 012-2h5l2 4" />
  </svg>
);

export function ShellFallback() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="h-14 shrink-0 border-b border-line bg-panel" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-72 shrink-0 border-r border-line bg-panel desk:block lg:w-80" />
        <div className="flex-1" />
      </div>
    </div>
  );
}

/**
 * Phone: a panel's bottom sheet (Search, My Study, Cross references…). Drag its title bar (or the handle
 * above it) up or down to any height, to see more of the text behind it; drag it right down to close.
 * The height is remembered for the next panel.
 */
const SHEET_KEY = "va-sheet-h";
function ResizableSheet({ children }: { children: ReactNode }) {
  const [h, setH] = useState(() => {
    try {
      const v = Number(localStorage.getItem(SHEET_KEY));
      return v >= 22 && v <= 80 ? v : 80;
    } catch {
      return 80;
    }
  });
  const drag = useRef<{ y: number; h: number } | null>(null);
  const live = useRef(h);
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    // From the title bar or the very top edge (the handle), not from its buttons.
    const top = e.clientY - e.currentTarget.getBoundingClientRect().top;
    if (!(t.closest("header") || top < 18) || t.closest("button, a, input, select")) return;
    drag.current = { y: e.clientY, h: live.current };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const next = Math.min(80, Math.max(12, d.h - ((e.clientY - d.y) / window.innerHeight) * 100));
    live.current = next;
    setH(next);
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (live.current < 22) {
      closePanel(); // dragged right down: close, as swiping a sheet down does
      return;
    }
    try {
      localStorage.setItem(SHEET_KEY, String(Math.round(live.current)));
    } catch {
      /* private mode */
    }
  };
  return (
    <div
      style={{ height: `${h}dvh` }}
      className="[&_header]:cursor-ns-resize [&_header]:touch-none [&_header]:select-none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {children}
    </div>
  );
}
