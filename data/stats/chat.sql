-- The testers' study chat (versesacross.com/testers; src/app/api/chat/route.ts), Nov 10.
-- One public room per id. Messages are kept 30 days. No accounts: a display name and a random browser id ("member").
-- iphash is a salted hash of the sender's IP, kept only so a ban also covers a cleared browser; it is never shown.
-- Set up once (Skylar runs it, from the hub folder): npx wrangler d1 execute versesacross-stats --remote --file=../data/stats/chat.sql
-- The room itself (its link code and the hash of Skylar's moderator key) is added separately, never committed.
CREATE TABLE IF NOT EXISTS chat_room (
  id TEXT PRIMARY KEY,        -- e.g. testers
  code TEXT NOT NULL,         -- the code in the room's link; a reset makes old links stop working
  mod_hash TEXT NOT NULL,     -- SHA-256 (hex) of Skylar's moderator key (the key itself is never stored)
  created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_msg (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  member TEXT NOT NULL,
  iphash TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_mod INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_msg_room ON chat_msg (room, id);
CREATE TABLE IF NOT EXISTS chat_ban (
  room TEXT NOT NULL,
  member TEXT NOT NULL,
  iphash TEXT NOT NULL,
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_ban_room ON chat_ban (room);
