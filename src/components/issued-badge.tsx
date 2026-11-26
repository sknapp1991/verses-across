"use client";
/**
 * Issued badges on the page (src/lib/issued-badges.ts): the small mark next to a name (⟨Steward⟩), what a mark means
 * when tapped, and the /badge page that opens a badge link (the token and its holder key are in the address's
 * fragment, never sent to a server), checks it and offers to keep it on this device. In a group, a mark shows only when
 * the team's signature AND the holder's proof for that member verify.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./modal";
import { checkLink, groupBadges, issuedOn, keepBadge, savedBadges, tokenId, BADGES_EVENT, type BadgeDef, type Kept, type Verified } from "@/lib/issued-badges";

/** The short mark, e.g. ⟨Steward⟩, as a solid chip that reads in both themes. */
export function BadgeChip({ def, big = false }: { def: BadgeDef; big?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${big ? "px-4 py-1.5 text-lg" : "px-1.5 text-[10px] leading-4"}`}
      style={{ background: def.bg, color: def.ink }}
    >
      <span aria-hidden>{def.icon}</span>⟨{def.mark}⟩
    </span>
  );
}

/** What a badge is and who gave it. */
export function BadgeDetails({ b }: { b: Verified }) {
  return (
    <div className="space-y-2">
      <BadgeChip def={b.def} big />
      <p className="text-ink">
        <span className="font-semibold">{b.def.label}</span>, issued to <span className="font-semibold">{b.n}</span> on {issuedOn(b.i)}.
      </p>
      <p className="text-sm text-muted">{b.def.description}</p>
      <p className="text-xs text-faint">Issued by the Verses Across team. Its signature checks out, so it can&apos;t have been made up or changed.</p>
    </div>
  );
}

/** The marks next to a member's name in a study group: only the ones that verify, with a proof from the badge's
 * holder for this group and this member id; tap one to see what it is. */
export function BadgeMarks({ list: raw, gid, mid, who }: { list: unknown; gid: string; mid: string; who: string }) {
  const key = Array.isArray(raw) && raw.length ? `${gid}|${mid}|${JSON.stringify(raw.slice(0, 5))}` : "";
  const [got, setGot] = useState<{ key: string; list: Verified[] } | null>(null);
  const [open, setOpen] = useState<Verified | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    void groupBadges(JSON.parse(key.slice(gid.length + mid.length + 2)), gid, mid).then((list) => live && setGot({ key, list }));
    return () => {
      live = false;
    };
  }, [key, gid, mid]);
  const list = got && got.key === key ? got.list : [];
  if (!list.length) return null;
  return (
    <>
      {list.map((b) => (
        <button key={b.id} type="button" onClick={() => setOpen(b)} aria-label={`${who}: ${b.def.label} badge. What is this?`} className="shrink-0 rounded-full">
          <BadgeChip def={b.def} />
        </button>
      ))}
      <Modal open={!!open} onClose={() => setOpen(null)} variant="card" label="Badge">
        {open && (
          <div className="space-y-4 p-5">
            <BadgeDetails b={open} />
            <p className="text-xs text-faint">The name on a badge is the one it was issued to; it can differ from the name used in this group.</p>
            <button type="button" onClick={() => setOpen(null)} className="min-h-11 w-full rounded-xl border border-line text-sm font-medium text-ink hover:bg-raised">
              Close
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ---------------- the /badge page ---------------- */

/** The address's fragment (decoded, trimmed), then taken out of the address bar. Empty when there is none. */
function takeHash(): string {
  if (window.location.hash.length <= 1) return "";
  let f = window.location.hash.slice(1);
  try {
    f = decodeURIComponent(f);
  } catch {
    /* a broken escape: checked as it is, and refused */
  }
  try {
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    /* fine */
  }
  return f.trim();
}

type LinkState = { ok: true; badge: Verified; kept: Kept } | { ok: false; why: "unset" | "invalid" | "revoked" };

export function BadgeView() {
  const [state, setState] = useState<LinkState | "none" | null>(null);
  const [kept, setKept] = useState(false);
  /** The link being shown: only in memory (gone after Keep, or when the page closes). */
  const link = useRef<string | null>(null);
  /** Bumped when another badge link is opened in this tab. */
  const [round, setRound] = useState(0);
  useEffect(() => {
    const on = () => {
      if (window.location.hash.length <= 1) return;
      link.current = takeHash();
      setRound((n) => n + 1);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    if (window.location.hash.length > 1) link.current = takeHash();
    const f = link.current ?? "";
    if (!f) {
      setState((s) => (s === null ? "none" : s));
      return;
    }
    setState(null);
    setKept(false);
    let live = true;
    void checkLink(f).then((check) => {
      if (!live) return;
      setState(check);
      if (check.ok) setKept(savedBadges().some((x) => x.t === check.kept.t));
    });
    return () => {
      live = false;
    };
  }, [round]);
  useEffect(() => {
    const on = () => setKept(state !== null && state !== "none" && state.ok && savedBadges().some((x) => tokenId(x.t) === state.badge.id));
    window.addEventListener(BADGES_EVENT, on);
    return () => window.removeEventListener(BADGES_EVENT, on);
  }, [state]);

  const keep = () => {
    if (!state || state === "none" || !state.ok || !state.kept.k) return;
    keepBadge(state.kept);
    setKept(true);
    // the holder key now lives only in the kept badges: drop this page's copy
    link.current = null;
    setState({ ...state, kept: { t: state.kept.t, k: "" } });
  };

  return (
    <main className="h-app overflow-y-auto bg-paper">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Verses Across</p>
          <h1 className="font-serif text-3xl font-semibold text-ink">A badge</h1>
        </header>
        {state === null ? (
          <p role="status" className="text-sm text-muted">
            Checking the badge…
          </p>
        ) : state === "none" ? (
          <p className="text-muted">There&apos;s no badge in this link. A badge link comes from the Verses Across team.</p>
        ) : !state.ok ? (
          <p className="rounded-2xl border border-line bg-panel p-5 text-ink">
            {state.why === "revoked"
              ? "This badge has been withdrawn by the Verses Across team, so it isn't shown any more."
              : state.why === "unset"
                ? "Badges aren't switched on here yet. Try this link again later."
                : "This link is broken or incomplete. Ask the person who sent it for a fresh one."}
          </p>
        ) : (
          <section className="space-y-4 rounded-2xl border border-line bg-panel p-6 text-center">
            <div className="flex justify-center">
              <span className="inline-flex text-5xl leading-none" aria-hidden>
                {state.badge.def.icon}
              </span>
            </div>
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {state.badge.def.label}, issued to {state.badge.n} on {issuedOn(state.badge.i)}
            </h2>
            <div className="flex justify-center">
              <span className="inline-flex">
                <BadgeChip def={state.badge.def} big />
              </span>
            </div>
            <p className="text-muted">{state.badge.def.description}</p>
            <p className="text-xs text-faint">Issued by the Verses Across team. Its signature checks out, so it can&apos;t have been made up or changed.</p>
            {kept ? (
              <p className="text-sm font-medium text-accent">Kept on this device. It shows next to your name in your study groups.</p>
            ) : (
              <button type="button" onClick={keep} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink">
                Keep this badge
              </button>
            )}
            <p className="text-xs text-faint">The badge is kept on this device. It shows to the people in your study groups, and goes to your other devices if you use a sync code.</p>
          </section>
        )}
        <p className="text-xs text-faint">
          <Link href="/" className="text-accent hover:underline">
            Verses Across
          </Link>
        </p>
      </div>
    </main>
  );
}
