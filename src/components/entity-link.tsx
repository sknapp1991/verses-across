"use client";
/**
 * A person or place named in an AI answer (ticket 839c4446): the model marks it [[Article title|shown text]]; it shows
 * in the logo's blue, and hover (desktop) or a tap (phone) opens a short card from Wikipedia: picture, one-line
 * description and the opening of the article, with a link to read more. Looked up straight from the reader's browser
 * (Wikipedia sees the name and the reader's IP address, as for any site; see About → Privacy); cached for the session.
 * The card is put on document.body (a portal), not inside the answer's paragraph or list item.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/lib/settings";

type Summary = { title: string; description?: string; extract: string; image?: string; url: string } | null;
const cache = new Map<string, Promise<Summary>>();
const https = (u: unknown) => (typeof u === "string" && u.startsWith("https://") ? u : undefined);

function summary(title: string): Promise<Summary> {
  let p = cache.get(title);
  if (!p) {
    const page = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    p = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        d && d.type !== "disambiguation" && typeof d.extract === "string" && d.extract
          ? {
              title: String(d.title ?? title),
              description: typeof d.description === "string" ? d.description : undefined,
              extract: d.extract,
              image: https(d.thumbnail?.source),
              url: https(d.content_urls?.desktop?.page) ?? page,
            }
          : null,
      )
      .catch(() => null);
    p.then((s) => s === null && cache.delete(title)); // a failed lookup can be tried again later
    cache.set(title, p);
  }
  return p;
}

/** Only one card at a time: the open card's own closer. */
let closeOpen: (() => void) | null = null;

type Pos = { left: number; top?: number; bottom?: number; max: number };

export function EntityLink({ title, text }: { title: string; text: string }) {
  const touch = useMediaQuery("(hover: none)", false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [data, setData] = useState<Summary | undefined>(undefined);
  const link = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mine = useRef<(() => void) | null>(null);

  const place = (): Pos | null => {
    const el = link.current;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    if (b.bottom < 0 || b.top > window.innerHeight) return null; // scrolled out of sight
    const W = Math.min(340, window.innerWidth - 16);
    const left = Math.max(8, Math.min(b.left, window.innerWidth - W - 8));
    // Below the name if the card fits there (~420px), else the side with more room; capped to that room so the
    // "Read more" line stays on screen (the text scrolls inside).
    const below = window.innerHeight - b.bottom - 14;
    const above = b.top - 14;
    return below >= 420 || below >= above ? { left, top: b.bottom + 6, max: below } : { left, bottom: window.innerHeight - b.top + 6, max: above };
  };
  const show = () => {
    const p = place();
    if (!p) return;
    if (closeOpen !== mine.current) closeOpen?.();
    setPos(p);
    mine.current = () => setPos(null);
    closeOpen = mine.current;
    void summary(title).then(setData);
  };
  const hide = () => {
    setPos(null);
    if (closeOpen === mine.current) closeOpen = null; // only clear our own (a late timer mustn't close another card)
  };

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (card.current?.contains(t) || link.current?.contains(t)) return;
      hide();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    // The answer scrolls (by hand, or while a reply streams in): follow the name; close once it's out of sight.
    const onScroll = (e: Event) => {
      if (card.current?.contains(e.target as Node)) return;
      const p = place();
      if (p) setPos(p);
      else hide();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={link}
        type="button"
        aria-expanded={!!pos}
        aria-haspopup="dialog"
        // Phone: tap opens / closes. Desktop: hover opens; a click keeps it open (it never closes what hover opened).
        onClick={() => (touch && pos ? hide() : show())}
        onMouseEnter={() => {
          if (touch) return;
          clearTimeout(timer.current);
          timer.current = setTimeout(show, 250);
        }}
        onMouseLeave={() => {
          clearTimeout(timer.current);
          timer.current = setTimeout(hide, 200);
        }}
        onFocus={() => !touch && show()}
        className="inline cursor-pointer p-0 font-[inherit] text-[#5f8fc4] underline decoration-[#5f8fc4]/60 decoration-dotted underline-offset-2 hover:decoration-solid"
      >
        {text}
      </button>
      {pos &&
        createPortal(
          <div
            ref={card}
            role="dialog"
            aria-label={text}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={() => {
              if (!touch) timer.current = setTimeout(hide, 200);
            }}
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: pos.max }}
            className="fixed z-[60] flex w-[min(340px,calc(100vw-16px))] flex-col rounded-xl border border-line bg-panel p-3 text-left text-sm font-normal not-italic text-ink shadow-2xl"
          >
            {data === undefined ? (
              <p className="animate-pulse text-muted">Looking up {text}…</p>
            ) : data === null ? (
              <p className="text-muted">No short description found for {text}.</p>
            ) : (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
                <div className="flex gap-3">
                  {data.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- a Wikipedia thumbnail, any size
                    <img src={data.image} alt="" className="h-20 w-20 shrink-0 rounded-lg bg-raised object-cover" loading="lazy" referrerPolicy="no-referrer" />
                  )}
                  <div className="min-w-0">
                    <p className="font-serif text-base font-semibold leading-tight">{data.title}</p>
                    {data.description && <p className="mt-0.5 text-xs text-muted">{data.description}</p>}
                  </div>
                </div>
                <p className="leading-snug">{data.extract.length > 600 ? `${data.extract.slice(0, 600).replace(/\s+\S*$/, "")}…` : data.extract}</p>
              </div>
            )}
            <p className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 text-[11px] text-faint">
              <span>
                From Wikipedia,{" "}
                <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  CC BY-SA 4.0
                </a>
                {data?.image ? " (picture: see the article)" : ""}
              </span>
              {data && (
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="font-medium text-[#5f8fc4] hover:underline">
                  Read more →
                </a>
              )}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
