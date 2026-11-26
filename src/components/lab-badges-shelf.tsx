"use client";
/**
 * "Your lab badges" on /study-lab (and only there): the study lab's own badges (src/lib/lab-badges.ts), earned ones
 * bright and the others faint with how to earn them, and below them any badges the team has given you
 * (src/lib/issued-badges.ts), each checked before it is shown.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { LAB_BADGES, LAB_EVENT, labStatus, type LabStatus } from "@/lib/lab-badges";
import { BADGES_EVENT, keptVerified, removeBadge, type Verified } from "@/lib/issued-badges";
import { BadgeDetails } from "./issued-badge";

export function LabBadgesShelf() {
  const [status, setStatus] = useState<Record<string, LabStatus> | null>(null);
  const [given, setGiven] = useState<Verified[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => void labStatus().then((s) => live && setStatus(s), () => live && setStatus({}));
    // the kept badges that verify and aren't revoked
    const loadGiven = async () => {
      const out = await keptVerified().catch(() => [] as Verified[]);
      if (live) setGiven(out);
    };
    load();
    void loadGiven();
    const onGiven = () => void loadGiven();
    window.addEventListener(LAB_EVENT, load);
    window.addEventListener(BADGES_EVENT, onGiven);
    return () => {
      live = false;
      window.removeEventListener(LAB_EVENT, load);
      window.removeEventListener(BADGES_EVENT, onGiven);
    };
  }, []);

  const count = status ? LAB_BADGES.filter((b) => status[b.id]?.earned).length : 0;
  return (
    <section aria-labelledby="lab-badges" className="space-y-3 rounded-2xl border border-line bg-panel p-4">
      <h2 id="lab-badges" className="font-serif text-xl font-semibold text-ink">
        Your lab badges{" "}
        {status && (
          <span className="text-sm font-normal text-faint">
            {count} of {LAB_BADGES.length}
          </span>
        )}
      </h2>
      <p className="text-xs text-faint">Kept on this device (and your other devices, if you use a sync code).</p>
      {!status ? (
        <p role="status" className="text-sm text-faint">
          Loading…
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LAB_BADGES.map((b) => {
            const s = status[b.id];
            const on = !!s?.earned;
            return (
              <li key={b.id}>
                <Link
                  href={b.href}
                  className={`block h-full rounded-xl border p-3 ${on ? "border-accent bg-accent-soft" : "border-line bg-paper opacity-60 hover:opacity-100"}`}
                >
                  <span className={`block text-2xl leading-normal ${on ? "" : "grayscale"}`} aria-hidden>
                    {b.icon}
                  </span>
                  <span className={`block text-sm font-semibold ${on ? "text-ink" : "text-muted"}`}>
                    {b.name}
                    {on ? <span className="sr-only"> (earned)</span> : null}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{b.how}</span>
                  {!on && s && s.need > 1 && (
                    <span className="mt-1 block text-[11px] text-faint">
                      {s.have} of {s.need}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {given.length > 0 && (
        <div className="space-y-2 border-t border-line pt-3">
          <h3 className="font-serif text-lg font-semibold text-ink">Badges given to you</h3>
          <ul className="space-y-2">
            {given.map((b) => (
              <li key={b.id} className="space-y-2 rounded-xl border border-line bg-paper p-3">
                <BadgeDetails b={b} />
                {confirm === b.id ? (
                  <span className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => removeBadge(b.id)} className="min-h-9 rounded-lg border border-line px-3 text-xs font-medium text-ink hover:bg-raised">
                      Yes, remove it from this device
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} className="min-h-9 px-2 text-xs text-muted hover:text-ink">
                      Keep it
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirm(b.id)} className="min-h-9 text-xs text-faint hover:text-ink">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
