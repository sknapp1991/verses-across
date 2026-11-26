# Verses Across team hub

A private, phone-first page for the people who make and test Verses Across (and Library Across): <https://hub.versesacross.com>.
Report a bug or idea (with photos or a screen recording), follow its status and talk it through, approve
clips and website feedback, see the roadmap and what shipped.

- **Who gets in:** Cloudflare Access (Zero Trust, free) lets in only the team's and testers' emails (one-time
  code by email). The Worker also checks the Access token itself on every request.
- **Claude** gets in with its own Access service token, "Claude", whose secret is only on Skylar's PC. It
  can set statuses, notes and test links, reply as Claude, add clips for approval and "what shipped"
  lines. It can't approve, decide website feedback, vote, or act as a person.
- **Skylar and his brother approve, with equal say** (Skylar, Nov 25). Every decision is logged with who and when.

## Who decides what (Nov 25)

| What | Who says yes | Notes |
|---|---|---|
| Bug fixes and ideas on a team member's ticket | Pre-approved | Claude builds them, reviewer agent first. |
| A tester's ticket (Pending) | Skylar or his brother | Nothing Pending is built. |
| Publishing (articles, new texts, content notes), downloads, clips, website feedback Go / No, roadmap calls | Skylar or his brother | Either one's yes is enough; Claude asks on the hub (`ask`). |
| Heavy jobs on Skylar's PC (rendering, big imports) | Check with the other Claude sessions first | HOUSE-RULES and heavy-jobs.md. |
| Badges (Steward, Moderator, Partner, Tester): giving and revoking | Skylar or his brother | Badges tab; only people on TEAM_EMAILS. Never Claude (refused whichever way it signs in) or a tester. My brother's own mark is Steward. |
| Money, passwords, keys, accounts | A person does it themselves | Claude never types or spends these. |

## Statuses

Open: **New**, **Seen**, **Working**, **Question** (Claude asked), **Reopened**. **Pending**: a tester's ticket
waiting for an OK. Finished: **Live** (shipped, waiting for the reporter to check), **Done** (shown as Resolved:
"Fixed, closed", or closed automatically after 3 quiet days Live), **Roadmap** (later).

**How soon:** Urgent = the site is broken or something is lost, looked at within the hour (6 AM to 6 PM ET);
Normal = the same day; Someday = for later, may go on the roadmap.

## Definition of done (before Claude sets Live)

