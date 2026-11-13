/**
 * Interlinear (src/components/interlinear-panel.tsx): one JSON file per chapter + grammar + lexicon shards, built by
 * scripts/build-interlinear.mts and kept in the R2 bucket (binding AUDIO) under interlinear/ (~1,200 files).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

type R2Object = { httpEtag: string; body?: ReadableStream; size: number };
type R2BucketLike = { get(key: string, opts?: { onlyIf?: Headers }): Promise<R2Object | null> };

const KEY = /^(?:[a-z0-9]{3}\/\d{1,3}|lex\/[HG]\d|grammar)\.json$/;

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const key = path.join("/");
  if (!KEY.test(key)) return new Response("Not found", { status: 404 });
  let bucket: R2BucketLike | undefined;
  try {
    bucket = (getCloudflareContext().env as unknown as { AUDIO?: R2BucketLike }).AUDIO;
  } catch {
    bucket = undefined;
  }
  if (!bucket) return new Response("Not configured", { status: 404 });
  const obj = await bucket.get(`interlinear/${key}`, { onlyIf: request.headers });
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "content-type": "application/json",
    etag: obj.httpEtag,
    // Rarely rebuilt: a week in caches, then checked again.
    "cache-control": "public, max-age=604800",
  });
  if (!obj.body) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { status: 200, headers });
}
