# Verses Across roadmap

The world's scriptures side by side, in many languages. Free, no ads, no account. Live at https://versesacross.com.
This file is the source of truth; the roadmap page (linked from Desktop\Magnum Opus\Verses Across Files) shows the same.

Key facts: 111 versions of 78 works · 15 languages · 18 sections · about 27,600 chapters · open source (AGPL-3.0) ·
Cloudflare Workers + R2 · pushing to `main` deploys · every change reviewed by Fable before it ships.

## Now

| # | Item | Status | Notes |
|---|------|--------|-------|
| D | **Offline downloads** | building | Pick languages/versions (one or many) and save them on the device; optional read-along audio for them. Size shown before it starts; a Downloads list to see, update and delete what's saved. Works in the Android app too (same storage). Details below. |
| P | **Google Play** (Android app) | waiting on Skylar | Developer account ($25 + ID check), build the app file on pwabuilder.com, upload to a closed test. Then: assetlinks fingerprint → `data/android/app.json`, opt-in link → social session. Testers' Google Group is ready: versesacross-testers@googlegroups.com. 12 testers × 14 days before production. |

## Next

| # | Item | Status | Notes |
|---|------|--------|-------|
| S | **Stats dashboard** (aggregate only) | scoped | Details below. Needs Skylar to create one read-only Cloudflare API token. |
| I | **Instagram / shorts assets** | queued | "One word, five languages" clips (love, peace, light); 1080×1350 carousel slides (one language per slide); a 10-second "built this week" clip when offline downloads ship. `scripts/make-shorts.mjs`. Verse-of-the-day clips rendered through Nov 28; next batch before then. |
| B | Brother's next list | waiting | Whatever he sends next goes here first. |

## Later

| # | Item | Notes |
|---|------|-------|
| SEO | **Search: the next steps** | Most of the SEO work is already live (see History). Later: watch Search Console / Bing for indexing problems; landing pages per work and per tradition with their own titles and descriptions; `hreflang`-style alternates per language once indexing shows it would help; structured data for works (`Book`) beyond breadcrumbs. Low risk, no rush. |
| A | Read-along: locked-phone test | Skylar to try a real locked phone with recorded voices. |
| L | More of the library | Project Gutenberg / public-domain texts as they come up; AI translations only where no free English exists, always labelled. |

## Scope: offline downloads (D)

- **Where:** Settings → "Offline downloads" (and a link from My Study). Today's "Save for offline" (only the versions open now) becomes part of it.
- **Choose:** by language, then version (several at once), across every work (Bible, Quran, Pali Canon, …).
- **Size first:** a build step writes `public/offline/index.json` with the exact bytes of every version's files (and, from the audio index, every recording's files), so the app shows e.g. "KJV 5.4 MB · with audio 1.1 GB" before anything downloads, and checks the device's free space (`navigator.storage.estimate`).
- **Saving:** text into the service worker's cache (it already serves `/texts` from cache); asks the browser to keep the data (`storage.persist`). Resumable: a dropped connection continues where it stopped.
- **Audio:** recorded voices for the chosen version, chapter by chapter, into their own cache; the service worker answers the player's range requests from the cached file, so it plays offline (and with the screen locked in the app).
- **Manage:** a list of what's saved, with size and date; update (fetch only what changed) and delete (text, audio, or both).
- **Android:** the app is the website in a window, so it uses the same storage; nothing extra to build.
- **Privacy:** nothing new is sent anywhere; About stays accurate.
- **Review:** Fable reviews before it ships; test on a phone-sized screen, offline mode, and a full KJV + audio download.

## Scope: stats dashboard (S)

- **What it shows (aggregate only, no personal data, no cookies):** visits and chapter reads per day, top pages, top works and versions, languages being read, countries (as Cloudflare reports them), read-along plays; later Play installs.
- **How:** the site writes one anonymous data point per chapter view into Cloudflare Workers Analytics Engine (work, book, versions, language; no IP, no IDs). A local dark-mode dashboard (`npm run stats`, like the bots' dashboards on localhost) reads it with a read-only API token that Skylar creates and keeps on his PC. Desktop link in Magnum Opus.
- **Until then:** Cloudflare's own dashboard already shows requests, countries and top paths for the domain.
- **Privacy page:** updated before it ships ("we count page views in aggregate, with no personal data").

## Check-ins

- **Anytime:** "Verses Across: what shipped, what's blocked, anything post-worthy?" (HQ asks this at startup.)
- **When Play is ready:** "Here is my assetlinks.json / the app-signing SHA-256" → I add it and send the opt-in link to the social session.
- **Before Nov 28:** next batch of verse-of-the-day clips (the social session pings around Nov 25).

## History (done)

- **Nov 7:** Fable review of the day's work, 5 bugs fixed (sync links confirm first, durable delete, per-entry merge, device id, feedback privacy, group leave). French Strong's tags re-aligned (John 3:16 "aimé" lights up). Dark link-preview card. Google Search Console and Bing verified, sitemaps submitted. Testers' Google Group. Vertical shorts generator; 9 shorts + 21 verse-of-the-day clips.
- **Nov 6:** Progress, goals, 26 badges, encrypted sync codes, study groups. Feedback form with automatic details, crash report screen. About: AI translations and computer voices explained. SEO: chapter pages with their verses in the HTML, titles, descriptions, canonical links, breadcrumbs, per-book preview images, sitemap.xml (~27.6k chapters), robots.txt. Words mode (original Hebrew/Greek), reading levels, red letters, continuous scroll, cross references. Big library growth (Mencius and Popol Vuh AI translations, Kant, Plato, Avesta, Kojiki, Guru Granth Sahib, …). Brother's lists 1–3.
- **Nov 3–5:** Recorded read-along audio for every Bible version (28k files), Talmud, Mishnah, Hadith, Vedas, Upanishads, Ramayana, Mahabharata, Quran, Pali Canon, Tanakh; AI companion; reading plans; offline reading; rename to Verses Across.
