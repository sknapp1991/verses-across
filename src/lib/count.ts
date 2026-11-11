"use client";
/**
 * Anonymous counts (src/app/api/count): a chapter view, a read-along play or an offline download adds
 * one to that day's total for the work and version. Nothing identifies the person: no ID, no cookie;
 * the same chapter is counted once per tab per day. Sent with sendBeacon so it never slows the page.
 */
import { isPrivate } from "./privacy";

const seen = new Set<string>();

export function count(kind: "view" | "play" | "download", work: string, versions: string[]) {
  versions = versions.filter(Boolean);
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production" || !versions.length) return;
  if (isPrivate()) return; // Private mode: not even anonymous counts
  const body = JSON.stringify({ kind, work, versions: versions.slice(0, 8) });
  try {
    if (navigator.sendBeacon?.("/api/count", new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through */
  }
  void fetch("/api/count", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
}

/** Once per tab per day for the same chapter and versions (re-renders and quick back-and-forth don't add up). */
export function countOnce(kind: "view" | "play", key: string, work: string, versions: string[]) {
  const k = `${new Date().toISOString().slice(0, 10)}|${kind}|${key}|${versions.join(",")}`;
  if (seen.has(k)) return;
  seen.add(k);
  count(kind, work, versions);
}
