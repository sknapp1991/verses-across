/**
 * Withdrawn badges (src/lib/issued-badges.ts): the ids the team hub has revoked, from the table badge_revoked in the
 * site's D1 database (binding STATS_DB; the hub writes it as SITE_DB and makes the table the first time it revokes).
 * Public and holds nothing but random ids; cached for a few minutes. A database error is a 503 (never an empty list),
 * so browsers keep the list they saw last.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1 = { prepare(q: string): { all<T>(): Promise<{ results: T[] }> } };

export const dynamic = "force-dynamic";

let memo: { at: number; ids: string[] } | null = null;

export async function GET() {
  if (!memo || Date.now() - memo.at > 60_000) {
    let env: { STATS_DB?: D1 } = {};
    try {
      env = getCloudflareContext().env as unknown as typeof env;
    } catch {
      /* not on Cloudflare */
    }
    let ids: string[] = [];
    if (!env.STATS_DB) return Response.json({ error: "No database here" }, { status: 503, headers: { "cache-control": "no-store" } });
    try {
      const { results } = await env.STATS_DB.prepare("SELECT id FROM badge_revoked ORDER BY at DESC LIMIT 5000").all<{ id: string }>();
      ids = results.map((r) => r.id).filter((x) => /^[0-9a-f]{16}$/.test(x));
    } catch (e) {
      // no table yet: nothing has been revoked. Any other error: say so (browsers keep the last list they saw)
      if (!/no such table/i.test(String((e as Error)?.message ?? e))) return Response.json({ error: "Couldn't read the list" }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    memo = { at: Date.now(), ids };
  }
  return Response.json({ ids: memo.ids }, { headers: { "cache-control": "public, max-age=300" } });
}
