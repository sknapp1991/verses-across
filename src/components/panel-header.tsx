"use client";
/**
 * The title bar every side panel shares (Search, My Study, Cross references, Progress, Plans & Goals,
 * Study groups): icon, name, close, on an orange band. Side by side (several panels at once) the bar is
 * slimmer and the name folds the panel up or opens it again, so the open ones get the room.
 */
import { createContext, useContext } from "react";
import { ChevronDown, CloseIcon } from "./icons";

export type DockPanelCtx = { split: boolean; collapsed: boolean; toggle: () => void };
export const DockPanelContext = createContext<DockPanelCtx | null>(null);
export const useDockPanel = () => useContext(DockPanelContext);

export function PanelHeader({
  icon,
  title,
  extra,
  onClose,
  closeLabel,
  className = "",
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  /** Small text after the name (e.g. the verse cross references are for). */
  extra?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
  className?: string;
}) {
  const d = useDockPanel();
  const slim = !!d?.split;
  const name = (
    <>
      <span className="shrink-0 text-accent" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 truncate">
        {title}
        {extra && <span className="font-sans text-sm font-normal text-muted"> · {extra}</span>}
      </span>
    </>
  );
  return (
    <header
      className={`sticky top-0 z-10 flex shrink-0 items-center gap-1 border-b border-accent/25 bg-accent-soft ${slim ? "h-9 pl-1 pr-0.5" : "py-1 pl-4 pr-1"} ${className}`}
    >
      {slim ? (
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={d.toggle}
            aria-expanded={!d.collapsed}
            title={d.collapsed ? "Open this panel" : "Fold this panel up"}
            className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 text-left font-serif text-[15px] font-semibold hover:bg-accent/10"
          >
            <ChevronDown width={14} height={14} className={`shrink-0 text-muted transition-transform ${d.collapsed ? "-rotate-90" : ""}`} />
            {name}
          </button>
        </h2>
      ) : (
        <h2 className="flex min-w-0 flex-1 items-center gap-2 font-serif text-lg font-semibold">{name}</h2>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        className={`flex shrink-0 items-center justify-center rounded-lg text-muted hover:bg-accent/10 hover:text-ink ${slim ? "h-8 w-8" : "h-11 w-11"}`}
      >
        <CloseIcon width={slim ? 16 : 20} height={slim ? 16 : 20} />
      </button>
    </header>
  );
}
