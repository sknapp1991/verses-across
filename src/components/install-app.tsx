"use client";
/**
 * "Add to Home Screen", as frictionless as each browser allows:
 *  - Android Chrome, Edge, desktop Chrome/Edge: one tap on "Add" opens the browser's own install dialog
 *    (beforeinstallprompt), then the icon appears on the home screen / in the apps list.
 *  - iPhone / iPad: no website can add itself there; the card shows the two taps (Share → Add to Home
 *    Screen) with an arrow pointing at the button to press.
 *  - Android when the browser makes no offer (Samsung Internet, Firefox, or Chrome after its own "not now" or
 *    before it decides to offer): the card shows the two taps for that browser's menu (Nov 11).
 *  - In-app browsers (Instagram, Facebook, TikTok…): can't install; the card says to open the page in the
 *    browser first.
 * The card offers itself once the reader has been reading a little (never on the first page load), not
 * during the welcome tour, and steps back for three weeks after "Not now"; a second "Not now" ends it for
 * good (the button in the settings still adds it any time, and the reader is told so).
 * Never shown when already opened from the home screen.
 */
import { SITE_NAME } from "@/lib/site";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { toast } from "@/lib/ui-store";
import { CloseIcon, ShareIcon } from "./icons";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const KEY = "va-install:v1";
const WAIT_MS = 45_000; // reading time on a chapter page before the card offers itself
const SNOOZE_DAYS = 21;
const MAX_DISMISSALS = 2; // "Not now" once: back in three weeks; twice: never again on its own

let deferred: InstallEvent | null = null;
/** The browser's own install dialog was shown this visit (accepted or not): the card doesn't offer itself again. */
let askedThisVisit = false;
/** Reading time (ms, page visible, on a chapter) this visit, across chapter changes. */
let readMs = 0;
let installed = false;
const subs = new Set<() => void>();
const ping = () => subs.forEach((l) => l());
if (typeof window !== "undefined") {
  // The offer is caught by a tiny script in the page head (it can come before this code loads).
  const w = window as Window & { __vaInstall?: InstallEvent };
  const take = () => {
    if (w.__vaInstall) {
      deferred = w.__vaInstall;
      w.__vaInstall = undefined;
      ping();
    }
  };
  take();
  window.addEventListener("va-bip", take);
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    save({ ...load(), installed: true });
    ping();
    toast(`${SITE_NAME} is on your Home Screen`);
  });
}
const subscribe = (l: () => void) => {
  subs.add(l);
  return () => subs.delete(l);
};

type Saved = { dismissed?: number; count?: number; installed?: boolean };
function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Saved;
  } catch {
    return {};
  }
}
function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

type Platform = "standalone" | "prompt" | "ios-safari" | "ios-other" | "android" | "in-app" | "none";
/** What this browser can do. Only call in the browser. */
function platform(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (installed || nav.standalone || window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches) return "standalone";
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|BytedanceWebview|Line\/|Snapchat|Pinterest|LinkedInApp|GSA\/|; wv\)/i.test(ua)) return "in-app";
  if (deferred) return "prompt";
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // iPad (and Chrome / Edge / Firefox on iPhone): the Share button is at the top. iPhone Safari: at the bottom.
  if (ipad) return "ios-other";
  if (/iPhone|iPod/.test(ua)) return /CriOS|EdgiOS|FxiOS|OPiOS/.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/.test(ua)) return "android";
  return "none";
}

/** The current install option (re-checked when the browser offers or finishes an install). */
export function useInstall() {
  const p = useSyncExternalStore(subscribe, platform, () => "none" as Platform);
  return {
    platform: p,
    /** Something useful can be offered (a one-tap install, or the iPhone steps). */
    available: p === "prompt" || p === "ios-safari" || p === "ios-other" || p === "android" || p === "in-app",
  };
}

/** Android / desktop: open the browser's install dialog. Returns true when the reader accepted. */
async function promptInstall() {
  const e = deferred;
  if (!e) return false;
  deferred = null; // a prompt event can be used once
  askedThisVisit = true;
  ping();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === "accepted";
  } catch {
    return false;
  }
}

