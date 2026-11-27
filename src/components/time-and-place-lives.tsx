"use client";
/**
 * When they lived (Time and place, study lab): the lives of figures from the scriptures on the site on one timeline,
 * the tradition's own dating beside the usual historians' view (the same pattern as "When they were written"),
 * filterable by epoch, tradition, role and name. Tapping a figure opens a card: both datings, where they lived on the
 * map (Bible places open their place page), and the texts on the site where they appear. Data:
 * src/lib/time-and-place-lives.ts.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { booksOfWork, findBook, readHref } from "@/lib/catalog";
import { noteLab } from "@/lib/lab-badges";
import { PROJ, fold, matchScore, project, type IndexPlace, type MapOutline, type Span } from "@/lib/time-and-place";
import { T0, TICKS, field, pct, placeFromHash, placePushed, setPlacePushed, squash, tickLabel } from "@/lib/time-and-place-axis";
import {
  LIFE_ERAS,
  LIFE_TRADITIONS,
  LIVES,
  ROLE_LABEL,
  lifeInEra,
  lifeYear,
  type Life,
  type LifeRole,
} from "@/lib/time-and-place-lives";
import { MapView, fitBox, loadJson, type MapDot } from "./time-and-place-map";
import { PlacePage } from "./time-and-place-page";

const ROLES = Object.keys(ROLE_LABEL) as LifeRole[];

/** Inside the map's area (see PROJ in time-and-place.ts). */
const onMap = (lon: number, lat: number) => lon >= PROJ.bbox[0] && lon <= PROJ.bbox[2] && lat >= PROJ.bbox[1] && lat <= PROJ.bbox[3];

