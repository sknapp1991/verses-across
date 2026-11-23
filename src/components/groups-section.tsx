"use client";
/**
 * Study groups (their own panel, from the top bar): create one, invite friends (link, code or QR), see everyone's
 * streak, time this week and progress in the group's book. Plus the prompt shown when an invite link
 * is opened.
 */
import { GroupChat } from "./group-chat";
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
} from "@/lib/groups";
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
  const book = view?.meta?.book ?? null;
  const here = findBook(ref.work, ref.book);

  return (
    <div className="rounded-xl border border-line">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{view?.meta?.name ?? g.name}</span>
          <span className="block text-xs text-muted">
            {view ? `${view.members.length} ${view.members.length === 1 ? "person" : "people"}` : err ? err : "Loading…"}
            {book ? ` · reading ${bookLabel(book)}` : ""}
          </span>
        </span>
        <span className="text-faint" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-3 py-2 text-sm">
          {view && (
            <ul className="divide-y divide-line/70">
              {view.members.map((m) => (
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
                    <span className="shrink-0 text-[11px] text-faint">{ago(m.at)}</span>
                  </p>
                  {m.weekMins != null ? (
                    <p className="text-xs text-muted">
                      <StreakIcon days={m.streak ?? 0} /> {m.streak ?? 0} · {m.weekMins} min this week · {m.weekChapters ?? 0} {m.weekChapters === 1 ? "chapter" : "chapters"}
                    </p>
                  ) : (
                    <p className="text-xs text-faint">Progress not shared</p>
                  )}
                  {book && m.book && m.book.total > 0 && <BookBar kind="Studied" done={m.book.done} total={m.book.total} book={bookLabel(book) ?? "the group's book"} />}
                  {book && m.heard && m.heard.total > 0 && <BookBar kind="Heard" done={m.heard.done} total={m.heard.total} book={bookLabel(book) ?? "the group's book"} />}
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
              ))}
            </ul>
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
          {card === "chat" && view && view.members.length >= 2 && <GroupChat g={g} members={view.members} onKeysMade={onKeysMade} onStale={onStale} />}

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
              {view?.meta && here && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await updateMeta(g, { ...view.meta!, book: { work: ref.work, book: ref.book } }, view.metaEtag);
                      toast(`The group is now reading ${here.name}`);
                      void refresh();
                    } catch (e) {
                      toast((e as Error).message);
                    }
                  }}
                  className={`${btn} w-full border border-line text-ink hover:bg-raised`}
                >
                  Read {here.name} together
                </button>
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
