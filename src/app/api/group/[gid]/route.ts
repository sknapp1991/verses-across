/**
 * Study groups: GET returns every member's encrypted card, the group's encrypted details ("meta") and its roles (who
 * is the owner and who are moderators, by member id: ./roles/route.ts). PUT replaces the details: once a group has
 * an owner, only the owner and moderators may (x-member-key), e.g. to add a book or set the focus (hub a92da77c);
 * a group made before roles stays open to every member until someone claims it.
 */
import { body, conditionalPut, HEX64, json, sha256hex, syncBucket, toBase64 } from "@/lib/sync-server";
import { readRoles } from "@/lib/group-roles-server";

type Ctx = { params: Promise<{ gid: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { gid } = await ctx.params;
  if (!HEX64.test(gid)) return json({ error: "Not found" }, 404);
  const bucket = await syncBucket(request);
  if (bucket instanceof Response) return bucket;
  const { objects } = await bucket.list({ prefix: `group/${gid}/`, limit: 60 });
  const docs = await Promise.all(
    objects
      .filter((o) => !o.key.endsWith("/roles"))
      .map(async (o) => {
        const obj = await bucket.get(o.key);
        return obj ? { id: o.key.slice(`group/${gid}/`.length), etag: obj.httpEtag, at: obj.uploaded.toISOString(), data: toBase64(await obj.arrayBuffer()) } : null;
      }),
  );
  const list = docs.filter((d) => !!d);
  if (!list.length) return json({ error: "No such group" }, 404);
  const roles = await readRoles(bucket, gid);
  return json({ meta: list.find((d) => d.id === "meta") ?? null, members: list.filter((d) => d.id !== "meta"), roles: roles?.roles ?? null });
}

export async function PUT(request: Request, ctx: Ctx) {
  const { gid } = await ctx.params;
  if (!HEX64.test(gid)) return json({ error: "Not found" }, 404);
  const bucket = await syncBucket(request);
  if (bucket instanceof Response) return bucket;
  const roles = await readRoles(bucket, gid);
  if (roles) {
    const key = request.headers.get("x-member-key") ?? "";
    const me = key.length >= 32 ? await sha256hex(key) : "";
    if (!me || (me !== roles.roles.owner && !(me in roles.roles.mods))) return json({ error: "Only the group's owner and moderators can change its readings." }, 403);
  }
  const data = await body(request, 16 * 1024);
  if (data instanceof Response) return data;
  return conditionalPut(bucket, `group/${gid}/meta`, data, request);
}
