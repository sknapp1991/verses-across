/**
 * A study group's roles, read by the group routes (src/app/api/group/[gid]/roles/route.ts explains them).
 */
import { HEX64, type Bucket } from "./sync-server";

export type Roles = { owner: string; mods: Record<string, number>; joined: Record<string, number>; at: number };

export async function readRoles(bucket: Bucket, gid: string): Promise<{ roles: Roles; etag: string } | null> {
  const obj = await bucket.get(`group/${gid}/roles`);
  if (!obj) return null;
  try {
    const r = JSON.parse(new TextDecoder().decode(await obj.arrayBuffer())) as Roles;
    if (!HEX64.test(r.owner)) return null;
    return { roles: { owner: r.owner, mods: r.mods ?? {}, joined: r.joined ?? {}, at: r.at ?? 0 }, etag: obj.httpEtag };
  } catch {
    return null;
  }
}

