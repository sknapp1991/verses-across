/**
 * The private stats feed for Skylar's hub (../bots-hub, a "Verses Across" tab): anonymous daily totals
 * from the STATS_DB database, never anything about a person. The key goes in `Authorization: Bearer <key>`
 * (Cloudflare redacts that header in logs). totals, daily and by_work count events
 * (a chapter read counts once however many versions are open); by_version and by_lang count how often
 * each version or language was among those open. GET only, rate limited, and it needs the
 * key (the STATS_KEY secret: `npx wrangler secret put STATS_KEY`); without it
 * the answer is 401. ?days=1..365 (default 30).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { catalog } from "@/lib/catalog";

type D1 = { prepare(q: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results: T[] }> } } };
type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };
type Row = { day: string; kind: "view" | "play" | "download"; work: string; version: string; lang: string; n: number };
type Counts = { view: number; play: number; download: number };

const zero = (): Counts => ({ view: 0, play: 0, download: 0 });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** Compare without leaking how much of the key matched. */
async function sameKey(a: string, b: string) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

const langName = (code: string) => {
  if (code === "pi") return "Pāli";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
};

export async function GET(request: Request) {
  let env: { STATS_DB?: D1; STATS_LIMIT?: Limiter; STATS_KEY?: string } = {};
  try {
    env = getCloudflareContext().env as unknown as typeof env;
  } catch {
    /* not on Cloudflare */
  }
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  if (env.STATS_LIMIT && !(await env.STATS_LIMIT.limit({ key: `stats:${ip}` }).catch(() => ({ success: true }))).success)
    return json({ error: "Too many requests" }, 429);
  const key = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!env.STATS_KEY || !key || !(await sameKey(key, env.STATS_KEY))) return json({ error: "Unauthorized" }, 401);
  if (!env.STATS_DB) return json({ error: "Stats storage isn’t set up" }, 503);

  const days = Math.min(365, Math.max(1, Math.floor(Number(new URL(request.url).searchParams.get("days"))) || 30));
  const to = new Date();
  const from = new Date(Date.now() - (days - 1) * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const { results } = await env.STATS_DB.prepare("SELECT day, kind, work, version, lang, n FROM daily WHERE day >= ? ORDER BY day").bind(iso(from)).all<Row>();

  const totals = zero();
  const daily = new Map<string, Counts>();
  for (let i = 0; i < days; i++) daily.set(iso(new Date(from.getTime() + i * 86_400_000)), zero());
  const byWork = new Map<string, Counts>();
  const byVersion = new Map<string, Counts & { work: string; version: string; lang: string }>();
  const byLang = new Map<string, Counts>();
  for (const r of results) {
    if (!(r.kind in totals)) continue;
    // "*" rows are the events themselves (a chapter read, a play, a download): totals, days and works.
    if (r.version === "*") {
      totals[r.kind] += r.n;
      const d = daily.get(r.day);
      if (d) d[r.kind] += r.n;
      const w = byWork.get(r.work) ?? zero();
      w[r.kind] += r.n;
      byWork.set(r.work, w);
      continue;
    }
    // Per-version rows: how often each version (and language) was among the ones open.
    const vk = `${r.work}/${r.version}`;
    const v = byVersion.get(vk) ?? { ...zero(), work: r.work, version: r.version, lang: r.lang };
    v[r.kind] += r.n;
    byVersion.set(vk, v);
    const l = byLang.get(r.lang) ?? zero();
    l[r.kind] += r.n;
    byLang.set(r.lang, l);
  }
  const byViews = <T extends Counts>(a: T, b: T) => b.view - a.view || b.play - a.play || b.download - a.download;

  return json({
    generated_at: new Date().toISOString(),
    days,
    from: iso(from),
    to: iso(to),
    totals,
    daily: [...daily.entries()].map(([day, c]) => ({ day, ...c })),
    by_work: [...byWork.entries()].map(([work, c]) => ({ work, name: catalog.works.find((w) => w.id === work)?.name ?? work, ...c })).sort(byViews),
    by_version: [...byVersion.values()]
      .map((v) => {
        const meta = catalog.versions.find((x) => x.work === v.work && x.id === v.version);
        return { work: v.work, version: v.version, abbr: meta?.abbr ?? v.version, name: meta?.name ?? v.version, lang: v.lang, view: v.view, play: v.play, download: v.download };
      })
      .sort(byViews),
    by_lang: [...byLang.entries()].map(([lang, c]) => ({ lang, name: langName(lang), ...c })).sort(byViews),
  });
}
