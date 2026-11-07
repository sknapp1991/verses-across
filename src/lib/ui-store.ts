"use client";
/**
 * Small shared UI state: the side dock (Search, My Study, Progress, Plans & Goals; Cross references
 * joins it from its own setting), the verse action menu, and toast messages.
 *
 * The dock is the panel anchored at the right on a wide screen. Several panels can be open in it at
 * once, as tabs; `split` shows them side by side instead. On a phone only the active one shows (a sheet).
 */
import { useSyncExternalStore } from "react";
import type { StudyRef } from "./storage";
import { getSettings, WIDE_QUERY } from "./settings";

export type PanelId = "search" | "study" | "progress" | "plans";
export type Panel = PanelId | null;
/** `version`: the column that was tapped (read aloud uses it). */
export type VerseMenuState = (StudyRef & { verse: string; focus?: "note" | "ask"; version?: string }) | null;
type Ui = {
  /** The active panel (the one shown on a phone and the selected tab on a wide screen); null when the dock is closed. */
  panel: Panel;
  /** Every panel open in the dock, in the order they were opened. */
  tabs: PanelId[];
  /** Wide screen: show all open panels side by side (otherwise as tabs). Cross references is "xref" here. */
  split: boolean;
  /** The selected tab may also be the cross references panel (owned by the xrefMode setting). */
  xrefActive: boolean;
  menu: VerseMenuState;
  toast: { id: number; text: string } | null;
};

const SPLIT_KEY = "va-dock-split:v1";
let ui: Ui = { panel: null, tabs: [], split: false, xrefActive: false, menu: null, toast: null };
const SERVER: Ui = ui;
let splitLoaded = false;
const subs = new Set<() => void>();
const set = (patch: Partial<Ui>) => {
  ui = { ...ui, ...patch };
  subs.forEach((l) => l());
};

function snapshot() {
  if (!splitLoaded && typeof window !== "undefined") {
    splitLoaded = true;
    try {
      if (localStorage.getItem(SPLIT_KEY) === "1") ui = { ...ui, split: true };
    } catch {
      /* private mode */
    }
  }
  return ui;
}

export function useUi() {
  return useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    snapshot,
    () => SERVER,
  );
}

/** Open a panel (adds it as a tab if needed) and select it. */
export const openPanel = (panel: PanelId) => set({ panel, tabs: ui.tabs.includes(panel) ? ui.tabs : [...ui.tabs, panel], xrefActive: false });

/** Close one panel's tab, or (no argument, or on a phone, where only one shows at a time) the whole dock. */
export function closePanel(panel?: PanelId) {
  const phone = typeof window !== "undefined" && !window.matchMedia(WIDE_QUERY).matches;
  if (!panel || phone) return set({ panel: null, tabs: [], xrefActive: false });
  const tabs = ui.tabs.filter((t) => t !== panel);
  set({ tabs, panel: ui.panel === panel ? (tabs[tabs.length - 1] ?? null) : ui.panel });
}

/**
 * The top-bar buttons: open it if it isn't open; select it if it's open behind another tab;
 * close it if it's the one showing (or, side by side, if it's open at all).
 */
export function togglePanel(panel: PanelId) {
  if (isShowing(ui, getSettings().xrefMode, panel)) closePanel(panel);
  else openPanel(panel);
}

/** Whether a panel is on screen: open, and either side by side or the selected tab (cross references not in front). */
export function isShowing(u: Pick<Ui, "panel" | "tabs" | "split" | "xrefActive">, xrefMode: boolean, panel: PanelId) {
  return u.tabs.includes(panel) && (u.split || (u.panel === panel && !(u.xrefActive && xrefMode)));
}

/** Cross references tab selected (or not) in the dock. */
export const selectXref = (on: boolean) => set({ xrefActive: on });

export function setSplit(split: boolean) {
  set({ split });
  try {
    localStorage.setItem(SPLIT_KEY, split ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export const openVerseMenu = (menu: NonNullable<VerseMenuState>) => set({ menu });
export const closeVerseMenu = () => set({ menu: null });

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string, ms = 2600) {
  clearTimeout(toastTimer);
  set({ toast: { id: Date.now(), text } });
  toastTimer = setTimeout(() => set({ toast: null }), ms);
}
