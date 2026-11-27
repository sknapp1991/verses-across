"use client";
/**
 * The Time and place map (study lab, hub 7a62bb28): plain SVG, no map library, no tiles. The viewBox is the committed
 * view; during a drag, pinch, wheel or Safari trackpad gesture only a CSS transform on a wrapper changes (no React
 * render), and the new view is committed when the gesture ends. Layers: the Natural Earth outline (two levels of
 * detail), shaded regions, routes, background dots, the main dots, and labels placed by priority so they never pile up.
 */
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { MAP_SIZE, SURE_LABEL, project, type IndexPlace, type MapOutline, type WaterLabel } from "@/lib/time-and-place";

/* ---------------- data loading ---------------- */

/** Loads a JSON file once; a failed load rejects and isn't kept, so "Try again" refetches. 404 → null. */
const jsonCache = new Map<string, Promise<unknown>>();
export function loadJson<T>(url: string): Promise<T | null> {
  let p = jsonCache.get(url) as Promise<T | null> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<T>;
    });
    p.catch(() => jsonCache.delete(url));
    jsonCache.set(url, p);
  }
  return p;
}

/* ---------------- geometry ---------------- */

export type Box = { x: number; y: number; w: number; h: number };
export const ASPECT = 4 / 3;
export const boxAround = (x: number, y: number, w: number): Box => ({ x: x - w / 2, y: y - w / ASPECT / 2, w, h: w / ASPECT });
/** The wide view: from Italy to Persia, Asia Minor to Egypt. */
export const WIDE: Box = (() => {
  const [x0, y0] = project(8, 44);
  const [x1] = project(60, 14);
  const w = x1 - x0;
  return { x: x0, y: y0, w, h: w / ASPECT };
})();

export function fitBox(pts: { x?: number; y?: number }[], minW = 160): Box {
  const ps = pts.filter((p) => p.x !== undefined);
  if (!ps.length) return WIDE;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of ps) {
    x0 = Math.min(x0, p.x!);
    x1 = Math.max(x1, p.x!);
    y0 = Math.min(y0, p.y!);
    y1 = Math.max(y1, p.y!);
  }
  const pad = Math.max(30, (x1 - x0) * 0.18, (y1 - y0) * 0.18);
  let w = Math.max(minW, x1 - x0 + pad * 2);
  const h = Math.max(minW / ASPECT, y1 - y0 + pad * 2);
  if (w / h < ASPECT) w = h * ASPECT;
  return boxAround((x0 + x1) / 2, (y0 + y1) / 2, w);
}

/** Closest zoom: about 60 km across. Widest: the whole map. */
const MIN_W = 60;
const MAX_W = MAP_SIZE.w;
/** Below this width (map units across) the detailed outline is used. */
const DETAIL_W = 2600;

const finite = (b: Box) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.w) && b.w > 0;
function clampView(v: Box): Box {
  const w = Math.min(MAX_W, Math.max(MIN_W, v.w));
  const h = w / ASPECT;
  const cx = Math.min(MAP_SIZE.w, Math.max(0, v.x + v.w / 2));
  const cy = Math.min(MAP_SIZE.h, Math.max(0, v.y + v.h / 2));
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/* ---------------- layers ---------------- */

/** A main dot: a chapter's place, a journey's stop (numbered), an era's place. */
export type MapDot = { id: string; n: string; x: number; y: number; c: number; a?: 1; num?: number; w?: number };
/** A line: the journey so far ("main"), the rest of it ("ahead"), another proposed route ("alt"). */
export type MapRoute = { id: string; pts: [number, number][]; kind: "main" | "ahead" | "alt"; label?: string };
/** A soft shaded region (a power's rough reach). tone 0 or 1 picks the shade. */
export type MapRegion = { id: string; d: string; label: string; sub: string; lx: number; ly: number; tone: number };
export type MapApi = { set: (b: Box) => void; flyTo: (b: Box) => void };
/** A soft glow (the heat map): t from 0 to 1 sets its size and strength; tone 0 is the accent colour, 1 the second. */
export type MapGlow = { id: string; x: number; y: number; t: number; tone: 0 | 1 };
/** The glows' colours (theme tokens, so they follow light and dark). */
export const GLOW_COLOR = ["var(--accent)", "var(--heard)"];
/** At most this many glows are drawn at once (the strongest in view). */
const MAX_GLOWS = 300;
/** useId, safe inside url(#…) (React's ids can carry colons or other marks). */
export const useSvgId = () => useId().replace(/[^A-Za-z0-9_-]/g, "");

export function Dot({ c, r, on = false }: { c: number; r: number; on?: boolean }) {
  if (c === 2) return <circle r={r} className="fill-accent stroke-paper" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
  if (c === 1)
    return (
      <circle
        r={r}
        className={on ? "fill-accent stroke-ink" : "fill-accent-soft stroke-accent"}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    );
  return (
    <circle
      r={r}
      className={on ? "fill-accent stroke-ink" : "fill-paper stroke-accent"}
      strokeWidth={2}
      strokeDasharray="2 2"
      vectorEffect="non-scaling-stroke"
    />
  );
}

export function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {[2, 1, 0].map((c) => (
        <li key={c} className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden>
            <Dot c={c} r={4.5} />
          </svg>
          {SURE_LABEL[c]}
        </li>
      ))}
    </ul>
  );
}

