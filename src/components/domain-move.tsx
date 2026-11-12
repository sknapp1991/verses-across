"use client";
/**
 * VersesAcross lives at versesacross.com, Library Across at libraryacross.com. Older addresses (snoopwiggy.com,
 * www.*) forward there, and so does a book of the other site opened here (forwardTo) — taking the visitor's saved
 * data along, because browsers keep it per address: settings, tabs, reading positions, and highlights / favorites /
 * notes (IndexedDB).
 *
 * The data travels in the URL *fragment* (#…), which browsers never send to any server, gzip +
 * base64url encoded. The receiving site unpacks it, merges it, cleans the address bar and reloads once.
 */
import { useEffect } from "react";
import { SITE_HOST, SITE_SIDE } from "@/lib/site";

const OFFICIAL = SITE_HOST;
const OLD_HOSTS = SITE_SIDE === "library" ? /^www\.libraryacross\.com$/ : /^(www\.)?snoopwiggy\.com$|^www\.versesacross\.com$/;
const KEYS = ["gs:settings:v1", "gs:pos:v1", "gs:tips:v1"];
const MARK = "#vamove=";
/** On the old address: its data has been sent once already. On versesacross.com: data was received. */
const MOVED = "gs:moved:v1";
const RECEIVED = "gs:received:v1";

/** cross: sent between the two sites (not from an old address); hash: the page's own #fragment (#v12), put back. */
type Bundle = { local: Record<string, string>; study: unknown[]; cross?: boolean; hash?: string };

async function readStudy(): Promise<unknown[]> {
  if (typeof indexedDB === "undefined") return [];
  return new Promise((resolve) => {
    const req = indexedDB.open("globalstudy", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("study", { keyPath: "id" });
    req.onerror = () => resolve([]);
    req.onsuccess = () => {
      try {
        const r = req.result.transaction("study", "readonly").objectStore("study").getAll();
        r.onsuccess = () => resolve(r.result as unknown[]);
        r.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    };
  });
}

async function writeStudy(items: unknown[]) {
  if (!items.length || typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    // Never hold up the move: the page reloads after this, whatever happens (a full disk aborts the write, an old
    // browser may throw, a blocked database never answers), so give up after 10 seconds at most.
    const timer = setTimeout(resolve, 10_000);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const req = indexedDB.open("globalstudy", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("study", { keyPath: "id" });
    req.onerror = done;
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction("study", "readwrite");
        const store = tx.objectStore("study");
        // Keep whichever copy is newer.
        for (const it of items as { id: string; updatedAt?: number }[]) {
          const g = store.get(it.id);
          g.onsuccess = () => {
            const old = g.result as { updatedAt?: number } | undefined;
            if (!old || (old.updatedAt ?? 0) < (it.updatedAt ?? 0)) store.put(it);
          };
        }
        tx.oncomplete = done;
        tx.onerror = done;
        tx.onabort = done;
      } catch {
        done();
      }
    };
  });
}

const toB64 = (bytes: Uint8Array) => {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** Go to `origin` + `path` (this page's own path when not given), with this site's saved data. */
export async function forwardTo(origin: string, path?: string) {
  const { pathname, search, hash } = window.location;
  return forward(origin, path ?? pathname + search + hash, true);
}

async function forward(origin = `https://${OFFICIAL}`, target?: string, everyTime = false) {
  const local: Record<string, string> = {};
  for (const k of KEYS) {
    const v = localStorage.getItem(k);
    if (v) local[k] = v;
  }
  const study = await readStudy();
  const { pathname, search, hash } = window.location;
  const dest = target ?? pathname + search + hash;
  const at = dest.indexOf("#");
  let fragment = at < 0 ? "" : dest.slice(at);
  // From an old address: send the saved data only once (later visits must not overwrite newer data on the new
  // one). Between the two sites: every time (the receiving side keeps the newer copy of each item).
  const alreadyMoved = !everyTime && localStorage.getItem(MOVED) === "1";
  if (!alreadyMoved && (Object.keys(local).length || study.length)) {
    if (!everyTime) localStorage.setItem(MOVED, "1");
    try {
      const bundle: Bundle = { local, study, ...(everyTime ? { cross: true } : {}), ...(fragment ? { hash: fragment } : {}) };
      fragment = MARK + toB64(await gzip(JSON.stringify(bundle)));
    } catch {
      /* very old browser: move without data */
    }
  }
  window.location.replace(`${origin}${at < 0 ? dest : dest.slice(0, at)}${fragment}`);
}

async function receive(encoded: string) {
  // Taking in the data, then reloading: other code (Ask AI's status check) waits for the reload (ai-chat.ts).
  (window as Window & { __vaMoving?: boolean }).__vaMoving = true;
  let hash = "";
  try {
    const data = JSON.parse(await gunzip(fromB64(encoded))) as Bundle;
    const first = localStorage.getItem(RECEIVED) !== "1";
    for (const [k, v] of Object.entries(data.local ?? {})) {
      if (!KEYS.includes(k)) continue;
      const mine = localStorage.getItem(k);
      if (data.cross) {
        // Between the two sites: this site's own data always wins. Settings: keep these, add the other site's
        // saved setups; reading positions: add the other site's books (this site's places stay).
        if (!mine) localStorage.setItem(k, v);
        else if (k === "gs:settings:v1") {
          const a = JSON.parse(mine), b = JSON.parse(v);
          const setups = [...(a.setups ?? []), ...(b.setups ?? [])];
          a.setups = setups.filter((x: { id: string }, i: number) => setups.findIndex((y: { id: string }) => y.id === x.id) === i);
          localStorage.setItem(k, JSON.stringify(a));
        } else if (k === "gs:pos:v1") {
          const a = JSON.parse(mine), b = JSON.parse(v);
          if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) localStorage.setItem(k, JSON.stringify({ ...b, ...a }));
        }
        continue;
      }
      if (k === "gs:settings:v1" && mine) {
        // Settings: on the first move the old address's settings win (this page may only have saved
        // defaults so far); afterwards keep this page's. Saved setups from both are always kept.
        const a = JSON.parse(mine), b = JSON.parse(v);
        const merged = first ? { ...a, ...b } : a;
        const setups = [...(a.setups ?? []), ...(b.setups ?? [])];
        merged.setups = setups.filter((x: { id: string }, i: number) => setups.findIndex((y: { id: string }) => y.id === x.id) === i);
        localStorage.setItem(k, JSON.stringify(merged));
      } else if (first || !mine) localStorage.setItem(k, v);
    }
    if (!data.cross) localStorage.setItem(RECEIVED, "1");
    await writeStudy(Array.isArray(data.study) ? data.study : []); // newer copy of each item wins
    hash = typeof data.hash === "string" && data.hash.startsWith("#") && !data.hash.startsWith(MARK) ? data.hash : "";
  } catch {
    /* damaged link: start fresh rather than fail */
  }
  history.replaceState(null, "", window.location.pathname + window.location.search + hash);
  window.location.reload();
}

export function DomainMove() {
  useEffect(() => {
    const host = window.location.hostname;
    if (host === OFFICIAL && window.location.protocol === "http:") {
      window.location.replace(window.location.href.replace(/^http:/, "https:"));
      return;
    }
    if (OLD_HOSTS.test(host)) {
      forward();
      return;
    }
    if (window.location.hash.startsWith(MARK)) receive(window.location.hash.slice(MARK.length));
  }, []);
  return null;
}
