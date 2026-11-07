"use client";
/**
 * Offline downloads: choose a language, then versions to keep on this device, optionally with their
 * recorded read-along audio (all books or chosen ones). Sizes show before anything starts; what's
 * saved is listed with Update and Delete. The work itself is in src/lib/downloads.ts.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { catalog, getVersion } from "@/lib/catalog";
import {
  audioKey,
  cancelDownload,
  checkSaved,
  dismissJob,
  downloadAudio,
  downloadText,
  formatBytes,
  loadIndex,
  refreshDownload,
  removeAllDownloads,
  removeDownload,
  storageInfo,
  supported,
  textKey,
  useDownloads,
  type OfflineIndex,
  type Saved,
} from "@/lib/downloads";
import { useRecordings, type Recording } from "@/lib/recordings";
import { toast } from "@/lib/ui-store";
import { CloseIcon } from "./icons";
import { Modal } from "./modal";
import { useReaderState } from "./use-reader-state";

let open = false;
const subs = new Set<() => void>();
const setOpen = (v: boolean) => {
  open = v;
  subs.forEach((l) => l());
};
export const openDownloads = () => setOpen(true);
const useOpen = () =>
  useSyncExternalStore(
    (l) => {
      subs.add(l);
      return () => subs.delete(l);
    },
    () => open,
    () => false,
  );

export function DownloadsDialog() {
  const isOpen = useOpen();
  return (
    <Modal open={isOpen} onClose={() => setOpen(false)} variant="card" label="Offline downloads">
      {isOpen && <Body />}
    </Modal>
  );
}

/** The button in Display options / Reading settings that opens the window. */
const noSubscribe = () => () => {};
export function OfflineDownloadsButton() {
  const { saved } = useDownloads();
  const n = Object.keys(saved).length;
  // Decided after hydration (the server can't know), so the first render matches the page's HTML.
  const ok = useSyncExternalStore(noSubscribe, supported, () => true);
  if (!ok) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Offline</h3>
      <button type="button" onClick={openDownloads} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm hover:border-faint">
        Offline downloads{n ? ` · ${n} saved` : ""}
      </button>
      <p className="text-xs text-faint">Keep versions, and their read-along audio, on this device to read and listen with no signal.</p>
    </div>
  );
}

const LANG_NAMES: Record<string, string> = { pi: "Pāli" }; // not every browser knows these
const langName = (code: string) => {
  if (LANG_NAMES[code]) return LANG_NAMES[code];
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};
const workName = (id: string) => catalog.works.find((w) => w.id === id)?.name ?? id;
const btn = "min-h-10 rounded-lg px-3 text-sm";

