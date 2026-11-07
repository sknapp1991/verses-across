# Verses Across roadmap

The world's scriptures side by side, in many languages. Free, no ads, no account. Live at https://versesacross.com.
This file is the source of truth; the roadmap page https://claude.ai/artifact/G3QttiDxEaYA9aL61z5nPJ (shortcut: Desktop\Magnum Opus\Verses Across Files\Verses Across Roadmap) shows the same.

Key facts: 111 versions of 78 works · 15 languages · 18 sections · about 27,600 chapters · open source (AGPL-3.0) ·
Cloudflare Workers + R2 · pushing to `main` deploys · every change reviewed by Fable before it ships.

## Now

| # | Item | Status | Notes |
|---|------|--------|-------|
| P | **Google Play** (Android app) | waiting on Skylar | Developer account ($25 + ID check), build the app file on pwabuilder.com, upload to a closed test. Then: assetlinks fingerprint → `data/android/app.json`, opt-in link → social session. Testers' Google Group is ready: versesacross-testers@googlegroups.com. 12 testers × 14 days before production. |

## Next

| # | Item | Status | Notes |
|---|------|--------|-------|
| S | **Stats tab in the private hub** (aggregate only) | next | The site keeps its own anonymous daily counts; a "Verses Across" tab in Skylar's Tailscale hub (bots-hub, owned by poly-paper) shows them, plus this roadmap rendered from ROADMAP.md. No Cloudflare token or analytics. Details below. |
| T | **Guided tour** (optional) | scoped | Short coach marks or swipeable cards: read-along, favorites, Ask AI, word tap, sync, streaks, offline downloads. Skip, "don't show again", replay from Settings/Help; keyboard and screen-reader friendly, respects reduced motion; never nags returning users. After offline downloads, so it can include them. |
| I | **Instagram / shorts assets** | queued | "One word, five languages" clips (love, peace, light); 1080×1350 carousel slides (one language per slide); a 10-second "built this week" clip when offline downloads ship. `scripts/make-shorts.mjs`. Verse-of-the-day clips rendered through Nov 28; next batch before then. |
| B | Brother's next list | waiting | Whatever he sends next goes here first. |

## Later

| # | Item | Notes |
|---|------|-------|
| SEO | **Search: the next steps** | Most of the SEO work is already live (see History). Later: watch Search Console / Bing for indexing problems; landing pages per work and per tradition with their own titles and descriptions; `hreflang`-style alternates per language once indexing shows it would help; structured data for works (`Book`) beyond breadcrumbs. Low risk, no rush. |
| A | Read-along: locked-phone test | Skylar to try a real locked phone with recorded voices. |
| L | More of the library | Project Gutenberg / public-domain texts as they come up; AI translations only where no free English exists, always labelled. |

## Scope: stats tab (S)

- **Counting (on the site):** one anonymous count per chapter view, read-along play and offline download, kept as daily totals per work, version and language in a small database (Cloudflare D1). No IPs, no IDs, no cookies, nothing per person.
- **Reading the totals:** one read-only JSON endpoint, guarded by a key kept only in a gitignored file on Skylar's PC.
- **Showing them:** a "Verses Across" tab in the private Tailscale hub (`bots-hub`, owned by poly-paper), dark like the bot dashboards: visits per day, top works, versions and languages, plays, downloads; and the roadmap rendered from this file. No trading-bot code is touched (stock-paper's advice).
- **Privacy page:** updated in the same release as the counting.

## Check-ins

- **Anytime:** "Verses Across: what shipped, what's blocked, anything post-worthy?" (HQ asks this at startup.)
- **When Play is ready:** "Here is my assetlinks.json / the app-signing SHA-256" → I add it and send the opt-in link to the social session.
- **Before Nov 28:** next batch of verse-of-the-day clips (the social session pings around Nov 25).

## History (done)

- **Nov 7 (afternoon):** Offline downloads: any language/version, exact sizes first, read-along audio per book, resumable, update/delete, works offline for never-opened chapters; two Fable reviews. Roadmap page.
- **Nov 7:** Fable review of the day's work, 5 bugs fixed (sync links confirm first, durable delete, per-entry merge, device id, feedback privacy, group leave). French Strong's tags re-aligned (John 3:16 "aimé" lights up). Dark link-preview card. Google Search Console and Bing verified, sitemaps submitted. Testers' Google Group. Vertical shorts generator; 9 shorts + 21 verse-of-the-day clips.
- **Nov 6:** Progress, goals, 26 badges, encrypted sync codes, study groups. Feedback form with automatic details, crash report screen. About: AI translations and computer voices explained. SEO: chapter pages with their verses in the HTML, titles, descriptions, canonical links, breadcrumbs, per-book preview images, sitemap.xml (~27.6k chapters), robots.txt. Words mode (original Hebrew/Greek), reading levels, red letters, continuous scroll, cross references. Big library growth (Mencius and Popol Vuh AI translations, Kant, Plato, Avesta, Kojiki, Guru Granth Sahib, …). Brother's lists 1–3.
- **Nov 3–5:** Recorded read-along audio for every Bible version (28k files), Talmud, Mishnah, Hadith, Vedas, Upanishads, Ramayana, Mahabharata, Quran, Pali Canon, Tanakh; AI companion; reading plans; offline reading; rename to Verses Across.
