// Part of the hub's local test (test.mjs runs it with tsx): checks a badge link the local hub issued with the SITE's own
// verifier code (src/lib/issued-badges.ts), so issuing and verifying can't drift apart. Input: a JSON file with
// { pub, link, gid, mid, other } (the throwaway test key's public half, never the real one). Prints a JSON result.
import { readFileSync } from "node:fs";
import { makeProof, parseToken, verifyProof, verifyWith } from "../src/lib/issued-badges";

const { pub, link, gid, mid, other } = JSON.parse(readFileSync(process.argv[2], "utf8")) as { pub: JsonWebKey; link: string; gid: string; mid: string; other: string };
const frag = link.slice(link.indexOf("#") + 1);
const [data, sig, holder] = frag.split(".");
const token = `${data}.${sig}`;
const b = await verifyWith(token, pub);
const proof = await makeProof(holder, gid, mid);
const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(data, "base64url").toString("utf8")), n: "Mallory" })).toString("base64url");
const v1 = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(data, "base64url").toString("utf8")), v: 1 })).toString("base64url");
const out = {
  verifies: !!b && b.n.length > 0,
  name: b?.n ?? null,
  known: b?.known ?? null,
  proofOk: !!b && !!proof && (await verifyProof(b.h, gid, mid, proof)),
  proofOtherMember: !!b && !!proof && (await verifyProof(b.h, gid, other, proof)),
  proofOtherGroup: !!b && !!proof && (await verifyProof(b.h, "f".repeat(64), mid, proof)),
  forgedName: !!(await verifyWith(`${forged}.${sig}`, pub)),
  v1Refused: parseToken(`${v1}.${sig}`) === null,
  truncated: !!(await verifyWith(token.slice(0, -5), pub)) || parseToken(token.slice(0, 30)) !== null,
};
console.log(JSON.stringify(out));
