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
import { GroupInvite } from "./groups-section";
import { AiWindow } from "./ai-window";
import { closePanel, openPanel, selectXref, setSplit, useUi, type PanelId } from "@/lib/ui-store";
import { closeXref, XrefDockPanel } from "./xref-panel";
import { PlansPanel } from "./plans-panel";
import { CalendarIcon, CloseIcon, LibraryIcon, SearchIcon, TrophyIcon } from "./icons";

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
  const [sheetOpen, setSheetOpen] = useState(false);
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
  // Phone: swipe in from the left edge for the library, up from the bottom edge for reading settings.
  useEdgeSwipes(
    () => setDrawerOpen(true),
    () => setSheetOpen(true),
  );

  return (
    <div className="flex h-dvh flex-col">
      <BackupNudge />
      <TopBar onOpenLibrary={() => setDrawerOpen(true)} sheetOpen={sheetOpen} setSheetOpen={setSheetOpen} />
      <TabBar />
      <ModeBanner />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-line bg-panel desk:block lg:w-80">
          <Sidebar />
        </aside>
        <main className="relative min-w-0 flex-1">{children}</main>
        {wide && <Dock />}
      </div>

      <Modal open={!wide && !!panel} onClose={() => closePanel()} variant="sheet" label={panel ? PANEL_LABEL[panel] : "Panel"}>
        <div className="h-[80dvh]">{panel && <PanelBody panel={panel} onNavigate={() => closePanel()} />}</div>
      </Modal>

      <AiWindow />
      <ProgressWatcher />
      <SyncDialog />
      <DownloadsDialog />
      <Tour />
      <GroupInvite />

      {toast && <Toast key={toast.id} text={toast.text} />}

      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} variant="drawer" label="Library">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-line py-1 pl-4 pr-1">
            <h2 className="font-serif text-lg font-semibold">Library</h2>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close library"
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

const PANEL_LABEL: Record<DockId, string> = { search: "Search", study: "My Study", progress: "Progress", plans: "Plans & Goals", xref: "Cross references" };
const PANEL_ICON: Record<DockId, React.ReactNode> = {
  search: <SearchIcon width={16} height={16} />,
  study: <LibraryIcon width={16} height={16} />,
  progress: <TrophyIcon width={16} height={16} />,
  plans: <CalendarIcon width={16} height={16} />,
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
  if (panel === "xref") return <XrefDockPanel />;
  return <StudyPanel onNavigate={onNavigate} />;
}

/**
 * Wide screens: the panel anchored at the right. Search, My Study, Cross references, Progress and
 * Plans & Goals open in it as tabs; "Side by side" shows them all at once. Drag the left edge to resize
 * (double-click: back to the default width).
 */
function Dock() {
  const { panel, tabs, split, xrefActive } = useUi();
  const { xrefMode, panelWidth } = useSettings();
  const all: DockId[] = xrefMode ? [...tabs, "xref"] : tabs;
  if (!all.length) return null;
  const active: DockId = xrefMode && (xrefActive || !panel) ? "xref" : (panel ?? all[0]);
  const shown = split ? all : [active];
  const each = panelWidth ?? 384;
  const select = (id: DockId) => (id === "xref" ? selectXref(true) : openPanel(id));
  const close = (id: DockId) => (id === "xref" ? closeXref() : closePanel(id));
  return (
    <aside
      aria-label={split ? "Side panels" : PANEL_LABEL[active]}
      // Side by side never takes more than about half the screen, so the text keeps room to read.
      style={{ width: shown.length > 1 ? `min(${each * shown.length}px, max(50vw, calc(100vw - 44rem)))` : `min(${each}px, 60vw)` }}
      className="relative flex shrink-0 flex-col border-l border-line bg-panel"
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const n = shown.length;
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
        <div className="flex shrink-0 items-center gap-1 border-b border-line bg-raised/60 px-1.5 py-1">
          {split ? (
            <p className="min-w-0 flex-1 truncate px-2 text-xs text-muted">{all.length} panels side by side</p>
          ) : (
            <div role="group" aria-label="Open panels" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {all.map((id) => (
                <span key={id} className={`flex shrink-0 items-center rounded-lg ${id === active ? "bg-panel shadow-sm ring-1 ring-line" : ""}`}>
                  <button
                    type="button"
                    aria-pressed={id === active}
                    aria-label={`Show ${PANEL_LABEL[id]}`}
                    title={PANEL_LABEL[id]}
                    onClick={() => select(id)}
                    className={`flex min-h-9 items-center gap-1.5 pl-2.5 pr-1 text-sm ${id === active ? "font-medium text-ink" : "text-muted hover:text-ink"}`}
                  >
                    <span className={id === active ? "text-accent" : ""}>{PANEL_ICON[id]}</span>
                    {/* The selected tab is named; the others show their icon (name on hover), so all fit. */}
                    {(id === active || all.length <= 2) && PANEL_LABEL[id]}
                  </button>
                  <button
                    type="button"
                    onClick={() => close(id)}
                    aria-label={`Close ${PANEL_LABEL[id]}`}
                    className="flex h-9 w-7 items-center justify-center rounded-md text-faint hover:text-ink"
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setSplit(!split)}
            aria-pressed={split}
            title={split ? "Show the panels as tabs" : "Show the open panels side by side"}
            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-2.5 text-xs font-medium text-muted hover:text-ink"
          >
            {split ? <TabsIcon /> : <SplitIcon />}
            {split ? "Tabs" : all.length > 2 ? <span className="sr-only">Side by side</span> : "Side by side"}
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 divide-x divide-line">
        {shown.map((id) => (
          <section key={id} aria-label={PANEL_LABEL[id]} className="min-h-0 min-w-0 flex-1">
            <PanelBody panel={id} />
          </section>
        ))}
      </div>
    </aside>
  );
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
