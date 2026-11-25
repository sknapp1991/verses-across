/**
 * Which commit this deploy was built from (the first 9 characters; "local" outside Workers Builds). Claude's
 * deploy check (scripts/wait-live.mjs) reads it to know a change is live, instead of waiting on one commit's build
 * (when commits land minutes apart, Workers Builds may skip the older ones). Nothing else is in it.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD ?? "local" }, { headers: { "cache-control": "no-store" } });
}
