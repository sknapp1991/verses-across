/*
 * Verses Across service worker: read offline.
 * - Scripture and search files (/texts, /search), app code (/_next/static) and icons: served from the
 *   cache when there, refreshed in the background (stale-while-revalidate).
 * - Pages: network first; when offline, the last copy of that page (so chapters you've opened, and the
 *   app itself, keep working without a connection).
 * - Offline downloads (src/lib/downloads.ts) are saved by the page into two caches of their own, which
 *   survive VERSION bumps: va-saved (scripture files) and va-audio (recorded chapters + timings).
 *   Scripture files are served from va-saved first; recordings are served from va-audio when saved,
 *   with Range support so players can seek and iPhones can play.
 * - The recordings list (/api/audio/index.json) and download sizes (/offline/index.json) are kept too, so
 *   saved audio is still found offline. Requests with ?va-dl=1 (downloads in progress) skip every cache.
 * - Never cached here: /api (AI, audio streaming) unless saved as a download, anything from other sites.
 * Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const DATA = `va-data-${VERSION}`;
const PAGES = `va-pages-${VERSION}`;
const MAX_PAGES = 80;
const SAVED = "va-saved"; // offline downloads: scripture files
const AUDIO = "va-audio"; // offline downloads: recordings

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith("va-") && ![DATA, PAGES, SAVED, AUDIO].includes(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

const isData = (p) =>
  p.startsWith("/texts/") || p.startsWith("/search/") || p.startsWith("/_next/static/") || /^\/(icon|apple-icon|favicon)/.test(p) || p === "/manifest.webmanifest";

async function staleWhileRevalidate(event, cacheName = DATA) {
  const req = event.request;
  const cache = await caches.open(cacheName);
  const saved = await caches.open(SAVED);
  const savedHit = new URL(req.url).pathname.startsWith("/texts/") ? await saved.match(req) : undefined;
  const hit = savedHit || (await cache.match(req));
  const net = fetch(req)
    .then((res) => {
      if (res.ok && res.status === 200) {
        // A downloaded file stays in the downloads cache (refreshed there); others go to the general one.
        // Saved in the background: the page gets the file as it arrives, not after it's been stored
        // (iPhones are slow to write the cache).
        event.waitUntil((savedHit ? saved : cache).put(req, res.clone()).catch(() => {}));
      }
      return res;
    })
    .catch(() => null);
  if (hit) {
    event.waitUntil(net); // let the background refresh finish even if the page is done with us
    return hit;
  }
  return (await net) || new Response("Offline", { status: 503 });
}

/**
 * Page / router payload: network first, else the cached copy. The key drops Next's ?_rsc= hash; the
 * router payload gets its own key via a query flag (the Cache API ignores URL fragments, so "#rsc"
 * would collide with the HTML entry).
 */
async function networkFirst(event, url) {
  const req = event.request;
  const key = new URL(url);
  key.searchParams.delete("_rsc");
  if (req.headers.get("RSC")) key.searchParams.set("_rsc", "1");
  const cacheKey = key.href;
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok && res.status === 200) {
      // The page streams in right away; its offline copy is saved (and old ones trimmed) in the background.
      // Before, the page waited until it was fully downloaded and stored, slow on iPhones.
      const copy = res.clone();
      event.waitUntil(
        (async () => {
          await cache.put(cacheKey, copy);
          const keys = await cache.keys();
          for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await cache.delete(k);
        })().catch(() => {}),
      );
    }
    return res;
  } catch (e) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
    // A chapter never opened before: show another saved chapter page; the reader follows the address
    // bar (use-reader-state.ts) and reads the text from offline downloads.
    if (req.mode === "navigate" && url.pathname.startsWith("/read/")) {
      const keys = (await cache.keys()).filter((k) => {
        const u = new URL(k.url);
        return u.pathname.startsWith("/read/") && !u.searchParams.has("_rsc");
      });
      const shell = keys.length ? await cache.match(keys[keys.length - 1]) : null;
      if (shell) return shell;
    }
    throw e;
  }
}

/** A saved recording (or its timings): the whole file, or the bytes asked for in a Range header. */
async function savedAudio(req) {
  const hit = await (await caches.open(AUDIO)).match(req.url);
  if (!hit) return fetch(req);
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (!range) return hit;
  const blob = await hit.blob();
  const size = blob.size;
  const start = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
  const end = range[1] !== "" && range[2] !== "" ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "content-type": hit.headers.get("content-type") || "audio/mpeg",
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": String(end - start + 1),
      "accept-ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  // Offline downloads fetch with this flag: always the network, never a cached copy.
  if (url.searchParams.has("va-dl")) return;
  // The lists of recordings and of download sizes: kept so saved audio and sizes work offline.
  if (p === "/api/audio/index.json") return event.respondWith(staleWhileRevalidate(event, AUDIO));
  if (p === "/offline/index.json") return event.respondWith(staleWhileRevalidate(event));
  if (p.startsWith("/api/audio/") && /\.(mp3|json)$/.test(p) && !p.endsWith("index.json")) return event.respondWith(savedAudio(req));
  if (p.startsWith("/api/") || p.endsWith(".mp3") || p === "/sw.js") return;
  if (isData(p)) return event.respondWith(staleWhileRevalidate(event));
  // Prefetches carry a partial payload: never cache (or serve) them as the page.
  if (req.headers.get("Next-Router-Prefetch") || req.headers.get("Next-Router-Segment-Prefetch")) return;
  if (req.mode === "navigate" || req.headers.get("RSC")) return event.respondWith(networkFirst(event, url));
});
