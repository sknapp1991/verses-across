"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_LOCATION,
  DEFAULT_VERSIONS,
  findBook,
  parseVersionParam,
  sortVersions,
  versionsForWork,
  type BookRef,
} from "@/lib/catalog";
import { updateSettings, useSettings } from "@/lib/settings";

/**
 * The chapter in the address bar, read directly. Offline, a chapter never opened before is shown by the
 * service worker in another chapter's saved page (public/sw.js); the router then still describes that
 * page, so the reader follows the real address instead. Online the two always agree.
 */
type Loc = { work: string; book: string; chapter: string; v: string | null };
let locHref = "";
let loc: Loc | null = null;
function addressSnapshot(): Loc | null {
  const href = window.location.href;
  if (href !== locHref) {
    locHref = href;
    const m = /^\/read\/([^/]+)\/([^/]+)\/(\d+)\/?$/.exec(window.location.pathname);
    loc = m ? { work: m[1], book: m[2], chapter: m[3], v: new URLSearchParams(window.location.search).get("v") } : null;
  }
  return loc;
}
const noSubscribe = () => () => {};

/** Current location (from the URL path) and selected versions (from ?v=, else saved, else defaults). */
export function useReaderState() {
  const routerParams = useParams<{ work?: string; book?: string; chapter?: string }>();
  const routerSearch = useSearchParams();
  const address = useSyncExternalStore(noSubscribe, addressSnapshot, () => null);
  const differs =
    !!address && !!routerParams.work && (address.work !== routerParams.work || address.book !== routerParams.book || address.chapter !== routerParams.chapter);
  const params = differs ? address : routerParams;
  const search = differs ? new URLSearchParams(address.v ? `v=${address.v}` : "") : routerSearch;
  const router = useRouter();
  const pathname = usePathname();
  const settings = useSettings();

  const work = params.work ?? DEFAULT_LOCATION.work;
  const book = params.book ?? DEFAULT_LOCATION.book;
  const chapter = params.chapter ? Number(params.chapter) : DEFAULT_LOCATION.chapter;
  const ref: BookRef = useMemo(() => ({ work, book, chapter }), [work, book, chapter]);
  const entry = findBook(work, book);
  const vParam = search.get("v");
  const savedForWork = settings.versions[work];

  const versions = useMemo(() => {
    // The user's own order (URL, else saved) is kept as-is; only the defaults use catalog order.
    const fromUrl = parseVersionParam(work, vParam);
    if (fromUrl.length) return fromUrl;
    const saved = parseVersionParam(work, savedForWork?.join(","));
    if (saved.length) return saved;
    const defaults = DEFAULT_VERSIONS[work] ?? versionsForWork(work).slice(0, 1).map((v) => v.id);
    return sortVersions(defaults);
  }, [work, vParam, savedForWork]);

  const setVersions = useCallback(
    (ids: string[]) => {
      const next = [...new Set(ids)];
      if (!next.length) return;
      updateSettings({ versions: { ...settings.versions, [work]: next } });
      // The address bar's path (offline, the router may describe a stand-in page: see addressSnapshot).
      router.replace(`${differs ? window.location.pathname : pathname}?v=${next.join(",")}${window.location.hash}`, { scroll: false });
    },
    [router, pathname, differs, settings.versions, work],
  );

  return { ref, entry, versions, setVersions };
}
