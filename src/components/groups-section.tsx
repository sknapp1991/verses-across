"use client";
/**
 * Study groups (their own panel, from the top bar): create one, invite friends (link, code or QR), see everyone's
 * streak, time this week and progress in the group's book. Plus the prompt shown when an invite link
 * is opened.
 */
import { GroupChat } from "./group-chat";
import { sendChat } from "@/lib/group-chat";
import { StreakIcon } from "./streak-icon";
import { SITE_NAME } from "@/lib/site";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { chapterTitle, findBook, readHref, DEFAULT_VERSIONS } from "@/lib/catalog";
import {
  bookLabel,
  createGroup,
  getGroups,
  inviteLink,
  joinGroup,
  leaveGroup,
  loadGroup,
  pendingInvite,
  updateMeta,
  updateMyGroup,
  useGroups,
  type GroupView,
  type Member,
  type MyGroup,
  readingList,
  groupRole,
  myRole,
  roleOf,
  withAdded,
  withCurrent,
  withFinished,
  withRemoved,
  type GroupMeta,
} from "@/lib/groups";
import { useGroupsUnread } from "@/lib/group-unread";
import { BADGES } from "@/lib/achievements";
import { fmtDuration } from "@/lib/activity";
import { closePanel, openPanel, toast } from "@/lib/ui-store";
import { CloseIcon, UsersIcon } from "./icons";
import { Modal } from "./modal";
import { Qr } from "./qr";
import { useReaderState } from "./use-reader-state";
import { PanelHeader } from "./panel-header";

const NAME_KEY = "va-group-name";
const savedName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
};
const rememberName = (n: string) => {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
};
const field = "h-10 w-full rounded-lg border border-line bg-raised px-3 text-base outline-none focus:ring-2 focus:ring-accent/50 md:text-sm";
const btn = "min-h-10 rounded-lg px-3 text-sm";

/** The Study groups panel (side dock on a wide screen, a sheet on a phone). */
/**
 * Open the Study groups panel with one group's card open at its chat (the home page's Study groups tile: my
 * brother's ticket f3779423, "1 click" to a group's chat). A group of one has no chat yet: its card opens.
 */
const FOCUS = "va-group-focus";
let focusCode: string | null = null;
export function openGroupChat(code: string) {
  focusCode = code;
  openPanel("groups");
  window.dispatchEvent(new CustomEvent(FOCUS, { detail: code }));
}

export function GroupsPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader icon={<UsersIcon width={18} height={18} />} title="Study groups" onClose={() => closePanel("groups")} closeLabel="Close Study groups" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <GroupsSection heading={false} />
      </div>
    </div>
  );
}

