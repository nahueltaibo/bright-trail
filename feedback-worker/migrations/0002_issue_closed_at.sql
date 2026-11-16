-- When the report's GitHub issue closed. Retention deletes the report 90 days later.
ALTER TABLE reports ADD COLUMN issue_closed_at TEXT;
CREATE INDEX reports_issue_closed ON reports (issue_closed_at);
CREATE INDEX reports_received ON reports (received_at, id);
