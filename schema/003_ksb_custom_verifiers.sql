PRAGMA foreign_keys = ON;

-- Custom verifier registry.
--
-- A registered app can bind a named verifier rule to its own signed webhook.
-- The rule definition itself still lives in ksb_verifier_rules; this table
-- holds the app ownership and webhook execution config used by the hub.
CREATE TABLE IF NOT EXISTS ksb_custom_verifiers (
  rule_name TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  verifier_public_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rule_name) REFERENCES ksb_verifier_rules(name) ON DELETE CASCADE,
  FOREIGN KEY (app_id) REFERENCES ksb_registered_apps(app_id) ON DELETE CASCADE,
  CHECK (length(webhook_url) > 0)
);

CREATE INDEX IF NOT EXISTS idx_ksb_custom_verifiers_app_id ON ksb_custom_verifiers(app_id);

CREATE TRIGGER IF NOT EXISTS trg_ksb_custom_verifiers_updated_at
AFTER UPDATE ON ksb_custom_verifiers
FOR EACH ROW
BEGIN
  UPDATE ksb_custom_verifiers SET updated_at = CURRENT_TIMESTAMP WHERE rule_name = NEW.rule_name;
END;