export function GroupsSection({ heading = true }: { heading?: boolean }) {
  const groups = useGroups();
  const [mode, setMode] = useState<null | "create" | "join">(null);
  return (
    <section className="space-y-2" aria-label="Study groups">
      {heading && <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Study groups</h3>}
      {groups.length === 0 && !mode && (
        <p className="text-sm text-muted">Study with friends or family: see each other’s streaks and progress, and read a book together. No accounts.</p>
      )}
      {groups.map((g) => (
        <GroupCard key={g.code} g={g} />
      ))}
      {mode === "create" ? (
        <CreateForm onDone={() => setMode(null)} />
      ) : mode === "join" ? (
        <JoinForm onDone={() => setMode(null)} />
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("create")} className={`${btn} flex-1 border border-dashed border-line text-muted hover:bg-raised hover:text-ink`}>
            + New group
          </button>
          <button type="button" onClick={() => setMode("join")} className={`${btn} flex-1 border border-dashed border-line text-muted hover:bg-raised hover:text-ink`}>
            Join with a code
          </button>
        </div>
      )}
    </section>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { ref } = useReaderState();
  const book = findBook(ref.work, ref.book);
  const [name, setName] = useState("");
  const [me, setMe] = useState(savedName);
  const [withBook, setWithBook] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 rounded-xl border border-line bg-raised/50 p-3 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!me.trim()) return setErr("Add the name the group will see.");
        setBusy(true);
        try {
          rememberName(me.trim());
          await createGroup(name, me, withBook && book ? { work: ref.work, book: ref.book } : null);
          toast("Group created. Invite people with the link");
          onDone();
        } catch (x) {
          setErr((x as Error).message);
        }
        setBusy(false);
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Family Bible study" aria-label="Group name" maxLength={60} className={field} autoFocus />
      <input value={me} onChange={(e) => setMe(e.target.value)} placeholder="Your name in the group" aria-label="Your name in the group" maxLength={40} className={field} />
      {book && (
        <label className="flex items-center gap-2 text-muted">
          <input type="checkbox" checked={withBook} onChange={(e) => setWithBook(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          Read {book.name} together (everyone’s progress in it is shown)
        </label>
      )}
      {err && <p role="alert" className="text-ink">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`${btn} flex-1 bg-accent font-medium text-accent-ink disabled:opacity-60`}>
          {busy ? "Creating…" : "Create group"}
        </button>
        <button type="button" onClick={onDone} className={`${btn} text-muted hover:bg-raised`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function JoinForm({ onDone, code }: { onDone: () => void; code?: string }) {
  const [input, setInput] = useState(code ?? "");
  const [me, setMe] = useState(savedName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 rounded-xl border border-line bg-raised/50 p-3 text-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!me.trim()) return setErr("Add the name the group will see.");
        setBusy(true);
        rememberName(me.trim());
        const r = await joinGroup(input, me);
        setBusy(false);
        if (r) return setErr(r);
        toast("You joined the group");
        onDone();
        openPanel("groups");
      }}
    >
      {!code && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Group code or invite link"
          aria-label="Group code or invite link"
          autoComplete="off"
          spellCheck={false}
          className={`${field} font-mono`}
          autoFocus
        />
      )}
      <input value={me} onChange={(e) => setMe(e.target.value)} placeholder="Your name in the group" aria-label="Your name in the group" maxLength={40} className={field} autoFocus={!!code} />
      <p className="text-xs text-faint">The group sees your name, streak, time this week, chapters of the group’s book you’ve studied and heard, and your scorecard (level, badges and totals). You can turn that off after joining.</p>
      {err && <p role="alert" className="text-ink">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`${btn} flex-1 bg-accent font-medium text-accent-ink disabled:opacity-60`}>
          {busy ? "Joining…" : "Join group"}
        </button>
        <button type="button" onClick={onDone} className={`${btn} text-muted hover:bg-raised`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return "now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** Progress in the group's book: "Studied" (chapters marked studied) in the accent colour, "Heard" (listened all the way through) in teal. */
/** The first time a group is opened on this device: how groups work, in three lines (hub a92da77c). */
function HowGroupsWork() {
  const KEY = "va-groups-howto:v1";
  const [shown, setShown] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's note is only readable after hydration
      if (!localStorage.getItem(KEY)) setShown(true);
    } catch {
      /* fine without */
    }
  }, []);
  if (!shown) return null;
  return (
    <div className="rounded-lg border border-line px-3 py-2 text-xs text-muted">
      <p className="mb-1 font-semibold text-ink">How groups work</p>
      <ul className="list-disc space-y-0.5 pl-4">
        <li>The group has readings; ★ marks the focus. Tap a book to see everyone&apos;s chapters of it (only on your screen).</li>
        <li>The owner and the moderators they pick add books and set the focus; when everyone finishes one, it&apos;s marked ✓.</li>
        <li>Once someone joins, tap 💬 Chat to talk with the group; tap a name to see their scorecard.</li>
      </ul>
      <button
        type="button"
        onClick={() => {
          setShown(false);
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
        }}
        className="mt-1.5 text-accent underline-offset-2 hover:underline"
      >
        Got it
      </button>
    </div>
  );
}

function BookBar({ kind, done, total, book }: { kind: "Studied" | "Heard"; done: number; total: number; book: string }) {
  return (
    <p className="mt-1 flex items-center gap-2 text-[11px] text-muted" role="img" aria-label={`${kind} ${done} of ${total} chapters of ${book}`}>
      <span className="w-12 shrink-0" aria-hidden>
        {kind}
      </span>
      <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={`block h-full rounded-full ${kind === "Studied" ? "bg-accent" : "bg-heard"}`} style={{ width: `${Math.min(100, (done / total) * 100)}%` }} />
      </span>
      <span className="shrink-0 tabular-nums" aria-hidden>
        {done}/{total}
      </span>
    </p>
  );
}