export function Lives({ showChapter }: { showChapter: (book: string, chapter: number) => void }) {
  const [q, setQ] = useState("");
  const [era, setEra] = useState("");
  const [tradition, setTradition] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState<"date" | "name">("date");
  const [open, setOpen] = useState<string | null>(null);

  const [outline, setOutline] = useState<MapOutline | null>(null);
  const [index, setIndex] = useState<IndexPlace[] | null>(null);
  const [indexFailed, setIndexFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);

  // A place page, as on the Places tab: the address carries it, so Back closes it
  useEffect(() => {
    const sync = () => {
      const id = placeFromHash();
      if (!id) setPlacePushed(false);
      setPage(id);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const openPage = (id: string) => {
    const aid = id.split("/")[0];
    noteLab("places", aid); // (the Cartographer badge: each place once)
    setPlacePushed(true);
    location.hash = `place=${aid}`;
  };
  const closePage = () => {
    if (placePushed()) {
      setPlacePushed(false);
      history.back();
    } else {
      history.replaceState(history.state, "", location.pathname + location.search);
      setPage(null);
    }
  };

  // The map and the place list load only once a card or a place page is open
  const needMap = !!open || !!page;
  useEffect(() => {
    if (!needMap) return;
    let live = true;
    loadJson<MapOutline>("/places/map.json").then(
      (o) => live && setOutline(o),
      () => {}, // (the dots still show)
    );
    loadJson<{ places: IndexPlace[] }>("/places/index.json").then(
      (d) => {
        if (!live) return;
        setIndex(d ? d.places : null);
        setIndexFailed(!d);
      },
      () => live && setIndexFailed(true),
    );
    return () => {
      live = false;
    };
  }, [needMap, attempt]);

  const books = useMemo(() => booksOfWork("bible").filter((b) => b.collection.id !== "apocrypha"), []);
  const order = useMemo(() => new Map(books.map((b, i) => [b.id, i])), [books]);
  const byAid = useMemo(() => new Map((index ?? []).map((p) => [p.id.split("/")[0], p])), [index]);
  const pagePlace = page ? (byAid.get(page) ?? null) : null;

  const rows = useMemo(() => {
    const fq = squash(q);
    const eraSpan = LIFE_ERAS.find((e) => e.id === era)?.span;
    const out = LIVES.filter((l) => !eraSpan || lifeInEra(l, eraSpan))
      .filter((l) => !tradition || l.traditions.indexOf(tradition as Life["traditions"][number]) >= 0)
      .filter((l) => !role || l.roles.indexOf(role as LifeRole) >= 0)
      .filter((l) => !fq || squash(`${l.name} ${l.also ?? ""}`).includes(fq) || matchScore(fold(q), l.name) > 0);
    return sort === "name" ? out.sort((a, b) => a.name.replace(/^The /, "").localeCompare(b.name.replace(/^The /, ""))) : out.sort((a, b) => lifeYear(a) - lifeYear(b));
  }, [q, era, tradition, role, sort]);

  /** Up and down arrows (and Home, End) move between the figures on the timeline. */
  const onRowKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (keys.indexOf(e.key) < 0 || !list.current) return;
    const all = Array.prototype.slice.call(list.current.querySelectorAll("button[data-row]")) as HTMLButtonElement[];
    const i = all.indexOf(e.currentTarget);
    const next = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : e.key === "ArrowDown" ? Math.min(all.length - 1, i + 1) : Math.max(0, i - 1);
    e.preventDefault();
    all[next]?.focus();
  };

  return (
    <>
      {page &&
        (indexFailed ? (
          <p className="rounded-xl bg-panel p-4 text-sm text-muted">
            The place couldn&apos;t be loaded.{" "}
            <button className="text-accent hover:underline" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </p>
        ) : !index ? (
          <p className="text-sm text-muted">Loading the place…</p>
        ) : !pagePlace ? (
          <p className="text-sm text-muted">
            No such place.{" "}
            <button className="text-accent hover:underline" onClick={closePage}>
              Back
            </button>
          </p>
        ) : (
          <PlacePage
            key={pagePlace.id}
            place={pagePlace}
            jerusalem={byAid.get("a15257a") ?? null}
            order={order}
            back={closePage}
            showChapter={(b, c) => {
              // (straight to the chapter on the Places tab: drop the #place without a history step)
              setPlacePushed(false);
              history.replaceState(history.state, "", location.pathname + location.search);
              setPage(null);
              showChapter(b, c);
            }}
          />
        ))}

      <section className="space-y-4" hidden={!!page} aria-labelledby="lives-title">
        <h2 id="lives-title" className="sr-only">
          When they lived
        </h2>
        <p className="text-sm text-muted">
          Patriarchs, prophets, kings, sages, founders and gurus from the scriptures on this site. For some, historians can date a life to within
          a few years; for others there is no evidence outside the scriptures, and only the tradition&apos;s own dating is given. Tap a name to
          see both, where they lived, and where to read about them.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block">
            <span className="sr-only">Find a name</span>
            <input type="search" className={field} placeholder="Find: Moses, Buddha, Nanak…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label className="block">
            <span className="sr-only">Epoch</span>
            <select className={field} value={era} onChange={(e) => setEra(e.target.value)}>
              <option value="">All epochs</option>
              {LIFE_ERAS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Tradition</span>
            <select className={field} value={tradition} onChange={(e) => setTradition(e.target.value)}>
              <option value="">All traditions</option>
              {LIFE_TRADITIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Role</span>
            <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Sort</span>
            <select className={field} value={sort} onChange={(e) => setSort(e.target.value === "name" ? "name" : "date")}>
              <option value="date">Sort by date</option>
              <option value="name">Sort by name</option>
            </select>
          </label>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <li className="flex items-center gap-2">
            <span className="inline-block h-2 w-6 rounded-full bg-accent" /> Usual historians&apos; range
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block h-2 w-6 rounded-full border-2 border-muted" /> The tradition&apos;s own dating
          </li>
        </ul>

        <div className="rounded-2xl border border-line bg-panel p-3">
          <div className="relative mb-1 h-5 text-[10px] text-faint" aria-hidden>
            {TICKS.map((t, i) => (
              <span
                key={t}
                className="absolute top-0 whitespace-nowrap"
                style={{
                  left: `${pct(t)}%`,
                  transform: i === 0 ? "none" : i === TICKS.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
                }}
              >
                {i % 2 === 0 || t === 0 ? tickLabel(t) : ""}
              </span>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="p-3 text-sm text-muted">No one matches. Try another name, epoch, tradition or role.</p>
          ) : (
            <ul ref={list} className="divide-y divide-line" aria-label={`${rows.length} ${rows.length === 1 ? "figure" : "figures"}`}>
              {rows.map((l) => (
                <LifeRow
                  key={l.id}
                  life={l}
                  open={open === l.id}
                  toggle={() => setOpen(open === l.id ? null : l.id)}
                  onKey={onRowKey}
                >
                  {open === l.id && (
                    <LifeCard
                      life={l}
                      outline={outline}
                      index={index}
                      indexFailed={indexFailed}
                      retry={() => setAttempt((a) => a + 1)}
                      openPage={openPage}
                    />
                  )}
                </LifeRow>
              ))}
            </ul>
          )}
        </div>
        <p className="text-xs text-faint">
          Dates are kept broad and follow ranges widely given in standard reference works. Where historians have no evidence outside the
          scriptures, that says nothing either way about a figure&apos;s place in faith: it means only that the years can&apos;t be checked. The
          timeline runs from 2200 BCE; an arrow marks a tradition&apos;s dating that reaches further back.
        </p>
      </section>
    </>
  );
}

function Bar({ span, kind }: { span: Span; kind: "trad" | "sch" }) {
  const left = pct(span[0]);
  const width = pct(span[1]) - left;
  return (
    <>
      {span[0] < T0 && (
        <span className={`absolute left-0 text-[10px] leading-none text-muted ${kind === "sch" ? "bottom-0" : "top-0"}`} aria-hidden>
          ◂
        </span>
      )}
      <span
        className={`absolute block rounded-full ${kind === "sch" ? "bottom-0.5 h-2 bg-accent" : "top-0.5 h-2 border-2 border-muted"}`}
        style={{ left: `${left}%`, width: `${width}%`, minWidth: 6 }}
      />
    </>
  );
}

function LifeRow({
  life: l,
  open,
  toggle,
  onKey,
  children,
}: {
  life: Life;
  open: boolean;
  toggle: () => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
}) {
  return (
    <li>
      <button
        data-row
        onClick={toggle}
        onKeyDown={onKey}
        aria-expanded={open}
        aria-controls={`life-${l.id}`}
        className="block w-full py-2 text-left hover:bg-raised"
      >
        <span className="flex items-baseline justify-between gap-2 px-1">
          <span className="font-semibold text-ink">{l.name}</span>
          <span className="shrink-0 text-right text-xs text-muted">{l.when}</span>
        </span>
        <span className="relative mt-1 block h-5" aria-hidden>
          {TICKS.map((t) => (
            <span key={t} className="absolute top-0 block h-5 border-l border-line" style={{ left: `${pct(t)}%` }} />
          ))}
          {l.tradSpan && <Bar span={l.tradSpan} kind="trad" />}
          {l.span && <Bar span={l.span} kind="sch" />}
        </span>
        <span className="block px-1 text-xs text-faint">
          {l.traditions.join(", ")} · {l.roles.map((r) => ROLE_LABEL[r]).join(", ")}
        </span>
      </button>
      <div id={`life-${l.id}`}>{children}</div>
    </li>
  );
}

function LifeCard({
  life: l,
  outline,
  index,
  indexFailed,
  retry,
  openPage,
}: {
  life: Life;
  outline: MapOutline | null;
  index: IndexPlace[] | null;
  indexFailed: boolean;
  retry: () => void;
  openPage: (id: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const byId = useMemo(() => new Map((index ?? []).map((p) => [p.id, p])), [index]);

  // Bible places come from the place list (they open a place page); other places are a dot from their coordinates
  const dots: MapDot[] = useMemo(() => {
    const out: MapDot[] = [];
    for (const p of l.places) {
      if (p.id) {
        const ip = byId.get(p.id);
        if (ip && ip.x !== undefined) out.push({ id: p.id, n: p.n, x: ip.x, y: ip.y!, c: ip.c, a: ip.a });
      } else if (p.geo && onMap(p.geo[0], p.geo[1])) {
        const [x, y] = project(p.geo[0], p.geo[1]);
        out.push({ id: `geo:${p.n}`, n: p.n, x, y, c: 2 });
      }
    }
    return out;
  }, [l, byId]);
  const mappable = l.places.some((p) => p.id || (p.geo && onMap(p.geo[0], p.geo[1])));
  const box = useMemo(() => fitBox(dots, 300), [dots]);
  const pick = (id: string) => {
    const next = id === picked ? null : id;
    setPicked(next);
    if (next && !next.startsWith("geo:")) noteLab("places", next.split("/")[0]); // (as when a dot is tapped on the Places tab)
  };
  const sel = picked ? (l.places.find((p) => (p.id ?? `geo:${p.n}`) === picked) ?? null) : null;
  const texts = l.texts.filter((t) => findBook(t.work, t.book));

  return (
    <article className="mb-3 space-y-4 rounded-2xl border border-accent bg-paper p-4" aria-label={l.name}>
      <div>
        <h3 className="font-serif text-2xl font-semibold text-ink">{l.name}</h3>
        {l.also && <p className="text-xs text-faint">Also: {l.also}</p>}
        <p className="mt-2 text-sm text-ink">{l.summary}</p>
      </div>

      {l.agreed ? (
        <div className="rounded-xl bg-panel p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Tradition and historians broadly agree</p>
          <p className="text-sm text-ink">{l.scholarly}</p>
          <p className="mt-1 text-sm text-muted">{l.traditional}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-panel p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">As the tradition tells it</p>
            <p className="text-sm text-ink">{l.traditional}</p>
          </div>
          <div className="rounded-xl bg-panel p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">As historians see it</p>
            <p className="text-sm text-ink">{l.scholarly}</p>
          </div>
        </div>
      )}
      <p className="text-xs text-faint">Sources: {l.source}</p>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-ink">Where they lived</h4>
        {mappable &&
          (indexFailed ? (
            <p className="text-sm text-muted">
              The map couldn&apos;t be loaded.{" "}
              <button className="text-accent hover:underline" onClick={retry}>
                Try again
              </button>
            </p>
          ) : !index ? (
            <p className="text-sm text-muted">Loading the map…</p>
          ) : (
            dots.length > 0 && (
              <MapView
                outline={outline}
                initial={box}
                home={box}
                homeLabel={`Back to ${l.name}'s places`}
                dots={dots}
                picked={picked}
                pick={pick}
                label={`Map of places in the life of ${l.name}, ${dots.length} ${dots.length === 1 ? "place" : "places"}`}
              />
            )
          ))}
        <ul className="flex flex-wrap gap-2">
          {l.places.map((p) => {
            const id = p.id ?? `geo:${p.n}`;
            const canPick = dots.some((d) => d.id === id);
            return (
              <li key={id}>
                {canPick ? (
                  <button
                    onClick={() => pick(id)}
                    aria-pressed={picked === id}
                    className={`min-h-9 rounded-full border px-3 text-sm ${
                      picked === id ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel text-ink hover:bg-raised"
                    }`}
                  >
                    {p.n}
                  </button>
                ) : p.id && byId.has(p.id) ? (
                  <button
                    onClick={() => openPage(p.id!)}
                    className="min-h-9 rounded-full border border-line bg-panel px-3 text-sm text-ink hover:bg-raised"
                  >
                    {p.n}: open the place page →
                  </button>
                ) : (
                  <span className="inline-block rounded-xl bg-panel px-3 py-1.5 text-sm text-ink">
                    {p.n}
                    {p.note && <span className="text-muted">: {p.note}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {sel && (
          <div className="rounded-xl bg-panel p-3 text-sm" aria-live="polite">
            <p className="text-ink">
              <span className="font-semibold">{sel.n}</span>
              {sel.note ? `: ${sel.note}.` : ""}
            </p>
            {sel.id ? (
              <button onClick={() => openPage(sel.id!)} className="mt-1 font-semibold text-accent hover:underline">
                Open the place page →
              </button>
            ) : (
              <p className="mt-1 text-xs text-faint">Not a place named in the Bible, so there is no place page for it here.</p>
            )}
          </div>
        )}
        {mappable && !sel && dots.length > 0 && <p className="text-xs text-muted">Tap a dot or a name for more.</p>}
      </div>

      {texts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">Read about {l.name.replace(/^The /, "the ")} on this site</h4>
          <ul className="space-y-1">
            {texts.map((t) => (
              <li key={`${t.work}/${t.book}/${t.chapter}/${t.verse ?? ""}`}>
                <Link
                  href={readHref({ work: t.work, book: t.book, chapter: t.chapter }, undefined, t.verse ? String(t.verse) : undefined)}
                  className="text-sm text-accent hover:underline"
                >
                  {t.label} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
