"use client";
/**
 * The small chat window in a study group (hub a3b33a99), in the same spot as the Invite card: names in their own
 * colour, the time, ✓ once a message is stored, and "/w name message" for a whisper (pink) only the two of you can
 * read. While open and visible it checks for new messages every 15 s, every 5 s for a minute after anything
 * happens, and pauses a minute if the server says too many requests (the limit is shared per network: one home's
 * or church's Wi-Fi).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ensureWhisperKeys, loadChat, sendChat, type ChatLine } from "@/lib/group-chat";
import { getGroups, type Member, type MyGroup } from "@/lib/groups";

/** A colour per person (the same on every device): a hue from their member id, lightness from the theme. */
const hue = (id: string) => parseInt(id.slice(0, 6), 16) % 360;
const time = (t: number) => {
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString([], today ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
const SLOW = 15_000;
const FAST = 5_000;

export function GroupChat({ g, members, onKeysMade, onStale }: { g: MyGroup; members: Member[]; onKeysMade: () => void; onStale: () => void }) {
  const [lines, setLines] = useState<ChatLine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const busyUntil = useRef(0); // after activity: check often until then
  const pauseUntil = useRef(0); // after "too many requests"
  const gen = useRef(0); // only the newest check's answer counts
  const staleAt = useRef(0);
  const count = useRef(-1); // lines last shown (a change = activity: check often for a minute)
  const names = new Map(members.map((m) => [m.id, m]));

  // This device's whisper keys, the first time the chat opens (then my card carries the public half).
  useEffect(() => {
    if (g.dh) return;
    void ensureWhisperKeys(g.code).then((x) => x && onKeysMade());
  }, [g.code, g.dh, onKeysMade]);

  const poll = useCallback(async () => {
    if (Date.now() < pauseUntil.current) return;
    const me = getGroups().find((x) => x.code === g.code);
    if (!me) return;
    const my = ++gen.current;
    try {
      const r = await loadChat(me, members, etag.current);
      if (my !== gen.current) return;
      if (r !== "same") {
        if (count.current >= 0 && r.lines.length !== count.current) busyUntil.current = Date.now() + 60_000;
        count.current = r.lines.length;
        etag.current = r.etag;
        setLines(r.lines);
        // someone new, or a whisper key we don't have yet: reload the group's list (at most every 20 s)
        if (r.stale && Date.now() - staleAt.current > 20_000) {
          staleAt.current = Date.now();
          onStale();
        }
      }
      setErr(null);
    } catch (e) {
      if (my !== gen.current) return;
      const msg = (e as Error).message;
      if (/too many/i.test(msg)) pauseUntil.current = Date.now() + 60_000;
      setErr(msg);
    }
  }, [g.code, members, onStale]);

  useEffect(() => {
    etag.current = null; // members changed (a new key, a new name): read everything again
    let t = 0;
    let live = true; // (a check still in flight when the chat closes must not schedule another)
    const loop = async () => {
      if (document.visibilityState === "visible") await poll();
      if (live) t = window.setTimeout(loop, Date.now() < busyUntil.current ? FAST : SLOW);
    };
    void loop();
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [poll]);

  // keep the newest line in view, unless the reader has scrolled up to read earlier ones
  const nearBottom = useRef(true);
  useEffect(() => {
    const el = list.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [lines, sending]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    busyUntil.current = Date.now() + 60_000;
    nearBottom.current = true;
    setSending(text);
    setDraft("");
    const me = getGroups().find((x) => x.code === g.code) ?? g;
    const e = await sendChat(me, members, text).catch((x) => (x as Error).message);
    setSending(null);
    if (e) {
      setErr(e);
      setDraft(text);
      if (/hasn’t opened the chat/.test(e)) onStale(); // they may have, since the list was loaded
      return;
    }
    setErr(null);
    await poll();
  };

  const nameOf = (id: string) => names.get(id)?.name ?? "Someone not in the list";
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2">
      <div
        ref={list}
        role="log"
        aria-label="Group chat"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="max-h-72 min-h-24 space-y-1.5 overflow-y-auto overscroll-contain py-1 text-sm"
      >
        {lines === null && !err && <p className="text-xs text-faint">Loading the chat…</p>}
        {lines?.length === 0 && <p className="text-xs text-faint">No messages yet. Say hello! To whisper to one person: /w name message</p>}
        {lines?.map((l) => {
          const other = l.whisper ? nameOf(l.mine ? l.whisper.to : l.from) : null;
          return (
            <p key={l.id} className="break-words leading-snug" style={l.whisper ? { color: "var(--whisper)" } : undefined}>
              <span className="font-semibold" style={l.whisper ? undefined : { color: `hsl(${hue(l.from)} 65% var(--name-l))` }}>
                {l.mine ? "You" : nameOf(l.from)}
              </span>
              {l.whisper && <span className="text-xs"> {l.mine ? `whisper to ${other}` : "whispers to you"}</span>}
              <span className="text-faint">: </span>
              <span className={l.whisper ? "" : "text-ink"}>{l.text}</span>
              <span className="ml-1.5 whitespace-nowrap text-[11px] text-faint">
                {time(l.at)}
                {l.mine && (
                  <>
                    <span aria-hidden> ✓</span>
                    <span className="sr-only">, sent</span>
                  </>
                )}
              </span>
            </p>
          );
        })}
      </div>
      {sending && (
        <p aria-hidden className="break-words text-sm leading-snug opacity-60">
          <span className="font-semibold">You</span>: {sending} <span className="text-[11px] text-faint">sending…</span>
        </p>
      )}
      {err && (
        <p role="alert" className="text-xs text-red-600">
          {err}
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor={`chat-${g.code}`}>
          Message
        </label>
        <input
          id={`chat-${g.code}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1100}
          placeholder="Message, or /w name …"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <button type="submit" disabled={!draft.trim() || !!sending} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-50">
          Send
        </button>
      </form>
      <p className="text-[11px] text-faint">
        Anyone with this group&rsquo;s code can read the chat; a whisper only the two of you. Messages stay after someone leaves.
      </p>
    </div>
  );
}