/** A pending gesture, as a CSS transform of the drawn map: screen point p shows what was at (p - t) / s. */
type Xf = { s: number; tx: number; ty: number };
const NO_XF: Xf = { s: 1, tx: 0, ty: 0 };

const Outline = memo(function Outline({ o }: { o: MapOutline }) {
  return (
    <>
      <path d={o.land} className="fill-paper stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d={o.lakes} className="fill-raised stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d={o.rivers} className="fill-none stroke-line" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </>
  );
});

type Label = {
  id: string;
  x: number;
  y: number;
  text: string;
  kind: "picked" | "main" | "route" | "water" | "sea" | "region" | "bg";
  italic?: boolean;
};

const routePath = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");

export function MapView({
  outline,
  initial,
  home,
  homeLabel,
  dots,
  picked,
  pick,
  focus = null,
  background = null,
  pickBackground,
  routes = [],
  regions = [],
  glows = [],
  controlRef,
  label,
}: {
  outline: MapOutline | null;
  /** Where the map starts when it mounts. */
  initial: Box;
  /** Where "Fit" goes. */
  home: Box;
  homeLabel: string;
  dots: MapDot[];
  picked: string | null;
  pick: (id: string) => void;
  focus?: { id: string; n: string; x?: number; y?: number } | null;
  background?: IndexPlace[] | null;
  pickBackground?: (id: string) => void;
  routes?: MapRoute[];
  regions?: MapRegion[];
  glows?: MapGlow[];
  controlRef?: MutableRefObject<MapApi | null>;
  label: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Box>(() => clampView(initial));
  const [px, setPx] = useState(640);
  const [detail, setDetail] = useState<MapOutline | null>(null);
  const viewRef = useRef(view);
  const pxRef = useRef(px);
  const xf = useRef<Xf>(NO_XF);
  const homeRef = useRef(home);
  const api = useRef<{
    zoomBy: (f: number) => void;
    panBy: (dx: number, dy: number) => void;
    set: (b: Box) => void;
    flyTo: (b: Box) => void;
  } | null>(null);

  // A new view is drawn: drop the CSS transform in the same frame
  useLayoutEffect(() => {
    viewRef.current = view;
    xf.current = NO_XF;
    const l = layerRef.current;
    if (l) {
      l.style.transition = "";
      l.style.transform = "";
    }
  }, [view]);
  useEffect(() => {
    homeRef.current = home;
  }, [home]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      pxRef.current = el.clientWidth || 640;
      setPx(pxRef.current);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The detailed outline, once someone zooms in
  const wantDetail = view.w < DETAIL_W;
  useEffect(() => {
    if (!wantDetail || detail) return;
    let live = true;
    loadJson<MapOutline>("/places/map-detail.json").then(
      (d) => live && d && setDetail(d),
      () => {}, // (the overview still shows)
    );
    return () => {
      live = false;
    };
  }, [wantDetail, detail]);

  // Gestures: pointer drag and pinch, wheel and trackpad, Safari's gesture events; and the API for buttons and keys
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let flying: ReturnType<typeof setTimeout> | undefined;
    const paint = () => {
      const { s, tx, ty } = xf.current;
      if (layerRef.current) layerRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    };
    const commit = () => {
      const v = viewRef.current;
      const { s, tx, ty } = xf.current;
      if (s === 1 && tx === 0 && ty === 0) return;
      const u = v.w / pxRef.current;
      const next = { x: v.x - (tx / s) * u, y: v.y - (ty / s) * u, w: v.w / s, h: v.h / s };
      if (!finite(next) || !Number.isFinite(s) || s <= 0) {
        xf.current = NO_XF; // (never commit a broken view)
        paint();
        return;
      }
      setView(clampView(next)); // (the layout effect clears the transform when it's drawn)
    };
    const clampS = (s: number) => {
      const w = viewRef.current.w;
      return Math.min(w / MIN_W, Math.max(w / MAX_W, s));
    };
    /** Zoom by f about screen point (cx, cy), from a starting transform. */
    const zoomFrom = (base: Xf, f: number, cx: number, cy: number) => {
      if (!Number.isFinite(f) || f <= 0) return;
      const s = clampS(base.s * f);
      const k = s / base.s;
      xf.current = { s, tx: cx - (cx - base.tx) * k, ty: cy - (cy - base.ty) * k };
      paint();
    };
    const centre = () => ({ x: pxRef.current / 2, y: pxRef.current / ASPECT / 2 });
    const local = (e: { clientX?: number; clientY?: number }) => {
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return centre();
      const r = el.getBoundingClientRect();
      return { x: e.clientX! - r.left, y: e.clientY! - r.top };
    };
    const stopFlight = () => {
      if (!flying) return;
      clearTimeout(flying);
      flying = undefined;
      if (layerRef.current) layerRef.current.style.transition = "";
      commit();
    };

    const pts = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0 };
    let base: Xf = NO_XF;
    let pinch: { d: number; mx: number; my: number } | null = null;
    let moved = false;
    const twoPoints = () => {
      const [a, b] = Array.from(pts.values());
      return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    const restart = () => {
      base = { ...xf.current };
      if (pts.size >= 2) pinch = twoPoints();
      else {
        pinch = null;
        const p = pts.values().next().value;
        if (p) start = { ...p };
      }
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopFlight();
      if (pts.size === 0) moved = false;
      pts.set(e.pointerId, local(e));
      restart();
    };
    const up = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return;
      if (pts.size === 0) {
        if (moved) commit();
      } else restart();
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      if (e.pointerType === "mouse" && e.buttons === 0) return up(e); // (released outside the window)
      pts.set(e.pointerId, local(e));
      if (pts.size >= 2 && pinch) {
        const now = twoPoints();
        moved = true;
        const s = clampS(base.s * (now.d / pinch.d));
        const k = s / base.s;
        // the point under the fingers' first midpoint follows the midpoint
        xf.current = { s, tx: now.mx - (pinch.mx - base.tx) * k, ty: now.my - (pinch.my - base.ty) * k };
        paint();
      } else if (pts.size === 1) {
        const p = local(e);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        if (!moved && Math.hypot(dx, dy) > 6) {
          moved = true;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            // (fine without)
          }
        }
        if (moved) {
          xf.current = { s: base.s, tx: base.tx + dx, ty: base.ty + dy };
          paint();
        }
      }
    };
    // A drag that ends over a dot isn't a tap
    const click = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    // The wheel zooms only for a trackpad pinch (ctrlKey) or once the map has focus; otherwise the page scrolls
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;
    const wheel = (e: WheelEvent) => {
      if (pts.size > 0) return;
      if (!e.ctrlKey && document.activeElement !== el) return;
      e.preventDefault();
      stopFlight();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const f = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.002));
      const p = local(e);
      zoomFrom(xf.current, f, p.x, p.y);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(commit, 160);
    };

    // Safari (macOS trackpad, older iOS): gesture events carry the pinch scale
    type GestureEvt = Event & { scale?: number; clientX?: number; clientY?: number };
    let gBase: Xf | null = null;
    let gAt = { x: 0, y: 0 };
    const gStart = (ev: Event) => {
      ev.preventDefault();
      if (pts.size > 0) return; // (touch pinch is handled by pointer events)
      stopFlight();
      gBase = { ...xf.current };
      gAt = local(ev as GestureEvt);
    };
    const gChange = (ev: Event) => {
      ev.preventDefault();
      if (!gBase || pts.size > 0) return;
      const s = (ev as GestureEvt).scale;
      if (typeof s === "number") zoomFrom(gBase, s, gAt.x, gAt.y);
    };
    const gEnd = (ev: Event) => {
      ev.preventDefault();
      if (!gBase) return;
      gBase = null;
      if (pts.size === 0) commit();
    };

    const zoomBy = (f: number) => {
      stopFlight();
      const c = centre();
      zoomFrom(xf.current, f, c.x, c.y);
      commit();
    };
    const panBy = (dx: number, dy: number) => {
      stopFlight();
      xf.current = { ...xf.current, tx: xf.current.tx + dx, ty: xf.current.ty + dy };
      commit();
    };
    const set = (b: Box) => {
      stopFlight();
      if (finite(b)) setView(clampView(b));
    };
    /** Glide to a view with a CSS transition, then commit it. */
    const flyTo = (b0: Box) => {
      if (!finite(b0)) return;
      stopFlight();
      const b = clampView(b0);
      const v = viewRef.current;
      const u = v.w / pxRef.current;
      const s = v.w / b.w;
      const target: Xf = { s, tx: ((v.x - b.x) * s) / u, ty: ((v.y - b.y) * s) / u };
      const l = layerRef.current;
      const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!l || reduce) return set(b);
      l.style.transition = "transform 0.7s ease";
      xf.current = target;
      paint();
      flying = setTimeout(() => {
        flying = undefined;
        l.style.transition = "";
        setView(b);
      }, 720);
    };
    api.current = { zoomBy, panBy, set, flyTo };
    if (controlRef) controlRef.current = { set, flyTo };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("gesturestart", gStart);
    el.addEventListener("gesturechange", gChange);
    el.addEventListener("gestureend", gEnd);
    return () => {
      clearTimeout(wheelTimer);
      clearTimeout(flying);
      if (controlRef) controlRef.current = null;
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("gesturestart", gStart);
      el.removeEventListener("gesturechange", gChange);
      el.removeEventListener("gestureend", gEnd);
    };
  }, [controlRef]);

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // (browser zoom, back, and so on)
    const a = api.current;
    if (!a) return;
    const step = pxRef.current * 0.2;
    const keys: Record<string, () => void> = {
      "+": () => a.zoomBy(1.5),
      "=": () => a.zoomBy(1.5),
      "-": () => a.zoomBy(1 / 1.5),
      _: () => a.zoomBy(1 / 1.5),
      "0": () => a.set(homeRef.current),
      ArrowLeft: () => a.panBy(step, 0),
      ArrowRight: () => a.panBy(-step, 0),
      ArrowUp: () => a.panBy(0, step),
      ArrowDown: () => a.panBy(0, -step),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const u = view.w / px; // map units per screen pixel
  const fs = 12 * u;
  const inView = (x: number, y: number, m = 0) => x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + view.h + m;

  // Background dots: every Bible place in view (not already a main dot), the most often named first, at most 400
  const bg = useMemo(() => {
    if (!background) return [];
    const mine = new Set(dots.map((p) => p.id));
    return background
      .filter((p) => p.x !== undefined && !mine.has(p.id) && inView(p.x, p.y!, 20 * u))
      .sort((a, b) => b.w - a.w)
      .slice(0, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inView follows view and u
  }, [background, dots, view, u]);
  // Main dots in view (an era can light up hundreds), the surer and more often named first
  const shownDots = useMemo(
    () => dots.filter((p) => p.id === picked || inView(p.x, p.y, 20 * u)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inView follows view and u
    [dots, picked, view, u],
  );

  // Glows in view (their size is in screen pixels, so they stay readable at every zoom)
  const glowId = useSvgId();
  const shownGlows = useMemo(
    () => {
      const near = glows.filter((g) => inView(g.x, g.y, 40 * u));
      if (near.length <= MAX_GLOWS) return near;
      // (the strongest, still drawn weakest first so the strong ones sit on top)
      return near
        .slice()
        .sort((a, b) => b.t - a.t)
        .slice(0, MAX_GLOWS)
        .reverse();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inView follows view and u
    [glows, view, u],
  );

  // Labels by priority: the chosen place, the main dots (surer and more often named first), route names, water,
  // regions, then other places; one that would overlap a label already placed is left out at this zoom
  const labels = useMemo(() => {
    const cand: Label[] = [];
    const focusId = focus?.id;
    if (focus && focus.x !== undefined) cand.push({ id: focus.id, x: focus.x, y: focus.y!, text: focus.n, kind: "picked" });
    const order = [...shownDots].sort(
      (a, b) => (b.id === picked ? 1 : 0) - (a.id === picked ? 1 : 0) || b.c - a.c || (b.w ?? 0) - (a.w ?? 0),
    );
    for (const p of order)
      if (p.id !== focusId)
        cand.push({
          id: `d:${p.id}:${p.num ?? ""}`,
          x: p.x,
          y: p.y,
          text: p.n,
          kind: p.id === picked ? "picked" : "main",
          italic: !!p.a,
        });
    for (const r of routes)
      if (r.label && r.pts.length) {
        const mid = r.pts[Math.floor(r.pts.length / 2)];
        cand.push({ id: `r:${r.id}`, x: mid[0], y: mid[1], text: r.label, kind: "route", italic: true });
      }
    const water: WaterLabel[] = outline?.labels ?? [];
    for (const l of water)
      if (view.w <= l.z) cand.push({ id: `w:${l.n}`, x: l.x, y: l.y, text: l.n, kind: l.k === "sea" ? "sea" : "water", italic: true });
    for (const g of regions) cand.push({ id: `g:${g.id}`, x: g.lx, y: g.ly, text: `${g.label} (approximate)`, kind: "region" });
    for (const p of bg) if (p.id !== focusId) cand.push({ id: p.id, x: p.x!, y: p.y!, text: p.n, kind: "bg", italic: !!p.a });

    const taken: Box[] = [];
    const out: Label[] = [];
    for (const l of cand) {
      if (!inView(l.x, l.y)) continue;
      const size = l.kind === "sea" || l.kind === "region" ? fs * 1.05 : l.kind === "bg" || l.kind === "route" ? fs * 0.9 : fs;
      const w = l.text.length * size * 0.56 + 4 * u;
      const centred = l.kind === "sea" || l.kind === "water" || l.kind === "region" || l.kind === "route";
      const r: Box = { x: centred ? l.x - w / 2 : l.x + 7 * u, y: l.y - size * 0.7, w, h: size * 1.4 };
      const hit = taken.some((t) => r.x < t.x + t.w && r.x + r.w > t.x && r.y < t.y + t.h && r.y + r.h > t.y);
      if (hit && l.kind !== "picked") continue;
      taken.push(r);
      out.push(l);
      if (out.length >= 80) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inView follows view
  }, [shownDots, picked, focus, bg, outline, routes, regions, view, fs, u]);

  const shown = wantDetail && detail ? detail : outline;
  const btn =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-panel text-base font-semibold text-ink shadow hover:bg-raised";
  const textStyle = { paintOrder: "stroke", stroke: "var(--paper)", strokeWidth: 3 * u, strokeLinejoin: "round" } as const;

  return (
    <div className="relative">
      <div
        ref={boxRef}
        tabIndex={0}
        onKeyDown={onKey}
        role="application"
        aria-label={`${label}. Drag to move, pinch to zoom (or scroll once the map is selected); keys: plus, minus, arrows, 0 to reset.`}
        className="relative overflow-hidden rounded-2xl border border-line bg-raised outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ touchAction: "none", cursor: "grab" }}
      >
        <div ref={layerRef} style={{ transformOrigin: "0 0", willChange: "transform" }}>
          <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="block h-auto w-full select-none" aria-hidden>
            <rect x={-MAP_SIZE.w} y={-MAP_SIZE.h} width={MAP_SIZE.w * 3} height={MAP_SIZE.h * 3} className="fill-raised" />
            {shown && <Outline o={shown} />}
            {regions.map((g) => (
              <path
                key={g.id}
                d={g.d}
                className={g.tone ? "fill-ink stroke-muted" : "fill-accent stroke-accent"}
                fillOpacity={g.tone ? 0.07 : 0.12}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
            {shownGlows.length > 0 && (
              <>
                <defs>
                  {GLOW_COLOR.map((c, i) => (
                    <radialGradient key={c} id={`tp-glow-${i}-${glowId}`}>
                      <stop offset="0%" style={{ stopColor: c, stopOpacity: 0.9 }} />
                      <stop offset="45%" style={{ stopColor: c, stopOpacity: 0.45 }} />
                      <stop offset="100%" style={{ stopColor: c, stopOpacity: 0 }} />
                    </radialGradient>
                  ))}
                </defs>
                <g pointerEvents="none">
                  {shownGlows.map((g) => (
                    <circle
                      key={`${g.tone}:${g.id}`}
                      cx={g.x}
                      cy={g.y}
                      r={(10 + 26 * g.t) * u}
                      fill={`url(#tp-glow-${g.tone}-${glowId})`}
                      fillOpacity={0.25 + 0.75 * g.t}
                    />
                  ))}
                </g>
              </>
            )}
            {routes.map((r) => (
              <path
                key={r.id}
                d={routePath(r.pts)}
                className={r.kind === "main" ? "fill-none stroke-accent" : "fill-none stroke-muted"}
                strokeWidth={r.kind === "main" ? 3 : 2}
                strokeDasharray={r.kind === "main" ? undefined : r.kind === "alt" ? "8 5" : "3 4"}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}
            {bg.map((p) => (
              <g key={p.id} transform={`translate(${p.x} ${p.y})`} onClick={() => pickBackground?.(p.id)} className="cursor-pointer">
                <circle r={16 * u} fill="transparent" />
                <circle r={2.5 * u} className="fill-faint" />
              </g>
            ))}
            {shownDots.map((p) => {
              const on = p.id === picked;
              return (
                <g
                  key={`${p.id}:${p.num ?? ""}`}
                  transform={`translate(${p.x} ${p.y})`}
                  onClick={() => pick(p.id)}
                  className="cursor-pointer"
                >
                  <circle r={16 * u} fill="transparent" />
                  {on && (
                    <circle r={(p.num ? 12 : 10) * u} className="fill-none stroke-ink" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  )}
                  {p.num ? (
                    <>
                      <circle
                        r={8 * u}
                        className={on ? "fill-accent stroke-ink" : "fill-paper stroke-accent"}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={p.c === 0 ? "2 2" : undefined}
                      />
                      <text
                        fontSize={9 * u}
                        textAnchor="middle"
                        y={3.2 * u}
                        className={on ? "fill-accent-ink font-semibold" : "fill-ink font-semibold"}
                      >
                        {p.num}
                      </text>
                    </>
                  ) : (
                    <Dot c={p.c} r={(on ? 6 : 4.5) * u} on={on} />
                  )}
                </g>
              );
            })}
            {focus && focus.x !== undefined && (
              <g transform={`translate(${focus.x} ${focus.y})`} pointerEvents="none">
                <circle r={11 * u} className="fill-none stroke-ink" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                <circle r={5.5 * u} className="fill-accent stroke-paper" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            )}
            <g pointerEvents="none">
              {labels.map((l) => {
                const centred = l.kind === "sea" || l.kind === "water" || l.kind === "region" || l.kind === "route";
                const size = l.kind === "sea" || l.kind === "region" ? fs * 1.05 : l.kind === "bg" || l.kind === "route" ? fs * 0.9 : fs;
                const lift = l.kind === "route" ? -10 * u : 0;
                return (
                  <text
                    key={l.id}
                    x={centred ? l.x : l.x + (l.id.endsWith(":") ? 7 : 11) * u}
                    y={l.y + size * 0.35 + lift}
                    fontSize={size}
                    textAnchor={centred ? "middle" : undefined}
                    fontStyle={l.italic ? "italic" : undefined}
                    letterSpacing={l.kind === "sea" ? size * 0.12 : undefined}
                    className={
                      l.kind === "picked"
                        ? "fill-ink font-semibold"
                        : l.kind === "main"
                          ? "fill-ink"
                          : l.kind === "bg" || l.kind === "route"
                            ? "fill-muted"
                            : l.kind === "region"
                              ? "fill-muted font-semibold"
                              : "fill-faint"
                    }
                    style={textStyle}
                  >
                    {l.text}
                  </text>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button className={btn} aria-label="Zoom in" onClick={() => api.current?.zoomBy(1.6)}>
          +
        </button>
        <button className={btn} aria-label="Zoom out" onClick={() => api.current?.zoomBy(1 / 1.6)}>
          −
        </button>
        <button className={`${btn} text-[11px]`} aria-label={homeLabel} title={homeLabel} onClick={() => api.current?.set(homeRef.current)}>
          Fit
        </button>
        <button
          className={`${btn} text-[11px]`}
          aria-label="Show the whole region"
          title="Show the whole region"
          onClick={() => api.current?.set(WIDE)}
        >
          All
        </button>
      </div>
    </div>
  );
}
