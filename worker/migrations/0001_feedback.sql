CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('问题', '建议', '其他')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 5 AND 2000),
  question TEXT CHECK (question IS NULL OR length(question) <= 2000),
  engine TEXT CHECK (engine IS NULL OR engine IN ('tarot', 'iching', 'meihua', 'numerology', 'runes')),
  app_version TEXT CHECK (app_version IS NULL OR length(app_version) <= 40)
);
CREATE INDEX IF NOT EXISTS feedback_received_at ON feedback(received_at);