/** The card at the bottom of the screen (mounted once, in the app shell). */
export function InstallCard() {
  const { platform: p, available } = useInstall();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState(false);
  // Opened by the reader from the settings: closing it then isn't a "Not now".
  const [manual, setManual] = useState(false);

  // Offer once the reader has spent a little while reading (counted across chapters), not during the welcome
  // tour, not over an open sheet, and not while the read-aloud player is open.
  const reading = pathname.startsWith("/read/"); // a chapter (not the home page, /read)
  useEffect(() => {
    if (!available || open || !reading || askedThisVisit) return;
    const s = load();
    if (s.installed || (s.count ?? 0) >= MAX_DISMISSALS) return;
    if (s.dismissed && Date.now() - s.dismissed < SNOOZE_DAYS * 86_400_000) return;
    const STEP = 5000;
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      readMs += STEP;
      if (readMs < WAIT_MS) return;
      let tourDone = true;
      try {
        tourDone = localStorage.getItem("va-tour:v1") === "done";
      } catch {
        /* private mode */
      }
      if (!tourDone || document.querySelector("dialog[open]") || document.querySelector('[aria-label="Read aloud"]')) return;
      window.clearInterval(t);
      setOpen(true);
    }, STEP);
    return () => window.clearInterval(t);
  }, [available, open, reading]);

  // Escape closes the card (as "Not now").
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") document.querySelector<HTMLButtonElement>('[data-install-close]')?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Opened elsewhere (the settings button): show straight away.
  useEffect(() => {
    const show = () => {
      if (deferred) return void promptInstall();
      setManual(true);
      setSteps(true);
      setOpen(true);
    };
    window.addEventListener("va-install", show);
    return () => window.removeEventListener("va-install", show);
  }, []);

  // iPhone pre-fills the Home Screen name from the page title ("John 3 · Holy Bible…"), not from the app name:
  // while the steps are showing, the title is just the site's name (put back when the card closes).
  const iosSteps = open && steps && (p === "ios-safari" || p === "ios-other");
  useEffect(() => {
    if (!iosSteps) return;
    const before = document.title;
    const hold = () => {
      if (document.title !== SITE_NAME) document.title = SITE_NAME;
    };
    hold();
    const t = window.setInterval(hold, 500); // a page change sets its own title again
    return () => {
      window.clearInterval(t);
      document.title = before;
    };
  }, [iosSteps]);

  // The Android steps were open when the browser made its own offer: show its one-tap Add instead.
  if (steps && p === "prompt") setSteps(false);
  if (!open || p === "standalone" || p === "none") return null;

  const dismiss = () => {
    if (manual) {
      setOpen(false);
      setSteps(false);
      setManual(false);
      return;
    }
    const s = load();
    const count = (s.count ?? 0) + 1;
    save({ ...s, dismissed: Date.now(), count });
    setOpen(false);
    setSteps(false);
    if (count === MAX_DISMISSALS) toast("Okay, we won’t ask again. “Add to Home Screen” is in the settings any time.", 4500);
  };
  const add = async () => {
    if (p === "prompt") {
      await promptInstall(); // cancelling the browser's dialog is not a "Not now": nothing is counted
      setOpen(false);
      return;
    }
    setSteps(true);
  };

  const safariArrow = p === "ios-safari" && steps; // Safari's Share / ••• button is in the bottom bar
  const topArrow = p === "ios-other" && steps; // Chrome / Edge / Firefox on iPhone: Share is at the top right

  return (
    <>
      <div
        role="region"
        aria-live="polite"
        aria-label={`Add ${SITE_NAME} to your Home Screen`}
        data-no-swipe
        className={`install-card fixed inset-x-3 z-[45] mx-auto max-w-md rounded-2xl border border-line bg-panel p-3 shadow-2xl ${
          topArrow ? "top-[calc(env(safe-area-inset-top)+0.75rem)]" : "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]"
        } ${safariArrow ? "mb-16" : ""}`}
      >
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the app's own icon, tiny and static */}
          <img src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">Add {SITE_NAME} to your Home Screen</p>
            {!steps ? (
              <p className="mt-0.5 text-sm text-muted">Opens full screen like an app, with no browser bars. Works offline.</p>
            ) : p === "in-app" ? (
              <p className="mt-0.5 text-sm text-muted">
                This app’s built-in browser can’t do it. Tap <strong className="text-ink">•••</strong> (or the share icon) and choose{" "}
                <strong className="text-ink">Open in browser</strong>, then add it from there.
              </p>
            ) : p === "android" ? (
              <AndroidSteps />
            ) : (
              <ol className="mt-1 space-y-1 text-sm text-muted">
                <li className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">1</span>
                  <span>
                    Tap {p === "ios-safari" ? <><strong className="text-ink">•••</strong> or </> : null}
                    <strong className="inline-flex items-center gap-0.5 text-ink">
                      Share <ShareIcon width={14} height={14} />
                    </strong>{" "}
                    {p === "ios-safari" ? "below" : "at the top"}
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">2</span>
                  <span>
                    Choose <strong className="text-ink">Add to Home Screen</strong> <span className="text-faint">(swipe up on the menu if you don’t see it)</span>
                  </span>
                </li>
              </ol>
            )}
          </div>
          <button type="button" onClick={dismiss} aria-label="Not now" data-install-close className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-faint hover:text-ink">
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        {!steps && (
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={dismiss} className="min-h-11 flex-1 rounded-xl border border-line text-sm text-muted hover:text-ink">
              Not now
            </button>
            <button type="button" onClick={add} className="min-h-11 flex-[2] rounded-xl bg-accent text-sm font-semibold text-accent-ink">
              {p === "prompt" ? "Add to Home Screen" : p === "in-app" ? "How?" : "Show me how"}
            </button>
          </div>
        )}
      </div>
      {/* The arrow pointing at the button to press. */}
      {(safariArrow || topArrow) && (
        <div
          aria-hidden
          className={`animate-bounce pointer-events-none fixed z-[45] text-accent ${
            safariArrow ? "bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-1/2 -translate-x-1/2" : "right-4 top-[calc(env(safe-area-inset-top)+0.25rem)] rotate-180"
          }`}
        >
          <svg width="36" height="44" viewBox="0 0 36 44" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 4v34M6 27l12 12 12-12" />
          </svg>
        </div>
      )}
    </>
  );
}

