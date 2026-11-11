"use client";
/**
 * The testers' study chat on /testers (src/app/api/chat/route.ts does the checking). One public room; the link from
 * Skylar's Facebook post carries its code (?c=…). No account: a display name, and a random id kept in this browser.
 * Skylar opens the page once with his private moderator link (#mod=…); the key stays in his browser and gives him
 * Delete, Ban and "New link" (old links stop working). Refreshes every 10 s while the page is visible.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivate, WHERE } from "@/lib/privacy";

type Msg = { id: number; name: string; body: string; at: string; mod: boolean; mine: boolean; member?: string };

const NAME = "va-chat-name";
const MEMBER = "va-chat-member";
const MODKEY = "va-chat-mod";
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) ?? "";
    } catch {
      return "";
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private window: works for this visit */
    }
  },
};
function memberId() {
  let m = store.get(MEMBER);
  if (!/^[a-z0-9]{12,40}$/.test(m)) {
    m = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
    store.set(MEMBER, m);
  }
  return m;
}
const time = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export function TestersChat() {
  const privateMode = usePrivate();
  const [code, setCode] = useState("");
  const [modKey, setModKey] = useState("");
  const [member, setMember] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null); // "del:12" / "ban:12" / "reset": a second tap confirms
  const [newLink, setNewLink] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false); // the address has been read (no flash of "open the link" first)
  const inFlight = useRef(false);
  const firstScroll = useRef(true);

  // read the link once: ?c= (the room), #mod= (Skylar's key, saved here and removed from the address bar)
  useEffect(() => {
    const url = new URL(location.href);
    const m = /^#mod=([A-Za-z0-9_-]{24,})$/.exec(url.hash);
    if (m) {
      store.set(MODKEY, m[1]);
      history.replaceState(null, "", url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address and this browser after hydration
    setCode(url.searchParams.get("c") ?? "");
    setModKey(store.get(MODKEY));
    setMember(memberId());
    setName(store.get(NAME));
    setReady(true);
  }, []);

  const headers = useCallback((): Record<string, string> => ({ "content-type": "application/json", ...(modKey ? { "x-chat-mod": modKey } : {}) }), [modKey]);
  const isMod = !!modKey;

  const load = useCallback(async () => {
    if (!member || privateMode || (!code && !modKey) || inFlight.current) return;
    inFlight.current = true; // a slow connection never stacks requests
    try {
      const res = await fetch(`/api/chat?c=${encodeURIComponent(code)}&m=${member}`, { headers: headers(), cache: "no-store" });
      const j = (await res.json().catch(() => ({}))) as { messages?: Msg[]; error?: string; code?: string };
      if (!res.ok) return setError(j.error ?? "The chat isn't reachable right now.");
      setError(null);
      setMsgs(j.messages ?? []);
      if (j.code && isMod && j.code !== code) setCode(j.code); // the moderator always uses the current link
    } catch {
      setError(navigator.onLine ? "The chat isn't reachable right now." : "You're offline.");
    } finally {
      inFlight.current = false;
    }
  }, [code, member, modKey, isMod, privateMode, headers]);

  useEffect(() => {
    if (!member) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first load of the messages, then every 5 s
    void load();
    const t = window.setInterval(() => document.visibilityState === "visible" && load(), 10000);
    return () => clearInterval(t);
  }, [member, load]);

  // keep the newest message in view when new ones arrive (if the reader is near the bottom)
  const count = msgs?.length ?? 0;
  useEffect(() => {
    const el = list.current;
    if (!el || !count) return;
    // first time: open at the newest message; later: follow new ones only if the reader is near the bottom
    if (firstScroll.current || el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
    firstScroll.current = false;
  }, [count]);

  const send = async () => {
    if (busy || !text.trim()) return;
    if (name.trim().length < 2) return setNotice("Pick a display name first (2 to 30 characters).");
    setBusy(true);
    setNotice(null);
    store.set(NAME, name.trim());
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: headers(), body: JSON.stringify({ c: code, m: member, name: name.trim(), text }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setNotice(j.error ?? "Couldn't send. Try again.");
      else {
        setText("");
        await load();
      }
    } catch {
      setNotice("Couldn't send. Check your connection.");
    }
    setBusy(false);
  };

  const act = async (action: "delete" | "ban" | "reset", id?: number) => {
    const res = await fetch("/api/chat", { method: "POST", headers: headers(), body: JSON.stringify({ action, id }) });
    const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    setConfirm(null);
    if (!res.ok) return setNotice(j.error ?? "That didn't work.");
    if (action === "reset" && j.code) {
      setCode(j.code);
      setNewLink(`${location.origin}/testers?c=${j.code}`);
    }
    await load();
  };

  const box = "rounded-2xl border border-line bg-panel";
  if (privateMode)
    return (
      <section className={`${box} p-4 text-sm`}>
        <h2 className="font-serif text-xl font-semibold text-ink">Testers&rsquo; chat</h2>
        <p className="mt-2">The chat is off while Private mode is on ({WHERE}).</p>
      </section>
    );

  return (
    <section className={`${box} flex flex-col overflow-hidden`} aria-label="Testers' chat">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-serif text-xl font-semibold text-ink">Testers&rsquo; chat</h2>
        {isMod && (
          <button
            type="button"
            onClick={() => (confirm === "reset" ? act("reset") : setConfirm("reset"))}
            className="min-h-9 rounded-lg border border-line px-3 text-sm hover:bg-raised"
          >
            {confirm === "reset" ? "Sure? Old links stop working" : "New link"}
          </button>
        )}
      </div>

      {isMod && (
        <p className="border-b border-line bg-accent-soft px-4 py-2 text-xs text-ink">
          You&rsquo;re the moderator here: Delete or Ban on any message.
          {code ? (
            <>
              {" "}
              Room link: <span className="select-all font-medium">{`${typeof location === "undefined" ? "" : location.origin}/testers?c=${code}`}</span>
            </>
          ) : null}
        </p>
      )}
      {newLink && (
        <p className="border-b border-line px-4 py-2 text-xs text-ink">
          New link (share this one; the old one no longer works): <span className="select-all font-medium">{newLink}</span>
        </p>
      )}

      {!ready ? (
        <p className="p-4 text-sm text-faint">Loading…</p>
      ) : !code && !isMod ? (
        <p className="p-4 text-sm">To join the chat, open the link from Skylar&rsquo;s post. It ends in <code>?c=</code> and a code.</p>
      ) : (
        <>
          <div ref={list} className="max-h-[55dvh] min-h-48 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {error && <p className="text-sm text-ink">{error}</p>}
            {!error && msgs === null && <p className="text-sm text-faint">Loading…</p>}
            {!error && msgs?.length === 0 && <p className="text-sm text-faint">No messages yet. Say hi!</p>}
            {msgs?.map((m) => (
              <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.mine ? "ml-auto bg-accent-soft" : "bg-raised"}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-faint">
                  <span className="font-semibold text-ink">{m.name}</span>
                  {m.mod && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink">Skylar · mod</span>}
                  <span>{time(m.at)}</span>
                  {isMod && m.mod && (
                    <button type="button" className="ml-auto underline" onClick={() => (confirm === `del:${m.id}` ? act("delete", m.id) : setConfirm(`del:${m.id}`))}>
                      {confirm === `del:${m.id}` ? "Delete?" : "Delete"}
                    </button>
                  )}
                  {isMod && !m.mod && (
                    <span className="ml-auto flex gap-1">
                      <button type="button" className="underline" onClick={() => (confirm === `del:${m.id}` ? act("delete", m.id) : setConfirm(`del:${m.id}`))}>
                        {confirm === `del:${m.id}` ? "Delete?" : "Delete"}
                      </button>
                      <button type="button" className="underline" onClick={() => (confirm === `ban:${m.id}` ? act("ban", m.id) : setConfirm(`ban:${m.id}`))}>
                        {confirm === `ban:${m.id}` ? "Ban + delete all?" : "Ban"}
                      </button>
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-ink">{m.body}</p>
              </div>
            ))}
          </div>
          <form
            className="space-y-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              id="chat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="Your display name"
              aria-label="Your display name"
              className="block h-10 w-full rounded-lg border border-line bg-raised px-3 text-base outline-none focus:ring-2 focus:ring-accent/50 md:text-sm"
            />
            <div className="flex gap-2">
              <textarea
                id="chat-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                maxLength={500}
                rows={2}
                placeholder="Write a message…"
                aria-label="Message"
                className="block min-w-0 flex-1 resize-none rounded-lg border border-line bg-raised px-3 py-2 text-base outline-none focus:ring-2 focus:ring-accent/50 md:text-sm"
              />
              <button type="submit" disabled={busy || !text.trim()} className="min-h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink disabled:opacity-50">
                Send
              </button>
            </div>
            {notice && <p className="text-xs text-ink">{notice}</p>}
            <p className="text-[11px] text-faint">
              Everyone with the link can read the chat. Be kind; no links. Messages are deleted after 30 days. Skylar moderates.
            </p>
          </form>
        </>
      )}
    </section>
  );
}
