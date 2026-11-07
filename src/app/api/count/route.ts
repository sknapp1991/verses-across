/**
 * Anonymous counts: one chapter view, read-along play or offline download, added to that day's total
 * for the work and version (D1 database versesacross-stats, binding STATS_DB; table in
 * data/stats/schema.sql). Nothing about the visitor is stored: no IP, no ID, no time of day. The IP is
 * used only for the rate limit and never stored. Only the site's own pages can send counts (a naive
 * script is refused; counts are approximate by nature). Sent by src/lib/count.ts.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { catalog } from "@/lib/catalog";

type D1 = { prepare(q: string): { bind(...v: unknown[]): unknown }; batch(s: unknown[]): Promise<unknown> };
type Limiter = { limit(o: { key: string }): Promise<{ success: boolean }> };

const KINDS = new Set(["view", "play", "download"]);

export async function POST(request: Request) {
  let env: { STATS_DB?: D1; STATS_LIMIT?: Limiter } = {};
  try {
    env = getCloudflareContext().env as unknown as typeof env;
  } catch {
    /* not on Cloudflare */
  }
  if (!env.STATS_DB) return new Response(null, { status: 204 });
  // From the site's own pages only (browsers set this header; a plain script usually doesn't).
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return new Response(null, { status: 403 });
  if (!site && request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  if (env.STATS_LIMIT && !(await env.STATS_LIMIT.limit({ key: ip }).catch(() => ({ success: true }))).success) return new Response(null, { status: 429 });

  const raw = await request.text();
  if (raw.length > 1000) return new Response(null, { status: 413 });
  let body: { kind?: unknown; work?: unknown; versions?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : null;
  const work = typeof body.work === "string" ? body.work : "";
  const ids = Array.isArray(body.versions) ? [...new Set(body.versions.filter((v): v is string => typeof v === "string"))].slice(0, 6) : []; // the reader shows at most 6 versions
  // Only real works and versions from the catalog are counted.
  const versions = catalog.versions.filter((v) => v.work === work && ids.includes(v.id));
  if (!kind || !versions.length) return new Response(null, { status: 400 });

  const day = new Date().toISOString().slice(0, 10);
  const db = env.STATS_DB;
  const upsert = (version: string, lang: string) =>
    db.prepare("INSERT INTO daily (day, kind, work, version, lang, n) VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT (day, kind, work, version) DO UPDATE SET n = n + 1").bind(day, kind, work, version, lang);
  // One row per version (for the breakdown) plus one "*" row: the event itself, however many versions were open.
  await db.batch([upsert("*", "*"), ...versions.map((v) => upsert(v.id, v.language))]);
  return new Response(null, { status: 204 });
}