/** Android without the browser's own offer: the two taps in this browser's menu. */
function AndroidSteps() {
  const ua = navigator.userAgent;
  const samsung = /SamsungBrowser/.test(ua);
  const firefox = /Firefox/.test(ua);
  const edge = /EdgA\//.test(ua);
  const n = (k: number) => <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{k}</span>;
  return (
    <ol className="mt-1 space-y-1 text-sm text-muted">
      <li className="flex items-center gap-1.5">
        {n(1)}
        <span>
          Tap the menu{" "}
          {samsung ? (
            <><strong className="text-ink">☰</strong> at the bottom right</>
          ) : edge ? (
            <><strong className="text-ink">☰</strong> or <strong className="text-ink">•••</strong> at the bottom</>
          ) : firefox ? (
            <><strong className="text-ink">⋮</strong> (top or bottom right)</>
          ) : (
            <><strong className="text-ink">⋮</strong> (top or bottom right)</>
          )}
        </span>
      </li>
      <li className="flex items-center gap-1.5">
        {n(2)}
        <span>
          {samsung ? (
            <>Choose <strong className="text-ink">Add page to</strong>, then <strong className="text-ink">Home screen</strong></>
          ) : edge ? (
            <>Choose <strong className="text-ink">Add to phone</strong> <span className="text-faint">(or Add to Home screen)</span></>
          ) : (
            <>Choose <strong className="text-ink">Add to Home screen</strong> or <strong className="text-ink">Install</strong> <span className="text-faint">(swipe up on the menu if you don’t see it)</span></>
          )}
        </span>
      </li>
    </ol>
  );
}

/** For the settings: "Add to Home Screen" (hidden when already installed or not possible here). */
export function InstallAppButton({ onDone }: { onDone?: () => void }) {
  const { platform: p, available } = useInstall();
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        onDone?.();
        if (p === "prompt") await promptInstall();
        else window.dispatchEvent(new Event("va-install"));
      }}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm text-muted hover:text-ink"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- the app's own icon */}
      <img src="/icon-192.png" alt="" width={18} height={18} className="rounded" /> Add to Home Screen
    </button>
  );
}
