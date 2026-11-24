/**
 * The published articles opened most in the last 90 days, most first, for the bookcase's "Most read" shelf. Only the
 * order is public, never the numbers (Fable review: Skylar's OK was for a shelf, not for publishing traffic); an
 * article needs at least 3 opens to be listed, and only articles published now are. From the anonymous daily counts
 * of src/app/api/count (no person in them). Cached for an hour.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import articleIndex from "../../../../../public/articles/index.json";

type D1 = { prepare(q: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results: T[] }> } } };
const PUBLISHED = new Set((articleIndex as { slug: string; status: string }[]).filter((a) => a.status === "published").map((a) => a.slug));

export async function GET() {
  const headers = { "content-type": "application/json", "cache-control": "public, max-age=3600, s-maxage=3600" };
  let env: { STATS_DB?: D1 } = {};
  try {
    env = getCloudflareContext().env as unknown as typeof env;
  } catch {
    /* not on Cloudflare */
  }
  if (!env.STATS_DB) return new Response("[]", { headers });
  try {
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const { results } = await env.STATS_DB.prepare(
      "SELECT version AS slug, SUM(n) AS n FROM daily WHERE kind = 'article' AND day >= ? GROUP BY version HAVING SUM(n) >= 3 ORDER BY SUM(n) DESC LIMIT 20",
    )
      .bind(since)
      .all<{ slug: string; n: number }>();
    return new Response(JSON.stringify(results.map((r) => r.slug).filter((s) => PUBLISHED.has(s))), { headers });
  } catch {
    return new Response("[]", { headers });
  }
}
