CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'filed', 'rejected')),
  content_kind TEXT NOT NULL,
  content_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  capture_key TEXT,
  capture_bytes INTEGER NOT NULL DEFAULT 0,
  group_key TEXT,
  issue_number INTEGER,
  report TEXT NOT NULL
);
CREATE INDEX reports_status ON reports (status, received_at);
CREATE INDEX reports_content ON reports (content_id);
CREATE INDEX reports_skill ON reports (skill_id);

-- One row per intake request, kept for an hour, for the per-IP rate limit.
CREATE TABLE intake_hits (
  ip_hash TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX intake_hits_ip ON intake_hits (ip_hash, at);
CREATE INDEX intake_hits_at ON intake_hits (at);

-- Totals per UTC day, for the global daily cap.
CREATE TABLE daily_usage (
  day TEXT PRIMARY KEY,
  reports INTEGER NOT NULL DEFAULT 0,
  capture_bytes INTEGER NOT NULL DEFAULT 0
);
