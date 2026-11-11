"use client";
/**
 * Read together: a link that opens this chapter, in these versions, at the verse on screen. The friend
 * taps it and is at the same place; the talking happens in whatever app you send it with.
 * Desktop: a pop-up in the top bar (ReadTogether); phone: a tile in the More sheet (useShareHere).
 */
import { SITE_NAME } from "@/lib/site";
import { chapterTitle, findBook, readHref } from "@/lib/catalog";
import { toast } from "@/lib/ui-store";
import { ChatIcon, ShareIcon } from "./icons";
import { useReaderState } from "./use-reader-state";

/** The verse at the top of the reading area (what a friend should land on), if any. */
function topVerse(): string | undefined {
  const els = document.querySelectorAll<HTMLElement>("[data-v]");
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.height && r.bottom > 120) return el.dataset.v;
  }
}

/**
 * Read together: a link that opens this chapter, in these versions, at the verse on screen. The friend
 * taps it and is at the same place; the talking happens in whatever app you send it with.
 */
export function useShareHere() {
  const { ref, versions } = useReaderState();
  return async () => {
    const v = topVerse();
    const url = window.location.origin + readHref(ref, versions, v && v !== "1" ? v : undefined);
    const where = `${chapterTitle(findBook(ref.work, ref.book), ref.chapter, ref.book)}${v && v !== "1" ? `:${v}` : ""}`;
    const text = `Read ${where} with me on ${SITE_NAME}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Read together", text, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}: ${url}`);
      toast("Link copied — paste it in a message to a friend");
    } catch {
      window.prompt("Copy this link:", url);
    }
  };
}

export function ReadTogether() {
  const share = useShareHere();
  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <ShareIcon width={16} height={16} className="text-accent" /> Read together
      </p>
      <p className="text-muted">Send a friend a link to this exact spot: the same chapter, the same versions side by side, at the verse you’re on.</p>
      <button type="button" onClick={share} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 font-medium text-accent-ink">
        <ShareIcon width={16} height={16} /> Share this page
      </button>
      <p className="flex items-center gap-1.5 text-xs text-faint">
        <ChatIcon width={12} height={12} /> Chatting inside the site may come later.
      </p>
    </div>
  );
}