1. The reviewer agent passed it.
2. It is live: `node scripts/wait-live.mjs <commit>` says LIVE (the site's /api/version includes the commit).
3. Checked at phone width, and for old Safari (15.6): no newer web feature without a fallback.
4. A Live note with **What:** changed, **Try it:** (2-3 steps), **Untested:** what wasn't checked, and the test
   link (the hub refuses Live without them; a Question needs no link).

A reopen adds a "Recheck #…" test to Test & chat, so the edge case is tried again. On Sundays the hub posts a
weekly summary in the team chat (shipped, waiting on you, reopens, time to Live; `node hub/cli.mjs digest`).
Website feedback marked Go becomes a ticket, linked by its feedback number. Each ticket records the browser it
was sent from.

## Testers (Test & chat, Nov 23)

A tester (someone outside the team) sees only Report, their own tickets and **Test & chat**: tests to try with
Works / Doesn't work, and the team chat. What a tester sends waits as **Pending** until Skylar or his brother
approves it; Claude builds nothing Pending (the watch marks tester lines "not approved, don't build"). Testers
see the team as "Team", never their emails. To add one (Skylar does both):

1. Zero Trust → Access → Applications → the hub → its Allow policy: add the tester's email.
2. `npx wrangler secret put TESTER_EMAILS --config hub/wrangler.jsonc` (every tester's email, comma-separated).

They sign in at https://hub.versesacross.com with their email and the one-time code it sends. Remove a tester
the same two ways.

## Badges (Nov 26)

Skylar and his brother (the team emails; never Claude or a tester) can give a person a badge from the **Badges** tab:
pick the badge, type the name to show on it, an optional note, then **Give badge**. The hub signs it (ECDSA P-256,
SHA-256) with the secret `BADGE_SIGNING_KEY` and shows a link once, `https://versesacross.com/badge#<token>.<holder key>`,
to send only to that person. The holder key is a fresh key pair made for that one badge (its public half is signed into
the token); it lets the person prove in a study group that the badge is theirs, so a badge copied from someone's card
shows for nobody else. The hub never stores or logs the link, the token or the holder key. Notes are kept in the
hub's log, which the team and Claude can read. The person opens it, the site checks the signature with the public key in `src/lib/issued-badges.ts`,
and "Keep this badge" saves it on their device; it then shows next to their name in study groups. The hub keeps who
gave which badge to whom (never the link). **Revoke** puts the badge's id on the site's list (`badge_revoked` in the
site's database, read by `/api/badges/revoked`), and the site stops showing it, though it can take up to about 10 to 15 minutes to reach everyone (the list is cached
by the site and by each browser for a few minutes each).

One-time setup (Skylar, on the PC; Claude never makes or sees the real key):

1. Make the key pair (PowerShell, in the repo folder):
   `node -e "const c=require('crypto'),fs=require('fs'),p=require('path');const k=c.generateKeyPairSync('ec',{namedCurve:'P-256'});const d=p.join(require('os').homedir(),'.va-hub');fs.mkdirSync(d,{recursive:true});fs.writeFileSync(p.join(d,'badge-private.json'),JSON.stringify(k.privateKey.export({format:'jwk'})));console.log(JSON.stringify(k.publicKey.export({format:'jwk'})))"`
   It prints the PUBLIC key and saves the private one in `%USERPROFILE%\.va-hub\badge-private.json`.
2. Put the private key on the hub: `Get-Content $HOME\.va-hub\badge-private.json | npx wrangler secret put BADGE_SIGNING_KEY --config hub/wrangler.jsonc`
3. Paste the printed public key into `BADGE_PUBLIC_KEY` in `src/lib/issued-badges.ts` (it has only kty, crv, x, y;
   never a "d"), commit and push. Keep `badge-private.json` somewhere safe offline, or delete it (a lost key only means
   making a new pair: every badge given so far then stops showing and is given again).

## Files

- `src/index.ts`: the Worker (API, Access token check, uploads to R2, media with Range).
- `src/page.ts`: the page (one HTML file; everything typed is shown as text).
- `schema.sql`: the D1 tables. `test.mjs`: local end-to-end test. `cli.mjs`: Claude's command line.
- `test-site-verify.mts`: run by `test.mjs`, checks the hub's badge links with the site's own verifier.
- `wrangler.jsonc`: no secrets. Secrets: `TEAM_EMAILS`, `OWNER_EMAIL`, `TESTER_EMAILS`, `BADGE_SIGNING_KEY` (`npx wrangler secret put … --config hub/wrangler.jsonc`).

Deploys on push to `main` when something in `hub/` changes (Workers Builds project "va-hub").

## Claude's token (one-time setup, by Skylar)

1. Zero Trust → Access controls → Service credentials → Create service token, name **Claude**, duration
   1 year. Copy the Client ID and Client Secret (the secret is shown once).
2. On the PC, in Notepad, save the Client ID as `%USERPROFILE%\.va-hub\claude-id.txt` and the Client Secret
   as `%USERPROFILE%\.va-hub\claude-secret.txt` (one line each, nothing else).
3. Tell Claude the token exists. Claude adds a **Service Auth** rule for it on the hub's Access app and
   puts the Client ID (not the secret; it ends in `.access`) in `CLAUDE_TOKEN_ID` in `wrangler.jsonc`.

Revoke it any time in Service credentials; the hub then refuses Claude.

## Local test

See the top of `test.mjs` (fake Access keys on :8799, `wrangler dev --local` with `.dev.vars`, and a throwaway badge
key that `node test.mjs serve` writes to `.test-badge.env`).
