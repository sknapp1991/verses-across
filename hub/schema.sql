-- The team hub's database (D1 "va-hub", binding DB). Apply:
--   npx wrangler d1 execute va-hub --remote --file hub/schema.sql
-- `author` is the signed-in email from the Cloudflare Access token, or "claude" for notes Claude posts.

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  created TEXT NOT NULL,
  author TEXT NOT NULL,
  type TEXT NOT NULL,            -- Bug | Idea | Content | Question
  place TEXT NOT NULL DEFAULT '', -- where: a page, URL or verse
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New', -- New | Seen | Working | Question (open) · Live | Done | Roadmap (history)
  notes TEXT NOT NULL DEFAULT '',     -- Claude's plain note (what changed / the question)
  live_url TEXT NOT NULL DEFAULT '',  -- where to test it once Live
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_status ON reports (status, created);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL,      -- report | approval
  owner_id TEXT NOT NULL,
  key TEXT NOT NULL,             -- R2 key in va-hub-media
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  upload_id TEXT,
  uploaded_by TEXT,              -- who started the upload (only they can send its parts)
  state TEXT NOT NULL DEFAULT 'uploading', -- uploading | done
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS media_owner ON media (owner_kind, owner_id);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  thread TEXT NOT NULL,          -- "report:<id>" | "roadmap:<item id>" | "approval:<id>"
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_thread ON comments (thread, created);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,            -- clip | other
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Waiting', -- Waiting | Approved | Changes
  note TEXT NOT NULL DEFAULT '',
  decided_by TEXT,
  decided_at TEXT,
  created TEXT NOT NULL,
  created_by TEXT NOT NULL
);

-- Every decision, for the record (clips and website feedback alike)
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  what TEXT NOT NULL,            -- "approval:<id>" | "feedback:<id>"
  decision TEXT NOT NULL,        -- Approved | Changes | Go | No
  note TEXT NOT NULL DEFAULT '',
  by TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  item TEXT NOT NULL,            -- roadmap item id (e.g. GQ)
  author TEXT NOT NULL,
  created TEXT NOT NULL,
  PRIMARY KEY (item, author)
);

-- Plain-words "what shipped" lines Claude adds (the Shipped tab also lists recent commits)
CREATE TABLE IF NOT EXISTS shipped (
  id TEXT PRIMARY KEY,
  created TEXT NOT NULL,
  text TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT ''
);
