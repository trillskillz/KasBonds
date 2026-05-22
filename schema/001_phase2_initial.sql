PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bonds (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (
    state IN (
      'draft',
      'offered',
      'accepted',
      'funding_pending',
      'active',
      'verification_pending',
      'approved',
      'rejected',
      'expired',
      'released',
      'slashed',
      'failed_execution'
    )
  ),
  network TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  artifact_ref TEXT,
  constructor_args_json TEXT,
  job_ref TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  verifier_id TEXT,
  buyer_address TEXT NOT NULL,
  agent_address TEXT NOT NULL,
  verifier_address TEXT,
  platform_fee_address TEXT NOT NULL,
  burn_address TEXT NOT NULL,
  bond_principal_sompi TEXT NOT NULL,
  slashable_amount_sompi TEXT NOT NULL,
  platform_fee_bps INTEGER NOT NULL DEFAULT 500,
  buyer_share_bps INTEGER NOT NULL DEFAULT 5000,
  burn_share_bps INTEGER NOT NULL DEFAULT 4500,
  release_deadline_unix INTEGER NOT NULL,
  slash_deadline_unix INTEGER NOT NULL,
  lock_txid TEXT,
  lock_vout INTEGER,
  covenant_address TEXT,
  release_txid TEXT,
  slash_txid TEXT,
  failure_reason TEXT,
  accepted_at TEXT,
  funded_at TEXT,
  activated_at TEXT,
  verification_requested_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(public_id) > 0),
  CHECK (bond_principal_sompi GLOB '[0-9]*'),
  CHECK (slashable_amount_sompi GLOB '[0-9]*'),
  CHECK (platform_fee_bps >= 0),
  CHECK (buyer_share_bps >= 0),
  CHECK (burn_share_bps >= 0),
  CHECK (platform_fee_bps + buyer_share_bps + burn_share_bps = 10000)
);

CREATE INDEX IF NOT EXISTS idx_bonds_state ON bonds(state);
CREATE INDEX IF NOT EXISTS idx_bonds_buyer_id ON bonds(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bonds_agent_id ON bonds(agent_id);
CREATE INDEX IF NOT EXISTS idx_bonds_verifier_id ON bonds(verifier_id);
CREATE INDEX IF NOT EXISTS idx_bonds_job_ref ON bonds(job_ref);
CREATE INDEX IF NOT EXISTS idx_bonds_lock_txid ON bonds(lock_txid);

CREATE TABLE IF NOT EXISTS bond_events (
  id TEXT PRIMARY KEY,
  bond_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'draft_created',
      'offer_sent',
      'offer_accepted',
      'funding_requested',
      'lock_broadcast',
      'lock_confirmed',
      'verification_requested',
      'verifier_approved',
      'verifier_rejected',
      'deadline_expired',
      'release_broadcast',
      'release_confirmed',
      'slash_broadcast',
      'slash_confirmed',
      'execution_failed',
      'note'
    )
  ),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'buyer', 'agent', 'verifier', 'operator')),
  actor_id TEXT,
  summary TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bond_id) REFERENCES bonds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bond_events_bond_id_created_at ON bond_events(bond_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bond_events_event_type ON bond_events(event_type);

CREATE TABLE IF NOT EXISTS verifier_decisions (
  id TEXT PRIMARY KEY,
  bond_id TEXT NOT NULL UNIQUE,
  verifier_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  decision_reason TEXT,
  evidence_json TEXT,
  signature_payload_json TEXT,
  signature_hex TEXT,
  signed_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bond_id) REFERENCES bonds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verifier_decisions_verifier_id ON verifier_decisions(verifier_id);
CREATE INDEX IF NOT EXISTS idx_verifier_decisions_status ON verifier_decisions(status);

CREATE TABLE IF NOT EXISTS slash_distributions (
  id TEXT PRIMARY KEY,
  bond_id TEXT NOT NULL UNIQUE,
  lock_txid TEXT NOT NULL,
  slash_txid TEXT,
  total_input_sompi TEXT NOT NULL,
  miner_fee_sompi TEXT NOT NULL,
  distributable_sompi TEXT NOT NULL,
  buyer_amount_sompi TEXT NOT NULL,
  platform_fee_amount_sompi TEXT NOT NULL,
  burn_amount_sompi TEXT NOT NULL,
  buyer_address TEXT NOT NULL,
  platform_fee_address TEXT NOT NULL,
  burn_address TEXT NOT NULL,
  policy_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bond_id) REFERENCES bonds(id) ON DELETE CASCADE,
  CHECK (total_input_sompi GLOB '[0-9]*'),
  CHECK (miner_fee_sompi GLOB '[0-9]*'),
  CHECK (distributable_sompi GLOB '[0-9]*'),
  CHECK (buyer_amount_sompi GLOB '[0-9]*'),
  CHECK (platform_fee_amount_sompi GLOB '[0-9]*'),
  CHECK (burn_amount_sompi GLOB '[0-9]*')
);

CREATE TABLE IF NOT EXISTS bond_acceptance_rules (
  id TEXT PRIMARY KEY,
  bond_id TEXT NOT NULL UNIQUE,
  min_agent_reputation REAL,
  requires_manual_review INTEGER NOT NULL DEFAULT 0 CHECK (requires_manual_review IN (0, 1)),
  allowed_verifier_policy TEXT NOT NULL DEFAULT 'centralized',
  max_resolution_minutes INTEGER,
  rule_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bond_id) REFERENCES bonds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agent_bond_history (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  bond_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('agent', 'buyer', 'verifier')),
  state_at_record TEXT NOT NULL,
  principal_sompi TEXT NOT NULL,
  outcome TEXT CHECK (outcome IN ('pending', 'released', 'slashed', 'failed_execution')),
  txid TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bond_id) REFERENCES bonds(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_bond_history_agent_id_recorded_at ON agent_bond_history(agent_id, recorded_at);

CREATE TRIGGER IF NOT EXISTS trg_bonds_updated_at
AFTER UPDATE ON bonds
FOR EACH ROW
BEGIN
  UPDATE bonds SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_verifier_decisions_updated_at
AFTER UPDATE ON verifier_decisions
FOR EACH ROW
BEGIN
  UPDATE verifier_decisions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_slash_distributions_updated_at
AFTER UPDATE ON slash_distributions
FOR EACH ROW
BEGIN
  UPDATE slash_distributions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_bond_acceptance_rules_updated_at
AFTER UPDATE ON bond_acceptance_rules
FOR EACH ROW
BEGIN
  UPDATE bond_acceptance_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
