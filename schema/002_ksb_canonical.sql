PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ksb_registered_apps (
  app_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  webhook_url TEXT,
  api_key_hash TEXT NOT NULL,
  default_use_case_template TEXT NOT NULL DEFAULT 'custom',
  total_bonds INTEGER NOT NULL DEFAULT 0,
  total_volume_sompi TEXT NOT NULL DEFAULT '0',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(app_id) > 0),
  CHECK (total_volume_sompi GLOB '[0-9]*')
);

CREATE TABLE IF NOT EXISTS ksb_bonds (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  app_id TEXT NOT NULL,
  use_case_template TEXT NOT NULL DEFAULT 'custom',
  provider_address TEXT NOT NULL,
  counterparty_address TEXT NOT NULL,
  bond_amount_sompi TEXT NOT NULL,
  payment_amount_sompi TEXT,
  deadline_unix INTEGER NOT NULL,
  verifier_config_json TEXT NOT NULL,
  slash_distribution_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'proposed',
      'committed',
      'active',
      'verified',
      'failed',
      'timed_out',
      'contested',
      'arbitration',
      'released',
      'slashed',
      'failed_execution'
    )
  ),
  external_ref TEXT,
  covenant_script_version TEXT,
  covenant_artifact_ref TEXT,
  covenant_args_json TEXT,
  covenant_utxo TEXT,
  lock_tx_hash TEXT,
  resolution_tx_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (app_id) REFERENCES ksb_registered_apps(app_id) ON DELETE RESTRICT,
  CHECK (length(public_id) > 0),
  CHECK (bond_amount_sompi GLOB '[0-9]*'),
  CHECK (payment_amount_sompi IS NULL OR payment_amount_sompi GLOB '[0-9]*')
);

CREATE INDEX IF NOT EXISTS idx_ksb_bonds_app_id ON ksb_bonds(app_id);
CREATE INDEX IF NOT EXISTS idx_ksb_bonds_status ON ksb_bonds(status);
CREATE INDEX IF NOT EXISTS idx_ksb_bonds_provider_address ON ksb_bonds(provider_address);
CREATE INDEX IF NOT EXISTS idx_ksb_bonds_counterparty_address ON ksb_bonds(counterparty_address);
CREATE INDEX IF NOT EXISTS idx_ksb_bonds_deadline_unix ON ksb_bonds(deadline_unix);
CREATE INDEX IF NOT EXISTS idx_ksb_bonds_lock_tx_hash ON ksb_bonds(lock_tx_hash);

CREATE TABLE IF NOT EXISTS ksb_verifier_rules (
  name TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  verifier_type TEXT NOT NULL,
  default_timeout_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (default_timeout_ms >= 0)
);

CREATE TABLE IF NOT EXISTS ksb_verifications (
  id TEXT PRIMARY KEY,
  bond_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('pending', 'passed', 'failed', 'timed_out', 'contested')),
  evidence_json TEXT,
  verifier_signature TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bond_id) REFERENCES ksb_bonds(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_name) REFERENCES ksb_verifier_rules(name) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ksb_verifications_bond_id ON ksb_verifications(bond_id);
CREATE INDEX IF NOT EXISTS idx_ksb_verifications_rule_name ON ksb_verifications(rule_name);
CREATE INDEX IF NOT EXISTS idx_ksb_verifications_result ON ksb_verifications(result);

CREATE TABLE IF NOT EXISTS ksb_slashing_events (
  id TEXT PRIMARY KEY,
  bond_id TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  slash_amount_sompi TEXT NOT NULL,
  distribution_json TEXT NOT NULL,
  slash_tx_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bond_id) REFERENCES ksb_bonds(id) ON DELETE CASCADE,
  CHECK (slash_amount_sompi GLOB '[0-9]*')
);

CREATE INDEX IF NOT EXISTS idx_ksb_slashing_events_reason ON ksb_slashing_events(reason);
CREATE INDEX IF NOT EXISTS idx_ksb_slashing_events_slash_tx_hash ON ksb_slashing_events(slash_tx_hash);

CREATE TABLE IF NOT EXISTS ksb_party_history (
  address TEXT NOT NULL,
  app_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('provider', 'counterparty', 'verifier')),
  total_bonded_sompi TEXT NOT NULL DEFAULT '0',
  bonds_released INTEGER NOT NULL DEFAULT 0,
  bonds_slashed INTEGER NOT NULL DEFAULT 0,
  total_slashed_value_sompi TEXT NOT NULL DEFAULT '0',
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (address, app_id, role),
  FOREIGN KEY (app_id) REFERENCES ksb_registered_apps(app_id) ON DELETE CASCADE,
  CHECK (total_bonded_sompi GLOB '[0-9]*'),
  CHECK (total_slashed_value_sompi GLOB '[0-9]*')
);

CREATE INDEX IF NOT EXISTS idx_ksb_party_history_app_id ON ksb_party_history(app_id);
CREATE INDEX IF NOT EXISTS idx_ksb_party_history_role ON ksb_party_history(role);

CREATE TABLE IF NOT EXISTS ksb_bond_events (
  id TEXT PRIMARY KEY,
  bond_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  summary TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bond_id) REFERENCES ksb_bonds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ksb_bond_events_bond_id_created_at ON ksb_bond_events(bond_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_ksb_registered_apps_updated_at
AFTER UPDATE ON ksb_registered_apps
FOR EACH ROW
BEGIN
  UPDATE ksb_registered_apps SET updated_at = CURRENT_TIMESTAMP WHERE app_id = NEW.app_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_ksb_bonds_updated_at
AFTER UPDATE ON ksb_bonds
FOR EACH ROW
BEGIN
  UPDATE ksb_bonds SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
