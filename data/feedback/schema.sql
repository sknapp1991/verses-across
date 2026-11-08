-- Feedback queue for Verses Across (D1 database versesacross-stats, binding STATS_DB).
-- One row per report from the in-app form (src/app/api/feedback/route.ts). The full report, with the
-- attached details, is in R2 (versesacross-feedback, key r2key); this table is the to-do list that the
-- once-a-day triage reads: status 'new' → 'sheet' (copied to the Ideas & Bugs sheet) or 'ignored'.
-- No IP addresses or contact details (reports are anonymous).
-- Apply: npx wrangler d1 execute versesacross-stats --remote --file data/feedback/schema.sql
CREATE TABLE IF NOT EXISTS feedback_queue (
  id TEXT PRIMARY KEY,          -- report id (also in the R2 key)
  received TEXT NOT NULL,       -- ISO time
  topic TEXT NOT NULL,          -- text | audio | bug | idea | other
  message TEXT NOT NULL,
  page TEXT NOT NULL DEFAULT '',
  r2key TEXT NOT NULL,
  spam INTEGER NOT NULL DEFAULT 0,  -- 1 = caught by the spam checks (not emailed)
  spam_reason TEXT,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS feedback_queue_status ON feedback_queue (status, spam);
CREATE INDEX IF NOT EXISTS feedback_queue_received ON feedback_queue (received);
