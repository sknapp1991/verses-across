/**
 * A study group's roles (my brother's ticket a92da77c, Nov 24): who is the owner and who are moderators, by member id
 * (the SHA-256 of a secret only that member's device holds; never a name or anything readable). Only the owner and
 * moderators may change the group's details (its readings and focus: PUT /api/group/<gid> checks this list).
 *
 *   POST { action, target? } with x-member-key (the caller's secret):
 *     claim      a group with no owner yet (made before roles): the first member to claim it becomes the owner
 *     mod/unmod  the owner makes a member a moderator, or not
 *     owner      the owner hands the group to another member (and becomes a moderator)
 *     takeover   the owner has been away 30 days: the longest-serving active moderator becomes the owner; with no
 *                active moderator, the longest-standing active member may (the old owner stays, as a moderator)
 *
 * Stored in the clear at group/<gid>/roles: { owner, mods: { id: since }, joined: { id: first seen }, at }.
 * "Active" is a member's card written within 30 days (every member's app rewrites its card when it opens the group).
 */
import { HEX64, json, sha256hex, syncBucket, type Bucket } from "@/lib/sync-server";
import { readRoles, type Roles } from "@/lib/group-roles-server";

type Ctx = { params: Promise<{ gid: string }> };
const AWAY = 30 * 86_400_000;

/** Members (id → when their card was last written). */
async function members(bucket: Bucket, gid: string) {
  const { objects } = await bucket.list({ prefix: `group/${gid}/`, limit: 60 });
  const m = new Map<string, number>();
  for (const o of objects) {
    const id = o.key.slice(`group/${gid}/`.length);
    if (HEX64.test(id)) m.set(id, o.uploaded.getTime());
  }
  return m;
}

// (the same 30 days and next-in-line rule as myRole() in src/lib/groups.ts, which shows the Take over button)
export async function POST(request: Request, ctx: Ctx) {
  const { gid } = await ctx.params;
  if (!HEX64.test(gid)) return json({ error: "Not found" }, 404);
  const key = request.headers.get("x-member-key") ?? "";
  if (key.length < 32) return json({ error: "Not allowed" }, 403);
  const bucket = await syncBucket(request);
  if (bucket instanceof Response) return bucket;
  const me = await sha256hex(key);
  const b = ((await request.json().catch(() => null)) ?? {}) as { action?: string; target?: string };
  const all = await members(bucket, gid);
  if (!all.has(me)) return json({ error: "You're not in this group." }, 403);
  const now = Date.now();
  const active = (id: string) => (all.get(id) ?? 0) > now - AWAY;
  const cur = await readRoles(bucket, gid);
  const write = async (roles: Roles) => {
    const data = new TextEncoder().encode(JSON.stringify({ ...roles, at: now })).buffer as ArrayBuffer;
    const r = cur ? await bucket.put(`group/${gid}/roles`, data, { onlyIf: { etagMatches: cur.etag.replace(/^W\//, "").replace(/"/g, "") } }) : await bucket.put(`group/${gid}/roles`, data);
    return r ? json({ ok: true, roles: { ...roles, at: now } }) : json({ error: "Someone changed the group's roles first. Try again." }, 412);
  };

  if (b.action === "claim") {
    if (cur) return json({ error: "This group already has an owner." }, 409);
    const res = await write({ owner: me, mods: {}, joined: Object.fromEntries([...all.keys()].map((id) => [id, now])), at: now });
    // two claims at once: both wrote; only the one whose write stands is the owner
    const after = await readRoles(bucket, gid);
    if (after?.roles.owner !== me) return json({ error: "Someone else became the owner just now." }, 409);
    return res;
  }
  if (!cur) return json({ error: "This group has no owner yet." }, 409);
  const roles = cur.roles;
  const target = typeof b.target === "string" ? b.target : "";
  if (b.action === "mod" || b.action === "unmod" || b.action === "owner") {
    if (roles.owner !== me) return json({ error: "Only the group's owner can do that." }, 403);
    if (!all.has(target) || target === me) return json({ error: "Pick someone in the group." }, 400);
    const mods = { ...roles.mods };
    if (b.action === "mod") mods[target] = mods[target] ?? now;
    if (b.action === "unmod") delete mods[target];
    if (b.action === "owner") {
      delete mods[target];
      mods[me] = now; // the old owner stays, as a moderator
      return write({ ...roles, owner: target, mods });
    }
    return write({ ...roles, mods });
  }
  if (b.action === "takeover") {
    if (roles.owner === me) return json({ error: "You're already the owner." }, 400);
    if (active(roles.owner)) return json({ error: "The owner has been here in the last 30 days." }, 403);
    // the longest-serving moderator who is still active; else the longest-standing active member
    const activeMods = Object.entries(roles.mods).filter(([id]) => all.has(id) && active(id)).sort((x, y) => x[1] - y[1]);
    const activeMembers = [...all.keys()].filter((id) => active(id) && id !== roles.owner).sort((x, y) => (roles.joined[x] ?? now) - (roles.joined[y] ?? now));
    const next = activeMods.length ? activeMods[0][0] : activeMembers[0];
    if (next !== me) return json({ error: "Someone else is next in line to take over." }, 403);
    // the old owner stays on as a moderator, if they're still in the group
    const nextMods = { ...roles.mods, ...(all.has(roles.owner) ? { [roles.owner]: now } : {}) };
    delete nextMods[me];
    return write({ ...roles, owner: me, mods: nextMods });
  }
  return json({ error: "Unknown action" }, 400);
}