/** A member's scorecard: level, totals and badges, as they share them with the group. */
function Scorecard({ id, m, onClose }: { id: string; m: Member; onClose: () => void }) {
  const p = m.profile!;
  const [all, setAll] = useState(false);
  // a card comes from someone else's device: take only what has the right shape
  const ids = Array.isArray(p.badges) ? [...new Set(p.badges.filter((b) => typeof b === "string"))] : [];
  const badges = ids.map((b) => BADGES.find((x) => x.id === b)).filter((b): b is (typeof BADGES)[number] => !!b);
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : 0);
  const show = all ? badges : badges.slice(0, 12);
  const rows: [string, string][] = [
    ["Chapters read", String(n(p.chaptersRead))],
    ["Chapters heard", String(n(p.chaptersHeard))],
    ["Chapters studied", String(n(p.studied))],
    ["Best streak", `${n(p.bestStreak)} ${n(p.bestStreak) === 1 ? "day" : "days"}`],
    ["Time reading and listening", fmtDuration(n(p.mins) * 60)],
    ["Books finished", String(n(p.booksDone))],
    ["Traditions explored", String(n(p.traditions))],
  ];
  return (
    <div
      id={id}
      role="region"
      aria-label={`${m.name}’s scorecard`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="mt-2 rounded-lg border border-line bg-raised p-3 text-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <p>
          <span className="text-sm font-semibold text-ink">Level {n(p.level) || 1}</span>
          {typeof p.title === "string" && <span className="text-muted"> · {p.title.slice(0, 30)}</span>}
        </p>
        <button type="button" onClick={onClose} aria-label={`Close ${m.name}’s scorecard`} className="-m-2 rounded p-2.5 text-faint hover:text-ink">
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 font-medium text-ink">Badges ({badges.length})</p>
      {badges.length ? (
        <>
          <ul className="mt-1 flex flex-wrap gap-1">
            {show.map((b) => (
              <li key={b.id} title={b.how} className="rounded-full border border-line px-2 py-0.5 text-ink">
                <span aria-hidden>{b.icon}</span> {b.name}
              </li>
            ))}
          </ul>
          {badges.length > 12 && (
            <button type="button" onClick={() => setAll(!all)} className="mt-1 text-accent underline-offset-2 hover:underline">
              {all ? "Show fewer" : `Show all ${badges.length}`}
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-faint">No badges yet.</p>
      )}
    </div>
  );
}

/** Which of a group's readings this device shows progress for: { group code: "work/book" } (none: the focus). */
const VIEWING = "va-group-viewing:v1";

function GroupCard({ g }: { g: MyGroup }) {
  const { ref } = useReaderState();
  const [view, setView] = useState<GroupView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // (opened at its chat from the home page: a card mounting now, or one already on screen)
  const [wantChat, setWantChat] = useState(() => {
    if (focusCode !== g.code) return false;
    focusCode = null;
    return true;
  });
  const [open, setOpen] = useState(wantChat);
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== g.code) return;
      focusCode = null;
      setOpen(true);
      setWantChat(true);
    };
    window.addEventListener(FOCUS, on);
    return () => window.removeEventListener(FOCUS, on);
  }, [g.code]);
  // the card under the buttons: the invite (QR) or the chat, one at a time (hub a3b33a99)
  const [card, setCard] = useState<null | "invite" | "chat">(null);
  if (wantChat && view) {
    setWantChat(false);
    if (view.members.length >= 2) setCard("chat");
  }
  const [settings, setSettings] = useState(false);
  // whose scorecard is open (one at a time)
  const [shown, setShown] = useState<string | null>(null);
  const refresh = useCallback(
    (publishFirst = true) =>
      loadGroup(g, { publishFirst })
        .then((v) => {
          setView(v);
          setErr(null);
        })
        .catch((e) => setErr((e as Error).message)),
    [g],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  // the chat made this device's whisper keys: publish my card again (with them), from the saved group
  const onKeysMade = useCallback(() => {
    const saved = getGroups().find((x) => x.code === g.code);
    if (saved) void loadGroup(saved).then(setView).catch(() => {});
  }, [g.code]);
  // the chat saw someone not in the list (or a whisper key it lacks): load the list again, without republishing
  const onStale = useCallback(() => void refresh(false), [refresh]);
  const book = view?.meta?.book ?? null; // the focus
  const here = findBook(ref.work, ref.book);
  const unread = useGroupsUnread()[g.code] ?? 0;
  const list = readingList(view?.meta ?? null);
  const role = view ? myRole(view) : null;
  const key = (b: { work: string; book: string }) => `${b.work}/${b.book}`;
  // a chip's own key: a finished one carries when (the same book read again is a second chip)
  const chipKey = (b: { work: string; book: string; done?: number }) => (b.done ? `${key(b)}@${b.done}` : key(b));
  // the group's readings as chips: the focus ★, up next, then finished ✓
  const chips = [...(book ? [{ ...book, done: 0 }] : []), ...list.next.map((b) => ({ ...b, done: 0 })), ...list.finished];
  // which book I'm looking at: my own choice, kept on this device; else the focus (hub a92da77c)
  const [viewing, setViewingState] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = (JSON.parse(localStorage.getItem(VIEWING) ?? "{}") as Record<string, string>)[g.code];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- this device's choice is only readable after hydration
      if (v) setViewingState(v);
    } catch {
      /* fine without */
    }
  }, [g.code]);
  const setViewing = (k: string | null) => {
    setViewingState(k);
    try {
      const all = JSON.parse(localStorage.getItem(VIEWING) ?? "{}") as Record<string, string>;
      if (k) all[g.code] = k;
      else delete all[g.code];
      localStorage.setItem(VIEWING, JSON.stringify(all));
    } catch {
      /* fine without */
    }
  };
  const shownBook = chips.find((c) => chipKey(c) === viewing) ?? (book ? { ...book, done: 0 } : chips[0]) ?? null;
  const shownKey = shownBook ? key(shownBook) : null;
  const isFocus = !!book && !!shownBook && !shownBook.done && shownKey === key(book);
  const finishedShown = !!shownBook && shownBook.done > 0;
  // each member's progress in the book shown (older apps only report the focus book)
  const progressOf = (m: Member) => {
    const b = shownKey ? m.books?.[shownKey] : undefined;
    // (a card comes from someone else's device: numbers only)
    if (b && [b.studied, b.heard, b.total].every((n) => typeof n === "number" && Number.isFinite(n)) && b.total > 0) return b;
    if (isFocus && m.book && m.book.total > 0 && (!m.book.of || key(m.book.of) === shownKey)) return { studied: m.book.done, heard: m.heard?.done ?? 0, total: m.book.total };
    return null;
  };
  // finished together: at least two people sharing their progress of the book shown, every one at every chapter
  const sharing = view?.members.map(progressOf).filter((x): x is { studied: number; heard: number; total: number } => !!x) ?? [];
  const allDone = !!shownBook && !finishedShown && sharing.length >= 2 && sharing.every((x) => x.studied >= x.total);
  // the members and their progress fold away, so the chat is easy to read (hub a92da77c)
  const [membersOpen, setMembersOpen] = useState(true);
  const [askOwner, setAskOwner] = useState<string | null>(null);
  /** A short line in the group chat, so everyone sees what changed. */
  const note = async (text: string) => {
    if (!view || view.members.length < 2) return;
    const me = getGroups().find((x) => x.code === g.code) ?? g;
    await sendChat(me, view.members, `📌 ${text}`).catch(() => {});
  };
  const save = async (next: GroupMeta, done: string, chat?: string) => {
    if (!view?.meta) return;
    try {
      await updateMeta(g, next, view.metaEtag);
      toast(done);
      if (chat) void note(chat);
      void refresh();
    } catch (e) {
      toast((e as Error).message);
      void refresh(false); // (someone else changed it first: load theirs, so trying again works)
    }
  };
  const roleDo = async (action: "claim" | "mod" | "unmod" | "owner" | "takeover", target: string | undefined, done: string, chat?: string) => {
    try {
      await groupRole(g, action, target);
      toast(done);
      if (chat) void note(chat);
      void refresh(false);
    } catch (e) {
      toast((e as Error).message);
    }
  };
  const nameOf = (id: string) => view?.members.find((m) => m.id === id)?.name ?? "someone";

  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center gap-1 pr-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left">
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{view?.meta?.name ?? g.name}</span>
            <span className="block text-xs text-muted">
              {view ? `${view.members.length} ${view.members.length === 1 ? "person" : "people"}` : err ? err : "Loading…"}
              {book ? ` · focus: ${bookLabel(book)}` : ""}
            </span>
          </span>
          <span className="text-faint" aria-hidden>
            {open ? "▴" : "▾"}
          </span>
        </button>
        {/* the chat in one tap, from the card's first line, with what's new (hub a92da77c) */}
        {view && view.members.length >= 2 && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setCard("chat");
            }}
            aria-label={unread ? `Chat: ${unread} new` : "Chat"}
            className="relative flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-line px-3 text-xs font-medium text-ink hover:bg-raised"
          >
            💬 Chat
            {unread > 0 && (
              <span aria-hidden className="ml-0.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums text-accent-ink">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-3 border-t border-line px-3 py-2 text-sm">
          <HowGroupsWork />
          {role?.takeover && view?.roles && (
            <div className="rounded-lg border border-accent/50 bg-accent-soft px-3 py-2 text-xs">
              <p className="text-ink">
                {role.ownerLeft ? "The group's owner has left." : `${nameOf(view.roles.owner)}, the owner, hasn't been here in 30 days.`} You&apos;re next in line
                to keep the group going.
              </p>
              <button
                type="button"
                onClick={() =>
                  void roleDo(
                    "takeover",
                    undefined,
                    "You're the group's owner now",
                    role.ownerLeft
                      ? `${g.me} is now the group's owner (the last owner left).`
                      : `${g.me} is now the group's owner (${nameOf(view.roles!.owner)} hasn't been here in 30 days and stays a moderator).`,
                  )
                }
                className={`${btn} mt-1.5 w-full bg-accent font-medium text-accent-ink`}
              >
                Take over this group
              </button>
            </div>
          )}

          {/* the group's readings: tap one to see everyone's progress in it (your own view; the ★ is the group's focus) */}
          {view?.meta && chips.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="The group's readings: show progress in">
                {chips.map((c) => {
                  const k = chipKey(c);
                  const on = !!shownBook && k === chipKey(shownBook);
                  const star = !!book && !c.done && key(c) === key(book);
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setViewing(star ? null : k)}
                      className={`min-h-8 rounded-full border px-2.5 text-xs ${on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line text-muted hover:text-ink"}`}
                    >
                      {bookLabel(c)}
                      {star ? " ★" : c.done ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
              {book && (
                <p className="text-[11px] text-faint">
                  ★ Focus: {bookLabel(book)}
                  {!isFocus && (
                    <>
                      {" "}
                      ·{" "}
                      <button type="button" onClick={() => setViewing(null)} className="text-accent underline-offset-2 hover:underline">
                        view it
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
          {/* the chat, right under the readings and above the goal, so it's easy to read (hub 994d98e9) */}
          {card === "chat" && view && view.members.length >= 2 && <GroupChat g={g} members={view.members} onKeysMade={onKeysMade} onStale={onStale} />}
          {view && (
            <p className="rounded-lg bg-raised px-3 py-2 text-xs text-muted">
              {shownBook ? (
                <>
                  <strong className="font-semibold text-ink">
                    {finishedShown ? `${bookLabel(shownBook)}: finished together ${new Date(shownBook.done).toLocaleDateString()}.` : isFocus ? `Group goal: read ${bookLabel(shownBook)} together.` : `Also on the group's readings: ${bookLabel(shownBook)}.`}
                  </strong>{" "}
                  The bars show each person&apos;s chapters of {bookLabel(shownBook)} <span className="text-accent">studied</span> and{" "}
                  <span className="text-heard">heard</span>; other reading counts in your own Progress.
                </>
              ) : role?.runs || role?.unclaimed ? (
                <>No readings yet: open a book, then add it in Settings.</>
              ) : (
                <>No readings yet: the group&apos;s owner adds them.</>
              )}
            </p>
          )}
          {allDone && view?.meta && shownBook && (
            <div className="rounded-lg border border-accent/50 bg-accent-soft px-3 py-2 text-center">
              <p className="font-serif text-base font-semibold text-ink">🎉 You finished {bookLabel(shownBook)} together!</p>
              <p className="text-xs text-muted">Everyone sharing their progress has studied every chapter.</p>
              {(role?.runs || role?.unclaimed) && isFocus && (
                <button
                  type="button"
                  onClick={() => void save(withFinished(view.meta!), `${bookLabel(shownBook)} is finished`, `${g.me} marked ${bookLabel(shownBook)} finished together 🎉${list.next[0] ? ` The focus is now ${bookLabel(list.next[0])}.` : ""}`)}
                  className={`${btn} mt-2 w-full bg-accent font-medium text-accent-ink`}
                >
                  {list.next[0] ? `Mark it finished and focus on ${bookLabel(list.next[0])}` : "Mark it finished"}
                </button>
              )}
            </div>
          )}
          {/* the owner and moderators: the book shown becomes the focus, or comes off the readings */}
          {view?.meta && shownBook && !finishedShown && !isFocus && (role?.runs || role?.unclaimed) && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewing(null);
                  void save(withCurrent(view.meta!, shownBook), `The focus is now ${bookLabel(shownBook)}`, `${g.me} made ${bookLabel(shownBook)} the focus.`);
                }}
                className={`${btn} flex-1 border border-line text-ink hover:bg-raised`}
              >
                Make it the focus ★
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewing(null);
                  void save(withRemoved(view.meta!, shownBook), `${bookLabel(shownBook)} is off the readings`, `${g.me} took ${bookLabel(shownBook)} off the readings.`);
                }}
                className={`${btn} border border-line text-ink hover:bg-raised`}
              >
                Remove
              </button>
            </div>
          )}

          {view && (
            <div>
              <button
                type="button"
                onClick={() => setMembersOpen(!membersOpen)}
                aria-expanded={membersOpen}
                className="flex w-full items-center justify-between rounded-md bg-raised px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:text-ink"
              >
                <span>
                  Members &amp; progress <span className="font-normal text-faint">{view.members.length}</span>
                </span>
                <span aria-hidden className={`transition ${membersOpen ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>
              {membersOpen && (
                <ul className="divide-y divide-line/70">
                  {view.members.map((m) => {
                    const p = progressOf(m);
                    const r = roleOf(view.roles, m.id);
                    return (
                      <li key={m.id} className="py-2">
                        <p className="flex items-baseline justify-between gap-2">
                          {m.profile && typeof m.profile === "object" ? (
                            // tap a name for that person's scorecard (hub 65b00b23)
                            <button
                              type="button"
                              id={`name-${m.id}`}
                              onClick={() => setShown(shown === m.id ? null : m.id)}
                              aria-expanded={shown === m.id}
                              aria-controls={`scorecard-${m.id}`}
                              className="-my-1 min-w-0 truncate py-1 text-left font-medium text-ink underline-offset-2 hover:underline"
                            >
                              {m.name}
                              {m.mine ? " (you)" : ""}
                              <span className="ml-1 text-[10px] text-faint" aria-hidden>
                                {shown === m.id ? "▴" : "▾"}
                              </span>
                            </button>
                          ) : (
                            <span className="truncate font-medium text-ink">
                              {m.name}
                              {m.mine ? " (you)" : ""}
                            </span>
                          )}
                          {r && <span className="shrink-0 rounded-full bg-accent-soft px-2 text-[10px] font-semibold text-accent">{r}</span>}
                          <span className="ml-auto shrink-0 text-[11px] text-faint">{ago(m.at)}</span>
                        </p>
                        {m.weekMins != null ? (
                          <p className="text-xs text-muted">
                            {/* spelled out (hub 994d98e9): the level, the streak, then this week's time and chapters (any book) */}
                            {m.profile && typeof m.profile.level === "number" ? `Level ${m.profile.level} · ` : ""}
                            {m.streak ?? 0} day streak <StreakIcon days={m.streak ?? 0} /> · {m.weekMins} min this week · {m.weekChapters ?? 0}{" "}
                            {m.weekChapters === 1 ? "chapter" : "chapters"} this week (any book)
                          </p>
                        ) : (
                          <p className="text-xs text-faint">Progress not shared</p>
                        )}
                        {shownBook && p && <BookBar kind="Studied" done={p.studied} total={p.total} book={bookLabel(shownBook) ?? "the book"} />}
                        {shownBook && p && <BookBar kind="Heard" done={p.heard} total={p.total} book={bookLabel(shownBook) ?? "the book"} />}
                        {shownBook && !p && m.weekMins != null && <p className="mt-1 text-[11px] text-faint">No progress in {bookLabel(shownBook)} shown yet.</p>}
                        {shown === m.id && m.profile && (
                          <Scorecard
                            id={`scorecard-${m.id}`}
                            m={m}
                            onClose={() => {
                              setShown(null);
                              document.getElementById(`name-${m.id}`)?.focus(); // back to the name that opened it
                            }}
                          />
                        )}
                        {m.reading && !m.mine && (
                          <Link
                            href={readHref({ work: m.reading.work, book: m.reading.book, chapter: m.reading.chapter }, DEFAULT_VERSIONS[m.reading.work] ?? [])}
                            className="mt-0.5 block text-xs text-accent underline-offset-2 hover:underline"
                          >
                            Reading {chapterTitle(findBook(m.reading.work, m.reading.book), m.reading.chapter, m.reading.book)}: join them
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCard(card === "invite" ? null : "invite")}
              aria-pressed={card === "invite"}
              className={`${btn} flex-1 border border-line ${card === "invite" ? "bg-accent-soft text-accent" : "text-ink hover:bg-raised"}`}
            >
              Invite
            </button>
            {view && view.members.length >= 2 && (
              <button
                type="button"
                onClick={() => setCard(card === "chat" ? null : "chat")}
                aria-pressed={card === "chat"}
                className={`${btn} flex-1 border border-line ${card === "chat" ? "bg-accent-soft text-accent" : "text-ink hover:bg-raised"}`}
              >
                Chat
              </button>
            )}
            <button type="button" onClick={() => void refresh()} className={`${btn} border border-line text-ink hover:bg-raised`}>
              Refresh
            </button>
            <button type="button" onClick={() => setSettings(!settings)} className={`${btn} border border-line text-ink hover:bg-raised`}>
              Settings
            </button>
          </div>

          {card === "invite" && <Invite g={g} />}
          {/* (the chat sits higher up, above the goal: hub 994d98e9) */}

          {settings && (
            <div className="space-y-2 rounded-lg border border-line px-3 py-2">
              <label className="block space-y-1">
                <span className="text-xs text-muted">Your name in this group</span>
                <input
                  defaultValue={g.me}
                  maxLength={40}
                  onBlur={(e) => {
                    const me = e.target.value.trim();
                    if (me && me !== g.me) {
                      updateMyGroup(g.code, { me });
                      setTimeout(() => void refresh(), 0);
                    }
                  }}
                  className={field}
                />
              </label>
              <label className="flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  checked={g.share.progress}
                  onChange={(e) => {
                    updateMyGroup(g.code, { share: { ...g.share, progress: e.target.checked } });
                    setTimeout(() => void refresh(), 0);
                  }}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Share my streak, time, progress, level and badges
              </label>
              <label className="flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  checked={g.share.reading}
                  onChange={(e) => {
                    updateMyGroup(g.code, { share: { ...g.share, reading: e.target.checked } });
                    setTimeout(() => void refresh(), 0);
                  }}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Show which chapter I’m reading (so others can join)
              </label>

              {/* the readings: the owner and moderators add the book open now (or make it the focus) */}
              {view?.meta && here && (role?.runs || role?.unclaimed) && !chips.some((c) => !c.done && c.work === ref.work && c.book === ref.book) && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void save(withAdded(view.meta!, { work: ref.work, book: ref.book }), `${here.name} is on the readings`, `${g.me} added ${here.name} to the readings.`)}
                    className={`${btn} flex-1 border border-line text-ink hover:bg-raised`}
                  >
                    Add {here.name} to the readings
                  </button>
                  {!book && (
                    <button
                      type="button"
                      onClick={() => void save(withCurrent(view.meta!, { work: ref.work, book: ref.book }), `The focus is now ${here.name}`, `${g.me} made ${here.name} the focus.`)}
                      className={`${btn} flex-1 bg-accent font-medium text-accent-ink`}
                    >
                      Make {here.name} the focus ★
                    </button>
                  )}
                </div>
              )}
              {view?.roles && !role?.runs && <p className="text-xs text-faint">The group&apos;s owner and moderators choose its readings and focus.</p>}

              {/* a group made before roles: someone takes it on */}
              {role?.unclaimed && (
                <div className="rounded-lg border border-line px-2.5 py-2 text-xs text-muted">
                  <p>This group has no owner yet. The owner (and the moderators they pick) choose the readings and the focus.</p>
                  <button type="button" onClick={() => void roleDo("claim", undefined, "You're the group's owner", `${g.me} is now the group's owner.`)} className={`${btn} mt-1.5 w-full border border-line text-ink hover:bg-raised`}>
                    Become this group&apos;s owner
                  </button>
                </div>
              )}

              {/* the owner: moderators, and handing the group over */}
              {role?.owner && view && view.members.length > 1 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-faint">People</p>
                  {view.members
                    .filter((m) => !m.mine)
                    .map((m) => {
                      const mod = !!view.roles && m.id in view.roles.mods;
                      return (
                        <div key={m.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="min-w-0 flex-1 truncate text-ink">
                            {m.name}
                            {mod ? " · Moderator" : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => void roleDo(mod ? "unmod" : "mod", m.id, mod ? `${m.name} isn't a moderator now` : `${m.name} is a moderator now`, mod ? undefined : `${m.name} is now a moderator: they can add readings and set the focus.`)}
                            className="text-accent underline-offset-2 hover:underline"
                          >
                            {mod ? "Remove moderator" : "Make moderator"}
                          </button>
                          {askOwner === m.id ? (
                            <>
                              <span className="basis-full text-muted">Hand the group to {m.name}? You&apos;ll stay on as a moderator.</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setAskOwner(null);
                                  void roleDo("owner", m.id, `${m.name} is the owner now`, `${g.me} handed the group to ${m.name}, its new owner.`);
                                }}
                                className="rounded-full bg-accent px-2.5 py-1 font-medium text-accent-ink"
                              >
                                Hand it over
                              </button>
                              <button type="button" onClick={() => setAskOwner(null)} className="text-muted underline-offset-2 hover:underline">
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button type="button" onClick={() => setAskOwner(m.id)} className="text-muted underline-offset-2 hover:underline">
                              Make owner
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  try {
                    await leaveGroup(g);
                    toast("You left the group");
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
                className="text-xs text-faint underline underline-offset-2 hover:text-muted"
              >
                Leave this group
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Invite({ g }: { g: MyGroup }) {
  const link = inviteLink(g);
  const share = async () => {
    const text = `Join my study group “${g.name}” on ${SITE_NAME}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: g.name, text, url: link });
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}: ${link}`);
      toast("Invite link copied");
    } catch {
      toast("Couldn’t copy");
    }
  };
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-line px-3 py-3">
      <Qr text={link} size={140} label="QR code to join this group" />
      <p className="select-all text-center font-mono text-xs tracking-wider text-ink">{g.code}</p>
      <button type="button" onClick={share} className={`${btn} w-full bg-accent font-medium text-accent-ink`}>
        Share invite link
      </button>
      <p className="text-center text-xs text-faint">Anyone with the link or code can join and see the group, so share it only with people you know.</p>
    </div>
  );
}

/** Opened an invite link (#group=CODE): offer to join. */
export function GroupInvite() {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    const c = pendingInvite();
    if (!c) return;
    history.replaceState(null, "", location.pathname + location.search);
    const t = setTimeout(() => setCode(c), 300); // after the reader has settled
    return () => clearTimeout(t);
  }, []);
  return (
    <Modal open={!!code} onClose={() => setCode(null)} variant="card" label="Join a study group">
      {code && (
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Join a study group</h2>
            <button type="button" onClick={() => setCode(null)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-raised">
              <CloseIcon />
            </button>
          </div>
          <p className="text-sm text-muted">You were invited to read together on {SITE_NAME}. Pick the name the group will see.</p>
          <JoinForm code={code} onDone={() => setCode(null)} />
        </div>
      )}
    </Modal>
  );
}