function Body() {
  const { saved, job, missing } = useDownloads();
  const { versions: reading } = useReaderState();
  const recordings = useRecordings();
  const [index, setIndex] = useState<OfflineIndex | null>(null);
  const [space, setSpace] = useState<{ used: number; free: number } | null>(null);
  const [lang, setLang] = useState<string>("reading");
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    void loadIndex().then(setIndex);
    void checkSaved();
  }, []);
  useEffect(() => {
    void storageInfo().then(setSpace);
  }, [saved, job]);

  const languages = useMemo(() => {
    const count = new Map<string, number>();
    for (const v of catalog.versions) if (index?.texts[`${v.work}/${v.id}`]) count.set(v.language, (count.get(v.language) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || langName(a[0]).localeCompare(langName(b[0]))).map(([code]) => code);
  }, [index]);

  const shown = useMemo(() => {
    const list = catalog.versions.filter((v) => index?.texts[`${v.work}/${v.id}`]);
    return lang === "reading" ? list.filter((v) => reading.includes(v.id)) : list.filter((v) => v.language === lang);
  }, [index, lang, reading]);

  /** Start a download unless it clearly won't fit. */
  const start = async (bytes: number, go: () => Promise<boolean>, done: string) => {
    if (job && !job.error) {
      toast("Another download is running. It continues when that one finishes: press Download again then.", 4000);
      return;
    }
    const s = await storageInfo();
    if (s && bytes > s.free * 0.9) {
      toast(`Not enough space: this needs ${formatBytes(bytes)}, and about ${formatBytes(s.free)} is free.`, 5000);
      return;
    }
    if (await go()) toast(done, 3000);
  };

  const savedList = Object.entries(saved).sort((a, b) => b[1].at - a[1].at);

  return (
    <div className="flex max-h-[85dvh] flex-col desk:max-h-[80vh]">
      <div className="flex items-center justify-between border-b border-line py-1 pl-4 pr-1">
        <h2 className="font-serif text-lg font-semibold">Offline downloads</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-raised">
          <CloseIcon />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-3 text-sm">
        <p className="text-muted">
          Save versions on this device to read with no signal, and their read-along audio to listen offline too. The size shows
          before anything downloads.
          {space ? ` About ${formatBytes(space.free)} free for this site.` : ""}
        </p>

        {job && (
          <div className="space-y-2 rounded-xl border border-line px-3 py-3" role="status" aria-live="polite">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-ink">{job.error ? "Download stopped" : `Saving ${job.label}…`}</span>
              <span className="tabular-nums text-faint">
                {formatBytes(job.bytesDone)} of {formatBytes(job.bytesTotal)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-raised" aria-hidden>
              <div className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round((job.done / Math.max(1, job.total)) * 100)}%` }} />
            </div>
            {job.error ? (
              <div className="flex items-start justify-between gap-2">
                <p className="text-ink">{job.error}</p>
                <button type="button" onClick={dismissJob} className={`${btn} shrink-0 border border-line`}>
                  OK
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="tabular-nums text-faint">
                  {job.done} of {job.total} files
                </span>
                <button type="button" onClick={cancelDownload} className={`${btn} border border-line`}>
                  Stop
                </button>
              </div>
            )}
          </div>
        )}

        {savedList.length > 0 && (
          <section className="space-y-2" aria-label="On this device">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">On this device</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {savedList.map(([key, s]) => (
                <SavedRow key={key} k={key} s={s} recordings={recordings} busy={!!job && !job.error} missing={missing[key] ?? 0} />
              ))}
            </ul>
            {!confirmAll ? (
              <button type="button" onClick={() => setConfirmAll(true)} className="text-xs text-faint underline underline-offset-2 hover:text-muted">
                Delete all downloads…
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-ink">Delete every saved version and recording from this device?</span>
                <button
                  type="button"
                  onClick={async () => {
                    await removeAllDownloads();
                    setConfirmAll(false);
                    toast("All downloads deleted");
                  }}
                  className={`${btn} bg-ink font-medium text-paper`}
                >
                  Delete all
                </button>
                <button type="button" onClick={() => setConfirmAll(false)} className={`${btn} text-muted hover:bg-raised`}>
                  Cancel
                </button>
              </div>
            )}
          </section>
        )}

        <section className="space-y-2" aria-label="Add downloads">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Add</h3>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Language">
            {["reading", ...languages].map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={lang === code}
                onClick={() => setLang(code)}
                className={`min-h-9 rounded-full border px-3 text-xs ${lang === code ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:border-faint"}`}
              >
                {code === "reading" ? "Reading now" : langName(code)}
              </button>
            ))}
          </div>
          {!index ? (
            <p className="text-faint">Loading sizes…</p>
          ) : shown.length === 0 ? (
            <p className="text-faint">Nothing to show for this language.</p>
          ) : (
            <ul className="space-y-2">
              {shown.map((v) => (
                <VersionRow key={`${v.work}/${v.id}`} work={v.work} version={v.id} index={index} saved={saved} recordings={recordings.filter((r) => r.version === v.id)} busy={!!job && !job.error} start={start} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SavedRow({ k, s, recordings, busy, missing }: { k: string; s: Saved; recordings: Recording[]; busy: boolean; missing: number }) {
  const v = getVersion(s.version);
  const [confirm, setConfirm] = useState(false);
  const voice = s.kind === "audio" ? (recordings.find((r) => r.version === s.version && r.voice === s.voice)?.label.split(" · ")[0] ?? s.voice) : "";
  const what = s.kind === "text" ? `${v?.abbr ?? s.version} · ${workName(s.work)}` : `${v?.abbr ?? s.version} audio · ${voice}`;
  const detail = s.kind === "text" ? "Text" : `${s.books.length} book${s.books.length === 1 ? "" : "s"}`;
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{what}</p>
        <p className="text-xs text-faint">
          {detail} · {formatBytes(s.bytes)} · saved {new Date(s.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
        {missing > 0 && (
          <p className="text-xs text-ink">
            Incomplete: this browser cleared {missing} file{missing === 1 ? "" : "s"}. Download again to fill them in.
          </p>
        )}
      </div>
      {confirm ? (
        <>
          <button
            type="button"
            onClick={async () => {
              await removeDownload(k);
              toast(`Deleted ${what}`);
            }}
            className={`${btn} bg-ink font-medium text-paper`}
          >
            Delete
          </button>
          <button type="button" onClick={() => setConfirm(false)} className={`${btn} text-muted hover:bg-raised`}>
            Keep
          </button>
        </>
      ) : (
        <>
          {(s.kind === "text" || missing > 0) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshDownload(k).then((ok) => ok && toast(missing > 0 ? `${what} is complete again` : `${v?.abbr ?? s.version} is up to date`))}
              className={`${btn} border border-line disabled:opacity-50`}
            >
              {missing > 0 ? "Download again" : "Update"}
            </button>
          )}
          <button type="button" onClick={() => setConfirm(true)} className={`${btn} border border-line`} aria-label={`Delete ${what}`}>
            Delete
          </button>
        </>
      )}
    </li>
  );
}

function VersionRow({
  work,
  version,
  index,
  saved,
  recordings,
  busy,
  start,
}: {
  work: string;
  version: string;
  index: OfflineIndex;
  saved: Record<string, Saved>;
  recordings: Recording[];
  busy: boolean;
  start: (bytes: number, go: () => Promise<boolean>, done: string) => Promise<void>;
}) {
  const v = getVersion(version)!;
  const text = index.texts[`${work}/${version}`];
  const isSaved = !!saved[textKey(work, version)];
  const voiced = recordings.filter((r) => index.audio[r.id]);
  const [voiceId, setVoiceId] = useState(voiced[0]?.id ?? "");
  const [picking, setPicking] = useState(false);
  const [books, setBooks] = useState<string[]>([]);
  const r = voiced.find((x) => x.id === voiceId);
  const sizes = r ? index.audio[r.id] : {};
  const audioSaved = r ? saved[audioKey(r.version, r.voice)] : undefined;
  const savedBooks = audioSaved?.kind === "audio" ? audioSaved.books : [];
  const allBytes = Object.values(sizes).reduce((a, [b]) => a + b, 0);
  const pickedBytes = books.reduce((a, b) => a + (sizes[b]?.[0] ?? 0), 0);
  const bookName = (id: string) => catalog.religions.flatMap((x) => x.collections.flatMap((c) => c.items)).find((it) => it.work === work && it.id === id)?.name.split(" · ")[0] ?? id;

  return (
    <li className="space-y-2 rounded-xl border border-line px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {v.name} <span className="text-faint">· {v.abbr}</span>
          </p>
          <p className="text-xs text-faint">
            {workName(work)} · {langName(v.language)} · text {formatBytes(text.bytes)}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void start(text.bytes, () => downloadText(work, version), `${v.abbr} saved for offline reading`)}
          className={`${btn} shrink-0 disabled:opacity-50 ${isSaved ? "border border-line text-muted" : "bg-accent font-medium text-accent-ink"}`}
        >
          {isSaved ? "✓ Saved" : `Download · ${formatBytes(text.bytes)}`}
          {isSaved && <span className="sr-only"> (download again)</span>}
        </button>
      </div>

      {r && (
        <div className="space-y-2 border-t border-line pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Read-along audio</span>
            {voiced.length > 1 ? (
              <select
                value={voiceId}
                onChange={(e) => {
                  setVoiceId(e.target.value);
                  setBooks([]);
                }}
                aria-label={`Voice for ${v.abbr}`}
                className="min-h-9 rounded-lg border border-line bg-raised px-2 text-xs"
              >
                {voiced.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-faint">{r.label}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || savedBooks.length === Object.keys(sizes).length}
              onClick={() => void start(allBytes, () => downloadAudio(r, Object.keys(sizes)), `${v.abbr} audio saved for offline listening`)}
              className={`${btn} border border-line disabled:opacity-50`}
            >
              {savedBooks.length === Object.keys(sizes).length ? "✓ All books saved" : `All books · ${formatBytes(allBytes)}`}
            </button>
            <button type="button" aria-expanded={picking} onClick={() => setPicking((p) => !p)} className={`${btn} border border-line`}>
              Choose books…
            </button>
          </div>
          {picking && (
            <div className="space-y-2">
              <ul className="grid max-h-56 grid-cols-1 gap-x-3 overflow-y-auto rounded-lg border border-line px-2 py-1 sm:grid-cols-2">
                {Object.entries(sizes).map(([b, [bytes]]) => {
                  const have = savedBooks.includes(b);
                  return (
                    <li key={b}>
                      <label className="flex min-h-9 items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          disabled={have}
                          checked={have || books.includes(b)}
                          onChange={(e) => setBooks((list) => (e.target.checked ? [...list, b] : list.filter((x) => x !== b)))}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <span className="min-w-0 flex-1 truncate text-ink">{bookName(b)}</span>
                        <span className="tabular-nums text-faint">{have ? "saved" : formatBytes(bytes)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                disabled={busy || !books.length}
                onClick={() =>
                  void start(pickedBytes, () => downloadAudio(r, books), `Audio saved for ${books.length} book${books.length === 1 ? "" : "s"}`).then(() => setBooks([]))
                }
                className={`${btn} bg-accent font-medium text-accent-ink disabled:opacity-50`}
              >
                {books.length ? `Download ${books.length} book${books.length === 1 ? "" : "s"} · ${formatBytes(pickedBytes)}` : "Pick books to download"}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
