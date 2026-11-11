# Library Across roadmap

Classic books free: fiction, poetry, drama, children's books, Freethought and Psychology. Free, no ads, no account. Live at https://libraryacross.com (since Nov 10, 2026).
The sister site of Verses Across (the world's scriptures), built from the same code (`src/lib/site.ts`, `NEXT_PUBLIC_SITE=library`); a push to `main` deploys both. Verses Across's roadmap is `ROADMAP.md`. This file is shown on the hub's Roadmap tab (Library Across).

Key facts: about 1,076 public-domain books (Project Gutenberg editions) · 44 themes · read-aloud, word help, notes and highlights, search across every book, offline downloads · Google Search Console set up (Nov 10).

Skylar's goal: as many public-domain books as possible, with the same reader features as Verses Across.

## Now

| # | Item | Status | Notes |
|---|------|--------|-------|
| LG | **Grow the library** (Skylar, Nov 10) | next | As many public-domain books as possible: the rest of Project Gutenberg's most-read books first, then whole collections (LD4), Standard Ebooks texts where they exist (LT1). Each import keeps the per-site file count in mind (the Worker's static-file limit); a large catalog may move the texts to R2. |
| LAPP | **Library Across on Google Play** | later | After the Verses Across app is through its 14-day test: the same steps for libraryacross.com (its own package, icons are ready). |

## Next

| # | Item | Status | Notes |
|---|------|--------|-------|
| LIT | **Literature & Fiction refinement** | in progress | Shelves are live (1,032 Gutenberg books) but not announced yet. Before the go-note to the social session: chapter/title cleanup, search inside a book, cross references rebuilt, full Fable review + fixes. Then one note for shelves and search together. |
| LP | **Reading and study plans for literature** | idea (Skylar, Nov 8) | Suggested plans like the scripture reading plans: e.g. a classic novel in 30 days, a month of short stories, "Great Gothic novels", "Founding documents" (Federalist, Common Sense, Democracy in America), "Scripture and its echoes" (Paradise Lost, Dante, Pilgrim's Progress with their related scripture passages). Fits the existing Plans & Goals panel. |
| LQ | **"Check your understanding" questions** | idea (Skylar, Nov 8), goes with LP | After each plan day / chapter, 3–5 questions to think about what was read: what happened (recall), why a character chose something (understanding), themes and symbols (e.g. the white whale, the green light), links to other books and to the related scripture passages, and "what would you do?" reflection. Written once per book by AI and checked, stored with the plan (no AI call while reading). Optional answers/hints to reveal; tapping a question can open Ask AI with the chapter for a discussion. Later also for scripture reading plans. |

## Later

| # | Item | Notes |
|---|------|-------|
| LA1 | **LibriVox audio with read-along** (top pick) | LibriVox recordings are human-read and public domain, covering most of our classics. Line each recording up with the text (forced alignment, e.g. aeneas / WhisperX, done once on the PC) so the reader highlights paragraph by paragraph like the scripture read-alongs. Human voice next to the computer voices; listener picks. Store in R2 like the current audio. |
| LA2 | Gutenberg / Microsoft / MIT open audiobooks | ~5,000 computer-narrated Gutenberg books (marhamilresearch4 site + GitHub). For books LibriVox doesn't cover. Confirm the licence first. |
| LA3 | Our own voices for every book | Kokoro read-alongs for whatever has no other audio; these are also the files we could share on archive.org (AU). |
| LT1 | **Standard Ebooks texts** (top pick) | Public domain (CC0), carefully proofread classics (~1,000) with clean chapters and fixed typos. Use them instead of the raw Gutenberg file wherever a book exists there; keep Gutenberg for the rest. |
| LT2 | **Original languages side by side** (top pick) | Like Dante and Don Quixote today: Les Misérables (French), War and Peace and Crime and Punishment (Russian), Faust (German), Iliad and Odyssey (Greek), Aeneid and Metamorphoses (Latin), Chekhov and Tolstoy stories. |
| LT3 | **Pictures in the books** (Skylar, Nov 8) | The illustrated Gutenberg editions (Tenniel's Alice, Doré's Dante, the Pride and Prejudice drawings, maps and plates in travel and science books) have public-domain picture files; today the importer drops them and leaves only the caption. Plan: keep each picture where it sits in the text as a small marker (a picture icon or ✦ with the caption). Tap it → a picture window: pinch / scroll to zoom, drag to pan, resize the window (desktop: drag the corner; iPad: pinch or drag; iPhone: full-screen sheet), close with ✕, Escape or a tap back on the text. Pictures stored in R2 (not in the 100k static files), loaded only when opened. Also a "Pictures" list per book. Works offline only if downloaded with the book (optional). |
| LT4 | Footnotes and word notes | Keep the books' footnotes as tap-to-read notes instead of removing them; short explanations of archaic words. |
| LD1 | Author pages | Short bio, their other books on the shelves, and the scripture they draw on most (from the cross references). |
| LD3 | Reading time, difficulty, kids' read-along shelf | Minutes per chapter and a reading level per book; the For Children list paired with audio and highlighting. |
| LD4 | More Gutenberg collections | Poetry, drama, mythology and folklore, history, philosophy, travel and exploration (beyond today's reading lists and fiction shelves). |
| ML | **Literature and translations in more languages** | Later: AI translations into Spanish, French, Portuguese etc., first for the texts with no translation in that language, then popular books. Same labelling; shown as extra versions side by side. |
| L | More of the library | Project Gutenberg / public-domain texts as they come up; AI translations only where no free English exists, always labelled. |

## History (done)

- **Nov 10:** Library Across launched: the Literature, Freethought and Psychology shelves moved from Verses Across to libraryacross.com (same code, its own Worker, logo, themes, sitemap and About page). Old links forward with readers' places, highlights and notes. Search Console verified, sitemap submitted (1,218 pages).
- **Nov 9:** Library themes (44), search across every book, "If you liked this…" (on Verses Across, before the split).
- **Nov 8–9:** Freethought shelf (Ingersoll, Paine, Russell and more), Psychology shelf; Literature shelves with 1,032 Gutenberg books.
