Read ../HOUSE-RULES.md at every start; only Skylar changes it.

Keep the hub ticket watch armed (Monitor: `node hub/cli.mjs watch --minutes 29`, re-arm on WATCH ENDED), also after a restart or a compacted session. See ../Claude HQ/state/VersesAcross-schedules.md.

Questions for Skylar between 6 AM and 6 PM ET go to the hub as tickets (`node hub/cli.mjs ask "<question>"`), not only in chat.

When ROADMAP.md changes, republish the roadmap page (`npx tsx scripts/roadmap-page.mts`, then publish the Artifact at the same URL); a Stop hook checks this.

@AGENTS.md
