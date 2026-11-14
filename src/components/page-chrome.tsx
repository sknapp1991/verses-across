"use client";
/**
 * The info pages' back link, swipe-back and "Back to top" button (ticket ff8c9d5b, Nov 14).
 * Back from a page opened on the home page goes back to the home page, scrolled where it was (home-page.tsx keeps
 * its scroll and notes which page a tile opened). Opened any other way, Back goes to `fallback` as before.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

export const FROM_HOME = "va-from-home"; // sessionStorage: the path a home-page tile opened
export const HOME_RETURN = "va-home-return"; // sessionStorage: set when going back home (restore its scroll)

function fromHome() {
  try {
    return sessionStorage.getItem(FROM_HOME) === location.pathname;
  } catch {
    return false;
  }
}

const noSubscribe = () => () => {};

function useGoBack(fallback: string) {
  const router = useRouter();
  return () => {
    // Home again (scrolled where it was), not one step back: that may be a #part of this page or a page opened from it.
    if (fromHome()) {
      try {
        sessionStorage.setItem(HOME_RETURN, "1");
      } catch {}
      router.push("/read");
    } else router.push(fallback);
  };
}

/** "← Back to reading", or "← Home" when the page was opened from the home page. */
export function BackLink({ fallback, className, children }: { fallback: string; className?: string; children: ReactNode }) {
  const goBack = useGoBack(fallback);
  const home = useSyncExternalStore(noSubscribe, fromHome, () => false); // read on the client only
  return (
    <a
      href={home ? "/read" : fallback}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        goBack();
      }}
    >
      {home ? "← Home" : children}
    </a>
  );
}

/**
 * Put inside the page's scrolling <main>: swipe left to right to go back; a see-through "Back to top" button once
 * the page is scrolled; a link to a part inside a closed section opens that section.
 */
export function PageChrome({ fallback, top = true }: { fallback: string; top?: boolean }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);
  const goBack = useGoBack(fallback);
  const back = useRef(goBack);
  useEffect(() => {
    back.current = goBack;
  });

  useEffect(() => {
    const main = anchor.current?.closest("main");
    if (!main) return;
    const onScroll = () => setShown(main.scrollTop > 600);
    main.addEventListener("scroll", onScroll, { passive: true });

    // Swipe back: a mostly sideways swipe to the right, not on a control or something that scrolls sideways.
    let x0 = 0,
      y0 = 0,
      t0 = 0,
      on = false;
    const onStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement;
      on = e.touches.length === 1 && !t.closest("input, textarea, select, button, summary, [data-no-swipe], .overflow-x-auto");
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = Date.now();
    };
    const onEnd = (e: TouchEvent) => {
      if (!on) return;
      on = false;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (dx > 80 && Math.abs(dy) < dx * 0.5 && Date.now() - t0 < 800 && !getSelection()?.toString()) back.current();
    };
    main.addEventListener("touchstart", onStart, { passive: true });
    main.addEventListener("touchend", onEnd);

    // #part inside a folded section: unfold it (Fold listens), then scroll there. Also when the same link is tapped again.
    const openHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      const fold = el.closest("[data-fold]");
      if (fold && fold.getAttribute("data-open") !== "1") {
        fold.dispatchEvent(new CustomEvent("va-unfold"));
        setTimeout(() => el.scrollIntoView(), 50);
      }
    };
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href^="#"]');
      if (link) setTimeout(openHash, 0);
    };
    openHash();
    window.addEventListener("hashchange", openHash);
    main.addEventListener("click", onClick);
    return () => {
      main.removeEventListener("scroll", onScroll);
      main.removeEventListener("touchstart", onStart);
      main.removeEventListener("touchend", onEnd);
      window.removeEventListener("hashchange", openHash);
      main.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <>
      <span ref={anchor} hidden />
      {top && shown && (
        <button
          type="button"
          onClick={() => anchor.current?.closest("main")?.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-line bg-raised/60 px-4 py-2 text-sm font-medium text-ink shadow-lg backdrop-blur-md hover:bg-raised/90"
        >
          ↑ Back to top
        </button>
      )}
    </>
  );
}

/** A section that folds away: its heading holds the fold button (ticket ff8c9d5b). Starts open. */
export function Fold({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    const unfold = () => setOpen(true);
    el?.addEventListener("va-unfold", unfold);
    return () => el?.removeEventListener("va-unfold", unfold);
  }, []);
  return (
    <section ref={ref} id={id} data-fold data-open={open ? "1" : "0"} className="scroll-mt-4 space-y-4">
      <h2 className="font-serif text-2xl font-semibold text-ink">
        <button type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left">
          <span aria-hidden className={`text-base text-accent transition-transform ${open ? "rotate-90" : ""}`}>
            ▸
          </span>
          {title}
        </button>
      </h2>
      <div id={`${id}-body`} hidden={!open} className="space-y-4">
        {children}
      </div>
    </section>
  );
}
