"use client";
/**
 * Floating chapter buttons: a see-through pill [‹ ⋮ ›] that's always there (fainter while scrolling).
 * Drag it by the middle grip anywhere on the screen — over the tabs or search bar too — and it stays
 * where you leave it (this device). Double-tap / double-click the grip to put it back.
 * Phone: it sits in the bottom right corner by default and hides while the chapter's own arrows show.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { chapterTitle, findBook, readHref, type BookRef } from "@/lib/catalog";
import { useMediaQuery, WIDE_QUERY } from "@/lib/settings";
import { ChevronLeft, ChevronRight } from "./icons";

const KEY = "gs:navpos:v1"; // { x, y } as fractions of the window (pill centre)
type Pos = { x: number; y: number };
const DEFAULT: Pos = { x: 0.5, y: 0.9 };

function readPos(): Pos | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null") as Pos | null;
    return p && typeof p.x === "number" && typeof p.y === "number" ? p : null;
  } catch {
    return null;
  }
}

const label = (r: BookRef) => chapterTitle(findBook(r.work, r.book), r.chapter, r.book);

/** The bottom safe area (home indicator) in px, measured once with a probe (CSS env() can't be read directly). */
let safeBottomPx: number | null = null;
function safeAreaBottom() {
  if (typeof document === "undefined") return 0;
  if (safeBottomPx == null) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;height:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(probe);
    safeBottomPx = probe.offsetHeight;
    probe.remove();
  }
  return safeBottomPx;
}

export function FloatingNav({ prev, next, versions, faint, raised }: { prev?: BookRef; next?: BookRef; versions: string[]; faint: boolean; raised: boolean }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [custom, setCustom] = useState(false); // moved by the user (else the default spot)
  const lastTap = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => {
      const saved = readPos();
      setPos(saved ?? DEFAULT);
      setCustom(!!saved);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  // While the read-aloud bar is open, sit just above it, following it as it grows and shrinks.
  const [barTop, setBarTop] = useState<number | null>(null);
  useEffect(() => {
    if (!raised) return;
    let cur: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    const find = () => {
      const el = document.querySelector<HTMLElement>('[role="region"][aria-label="Read aloud"]');
      if (el === cur) return;
      cur = el;
      ro?.disconnect();
      ro = null;
      if (!el) return setBarTop(null);
      ro = new ResizeObserver(() => setBarTop(el.getBoundingClientRect().top));
      ro.observe(el);
    };
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true });
    const t = setTimeout(find, 0);
    return () => {
      clearTimeout(t);
      mo.disconnect();
      ro?.disconnect();
    };
  }, [raised]);
  // Keep it on screen when the window changes size.
  useEffect(() => {
    const onResize = () => setPos((p) => (p ? { ...p } : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Phone: while the chapter's own ‹ › buttons (under its name, and at its end) are on screen, the pill
  // steps aside, so there's never two sets of arrows at once.
  const wide = useMediaQuery(WIDE_QUERY, true);
  const [navSeen, setNavSeen] = useState(false);
  const chapter = `${prev?.work}/${prev?.book}/${prev?.chapter}|${next?.work}/${next?.book}/${next?.chapter}`;
  useEffect(() => {
    if (wide) return; // (navSeen is only ever true on a phone, and the class below also checks `wide`)
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      setNavSeen([...seen.values()].some(Boolean));
    });
    const t = setTimeout(() => document.querySelectorAll("[data-chapter-nav]").forEach((el) => io.observe(el)), 0);
    return () => {
      clearTimeout(t);
      io.disconnect();
    };
  }, [wide, chapter]);
  if (!pos) return null;

  const W = typeof window === "undefined" ? 400 : window.innerWidth;
  const H = typeof window === "undefined" ? 800 : window.innerHeight;
  const pw = 124; // the pill's size (two 44px buttons, the grip, padding)
  const ph = 48;
  // The default spot moves up above the read-aloud bar while it's open.
  const y = !custom && raised ? 0.78 : pos.y;
  // Phone default: the bottom right corner (out of the way of the text); above the player, or its chip, while it reads.
  const phoneDefault = !wide && !custom;
  const left = Math.min(W - pw - 6, Math.max(6, phoneDefault ? W - pw - 10 : pos.x * W - pw / 2));
  const above = !custom && raised ? (barTop != null ? barTop - ph - 10 : !wide ? H - ph - 12 - 60 : null) : null;
  // Phone default: above the home indicator (the bottom safe area is ~34 px in full screen on iPhones).
  const safeBottom = safeAreaBottom();
  const top = Math.min(H - ph - 6, Math.max(6, above ?? (phoneDefault ? H - ph - 18 - safeBottom : y * H - ph / 2)));
  const aside = !wide && navSeen && !dragging;

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastTap.current < 350) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      setPos(DEFAULT);
      setCustom(false);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = left + pw / 2;
    const oy = top + ph / 2;
    let moved = false;
    let last = pos;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      setDragging(true);
      last = { x: (ox + dx) / window.innerWidth, y: (oy + dy) / window.innerHeight };
      setPos(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDragging(false);
      if (moved) {
        setCustom(true);
        try {
          localStorage.setItem(KEY, JSON.stringify(last));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const btn = "flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-raised/80 disabled:opacity-30";
  return (
    <div
      data-no-swipe
      style={{ left, top }}
      className={`fixed z-40 flex items-center gap-0.5 rounded-full border border-line/70 bg-panel/55 p-0.5 shadow-lg backdrop-blur-sm transition-opacity duration-300 ${
        aside ? "pointer-events-none opacity-0" : dragging ? "opacity-100" : faint ? "opacity-40 hover:opacity-100" : "opacity-90"
      }`}
      aria-hidden={aside || undefined}
      inert={aside || undefined}
      role="navigation"
      aria-label="Chapter"
    >
      {prev ? (
        <Link href={readHref(prev, versions)} aria-label={`Previous chapter: ${label(prev)}`} title={label(prev)} className={btn}>
          <ChevronLeft />
        </Link>
      ) : (
        <span className={`${btn} opacity-30`} aria-hidden>
          <ChevronLeft />
        </span>
      )}
      <button
        type="button"
        onPointerDown={startDrag}
        aria-label="Move these buttons (drag). Double-tap to put them back."
        title="Drag to move · double-tap to reset"
        className={`flex h-11 w-6 cursor-grab touch-none items-center justify-center text-faint hover:text-ink ${dragging ? "cursor-grabbing" : ""}`}
      >
        <svg width="8" height="18" viewBox="0 0 8 18" aria-hidden fill="currentColor">
          {[2, 7, 12, 17].flatMap((cy) => [<circle key={`a${cy}`} cx="2" cy={cy - 1} r="1.4" />, <circle key={`b${cy}`} cx="6" cy={cy - 1} r="1.4" />])}
        </svg>
      </button>
      {next ? (
        <Link href={readHref(next, versions)} aria-label={`Next chapter: ${label(next)}`} title={label(next)} className={btn}>
          <ChevronRight />
        </Link>
      ) : (
        <span className={`${btn} opacity-30`} aria-hidden>
          <ChevronRight />
        </span>
      )}
    </div>
  );
}
