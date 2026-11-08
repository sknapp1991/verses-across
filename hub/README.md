# Verses Across team hub

A private, phone-first page for the two people who make Verses Across: <https://hub.versesacross.com>.
Report a bug or idea (with photos or a screen recording), follow its status and talk it through, approve
clips and website feedback, see the roadmap and what shipped.

- **Who gets in:** Cloudflare Access (Zero Trust, free) lets in only the two team emails (one-time code by
  email). The Worker also checks the Access token itself on every request.
- **Claude** gets in with its own Access service token, "Claude", whose secret is only on Skylar's PC. It
  can set statuses, notes and test links, reply as Claude, add clips for approval and "what shipped"
  lines. It can't approve, decide website feedback, vote, or act as a person.
- **Only the owner approves.** Every decision is logged with who and when.

## Files

- `src/index.ts`: the Worker (API, Access token check, uploads to R2, media with Range).
- `src/page.ts`: the page (one HTML file; everything typed is shown as text).
- `schema.sql`: the D1 tables. `test.mjs`: local end-to-end test. `cli.mjs`: Claude's command line.
- `wrangler.jsonc`: no secrets. Secrets: `TEAM_EMAILS`, `OWNER_EMAIL` (`npx wrangler secret put … --config hub/wrangler.jsonc`).

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

See the top of `test.mjs` (fake Access keys on :8799, `wrangler dev --local` with `.dev.vars`).
