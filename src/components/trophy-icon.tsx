"use client";
/**
 * The Progress icon, chosen by the reader (hub 3f2d94ac): the usual trophy, or a crown, a chess piece, medals, a
 * lightning bolt, a shield, a sword, an axe, a helmet, a horse, an archer, a guard, a castle, a tree, the sun, a
 * sunset, a ring, a diamond… Tap it in the Progress panel's header for a small picker; the choice shows wherever
 * the Progress icon does (top bar, panel tab, More sheet) and is remembered on this device. Only long-supported
 * emoji (Unicode 12 at most).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TrophyIcon } from "./icons";

const CHOICES: { icon: string; name: string }[] = [
  { icon: "", name: "Trophy (outline)" },
  { icon: "🏆", name: "Trophy" },
  { icon: "👑", name: "Crown" },
  { icon: "👸", name: "Princess with a tiara" },
  { icon: "♟️", name: "Chess piece" },
  { icon: "🥇", name: "Gold medal" },
  { icon: "🥈", name: "Silver medal" },
  { icon: "🥉", name: "Bronze medal" },
  { icon: "🏅", name: "Sports medal" },
  { icon: "🎖️", name: "Military medal" },
  { icon: "⚡", name: "Lightning bolt" },
  { icon: "🛡️", name: "Shield" },
  { icon: "🗡️", name: "Sword" },
  { icon: "⚔️", name: "Crossed swords" },
  { icon: "🪓", name: "Axe" },
  { icon: "⛑️", name: "Helmet" },
  { icon: "🐎", name: "Horse" },
  { icon: "🏇", name: "Rider" },
  { icon: "🏹", name: "Archer’s bow" },
  { icon: "💂", name: "Guard" },
  { icon: "🏰", name: "Castle" },
  { icon: "🌳", name: "Tree" },
  { icon: "☀️", name: "Sunshine" },
  { icon: "🌅", name: "Sunset" },
  { icon: "💍", name: "Ring" },
  { icon: "💎", name: "Diamond" },
];

const KEY = "va-progress-icon:v1";
const subs = new Set<() => void>();
const get = () => {
  try {
    const v = localStorage.getItem(KEY) ?? "";
    return CHOICES.some((c) => c.icon === v) ? v : "";
  } catch {
    return "";
  }
};
function set(v: string) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage blocked: this visit only */
  }
  subs.forEach((f) => f());
}
const useChoice = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      const onStorage = (e: StorageEvent) => e.key === KEY && f();
      window.addEventListener("storage", onStorage);
      return () => {
        subs.delete(f);
        window.removeEventListener("storage", onStorage);
      };
    },
    get,
    () => "",
  );

/** The Progress icon as the reader chose it (the outline trophy by default). `size` in px. */
export function ProgressGlyph({ size = 18 }: { size?: number }) {
  const icon = useChoice();
  if (!icon) return <TrophyIcon width={size} height={size} />;
  return (
    <span aria-hidden className="inline-block leading-none" style={{ fontSize: Math.round(size * 0.95) }}>
      {icon}
    </span>
  );
}

/** In the Progress panel's header: the icon, and a tap opens a small grid to choose another. */
export function ProgressIconPicker() {
  const icon = useChoice();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    // the current choice gets focus, so the keyboard starts there
    wrap.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <span ref={wrap} className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Change the Progress icon"
        title="Change the Progress icon"
        className="-m-1.5 flex h-8 w-8 items-center justify-center rounded-md hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ProgressGlyph size={18} />
      </button>
      {open && (
        <span
          role="group"
          aria-label="Choose the Progress icon"
          className="absolute left-0 top-full z-40 mt-2 grid w-64 max-w-[calc(100vw-2rem)] grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 rounded-xl border border-line bg-panel p-2 shadow-xl"
        >
          {CHOICES.map((c) => (
            <button
              key={c.name}
              type="button"
              aria-pressed={icon === c.icon}
              title={c.name}
              aria-label={c.name}
              onClick={() => {
                set(c.icon);
                setOpen(false);
                trigger.current?.focus();
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-raised ${icon === c.icon ? "bg-accent-soft ring-1 ring-accent" : ""}`}
            >
              {c.icon || <TrophyIcon width={18} height={18} />}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
