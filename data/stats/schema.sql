-- Anonymous daily totals for Verses Across (D1 database versesacross-stats, binding STATS_DB).
-- One row per day + kind + work + version; nothing about any person (no IPs, IDs, cookies or times of day).
CREATE TABLE IF NOT EXISTS daily (
  day TEXT NOT NULL,      -- YYYY-MM-DD (UTC)
  kind TEXT NOT NULL,     -- view | play | download
  work TEXT NOT NULL,     -- e.g. bible
  version TEXT NOT NULL,  -- e.g. kjv
  lang TEXT NOT NULL,     -- the version's language, e.g. en
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, work, version)
);
