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
| I | **Instagram / shorts assets** | queued | "One word, five languages" clips (love, peace, light); 1080×1350 carousel slides (one language per slide); a 10-second "built this week" clip when offline downloads ship. `scripts/make-shorts.mjs`. Verse-of-the-day clips rendered through Nov 28; next batch before then. |
| B | Brother's next list | waiting | Whatever he sends next goes here first. |

## Later

| # | Item | Notes |
|---|------|-------|
| SEO | **Search: the next steps** | Most of the SEO work is already live (see History). Later: watch Search Console / Bing for indexing problems; landing pages per work and per tradition with their own titles and descriptions; `hreflang`-style alternates per language once indexing shows it would help; structured data for works (`Book`) beyond breadcrumbs. Low risk, no rush. |
| A | Read-along: locked-phone test | Skylar to try a real locked phone with recorded voices. |
| L | More of the library | Project Gutenberg / public-domain texts as they come up; AI translations only where no free English exists, always labelled. |

## Check-ins

- **Anytime:** "Verses Across: what shipped, what's blocked, anything post-worthy?" (HQ asks this at startup.)
- **When Play is ready:** "Here is my assetlinks.json / the app-signing SHA-256" → I add it and send the opt-in link to the social session.
- **Before Nov 28:** next batch of verse-of-the-day clips (the social session pings around Nov 25).

## History (done)

- **Nov 7 (evening):** Guided tour (7 cards, opens once for first-time visitors only, skip / don't show again, replay from settings and sidebar, keyboard and screen-reader friendly). Anonymous stats (daily totals only, no IP/ID/cookie) shown in the "Verses Across" tab of Skylar's private Tailscale hub, next to this roadmap. Both Fable-reviewed.
- **Nov 7 (afternoon):** Offline downloads: any language/version, exact sizes first, read-along audio per book, resumable, update/delete, works offline for never-opened chapters; two Fable reviews. Roadmap page.
- **Nov 7:** Fable review of the day's work, 5 bugs fixed (sync links confirm first, durable delete, per-entry merge, device id, feedback privacy, group leave). French Strong's tags re-aligned (John 3:16 "aimé" lights up). Dark link-preview card. Google Search Console and Bing verified, sitemaps submitted. Testers' Google Group. Vertical shorts generator; 9 shorts + 21 verse-of-the-day clips.
- **Nov 6:** Progress, goals, 26 badges, encrypted sync codes, study groups. Feedback form with automatic details, crash report screen. About: AI translations and computer voices explained. SEO: chapter pages with their verses in the HTML, titles, descriptions, canonical links, breadcrumbs, per-book preview images, sitemap.xml (~27.6k chapters), robots.txt. Words mode (original Hebrew/Greek), reading levels, red letters, continuous scroll, cross references. Big library growth (Mencius and Popol Vuh AI translations, Kant, Plato, Avesta, Kojiki, Guru Granth Sahib, …). Brother's lists 1–3.
- **Nov 3–5:** Recorded read-along audio for every Bible version (28k files), Talmud, Mishnah, Hadith, Vedas, Upanishads, Ramayana, Mahabharata, Quran, Pali Canon, Tanakh; AI companion; reading plans; offline reading; rename to Verses Across.
