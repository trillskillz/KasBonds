export type KsbBondStatus =
  | 'proposed'
  | 'committed'
  | 'active'
  | 'verified'
  | 'failed'
  | 'timed_out'
  | 'contested'
  | 'arbitration'
  | 'released'
  | 'slashed'
  | 'failed_execution';

export interface RegisterAppInput {
  name: string;
  contact?: string | null;
  webhookUrl?: string | null;
  defaultUseCaseTemplate?: string | null;
}

export interface RegisteredAppRecord {
  appId: string;
  name: string;
  contact: string | null;
  webhookUrl: string | null;
  defaultUseCaseTemplate: string;
  totalBonds: number;
  totalVolumeSompi: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredAppSecret {
  app: RegisteredAppRecord;
  apiKey: string;
}

export interface CreateKsbBondInput {
  useCaseTemplate?: string | null;
  providerAddress: string;
  counterpartyAddress: string;
  bondAmountSompi: string;
  paymentAmountSompi?: string | null;
  deadlineUnix: number;
  verifierConfigJson: string | Record<string, unknown>;
  slashDistributionJson: string | Record<string, unknown>;
  externalRef?: string | null;
  covenantScriptVersion?: string | null;
  covenantArtifactRef?: string | null;
  covenantArgsJson?: string | Record<string, unknown> | null;
  covenantUtxo?: string | null;
  lockTxHash?: string | null;
}

export interface SubmitKsbBondProofRuleInput {
  ruleName: string;
  result?: 'pending' | 'passed' | 'failed' | 'timed_out' | 'contested';
  evidenceJson?: string | Record<string, unknown> | null;
  verifierSignature?: string | null;
}

export interface SubmitKsbBondProofInput {
  proofJson?: string | Record<string, unknown> | null;
  submittedBy?: string | null;
  summary?: string | null;
  verifications?: SubmitKsbBondProofRuleInput[];
}

export interface ContestKsbBondInput {
  submittedBy?: string | null;
  summary?: string | null;
  reason?: string | null;
  evidenceJson?: string | Record<string, unknown> | null;
  ruleNames?: string[];
  moveToArbitration?: boolean;
}

export interface RecordKsbReleaseExecutionInput {
  resolutionTxHash: string;
  executionPayloadJson: string | Record<string, unknown>;
  executionSignature: string;
  executionSigner: string;
  executionSignedAt: string;
  actorId?: string | null;
  summary?: string | null;
}

export interface RecordKsbSlashExecutionInput {
  resolutionTxHash: string;
  reason: string;
  slashAmountSompi: string;
  distributionJson: string | Record<string, unknown>;
  executionPayloadJson: string | Record<string, unknown>;
  executionSignature: string;
  executionSigner: string;
  executionSignedAt: string;
  actorId?: string | null;
  summary?: string | null;
}

export interface KsbBondRecord {
  id: string;
  publicId: string;
  appId: string;
  useCaseTemplate: string;
  providerAddress: string;
  counterpartyAddress: string;
  bondAmountSompi: string;
  paymentAmountSompi: string | null;
  deadlineUnix: number;
  verifierConfigJson: string;
  slashDistributionJson: string;
  status: KsbBondStatus;
  externalRef: string | null;
  covenantScriptVersion: string | null;
  covenantArtifactRef: string | null;
  covenantArgsJson: string | null;
  covenantUtxo: string | null;
  lockTxHash: string | null;
  resolutionTxHash: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface KsbVerificationRecord {
  id: string;
  bondId: string;
  ruleName: string;
  result: string;
  evidenceJson: string | null;
  verifierSignature: string;
  verifiedAt: string;
}

export interface KsbVerifierRuleRecord {
  name: string;
  description: string;
  schemaJson: string;
  verifierType: string;
  defaultTimeoutMs: number;
  /** Null for built-in protocol rules, an ISO timestamp for custom DB-stored rules. */
  createdAt: string | null;
  /** 'builtin' for protocol catalog rules, 'custom' for app-declared rules. */
  source: 'builtin' | 'custom';
}

export interface RegisterVerifierRuleInput {
  name: string;
  webhookUrl: string;
  description?: string | null;
  verifierPublicKey?: string | null;
  defaultTimeoutMs?: number | null;
  schemaJson?: string | Record<string, unknown> | null;
}

export interface RegisteredVerifierRule {
  name: string;
  appId: string;
  description: string;
  verifierType: 'webhook';
  webhookUrl: string;
  verifierPublicKey: string | null;
  defaultTimeoutMs: number;
  schemaJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface KsbSlashingEventRecord {
  id: string;
  bondId: string;
  reason: string;
  slashAmountSompi: string;
  distributionJson: string;
  slashTxHash: string;
  createdAt: string;
}

export interface KsbBondEventRecord {
  id: string;
  bondId: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  summary: string;
  dataJson: string | null;
  createdAt: string;
}

export interface KsbBondDetail {
  bond: KsbBondRecord;
  app: RegisteredAppRecord | null;
  verifications: KsbVerificationRecord[];
  slashingEvent: KsbSlashingEventRecord | null;
  events: KsbBondEventRecord[];
}

export interface KsbBondStatusView {
  bondId: string;
  publicId: string;
  appId: string;
  useCaseTemplate: string;
  status: KsbBondStatus;
  providerAddress: string;
  counterpartyAddress: string;
  deadlineUnix: number;
  lockTxHash: string | null;
  resolutionTxHash: string | null;
  resolvedAt: string | null;
  updatedAt: string;
  verificationSummary: {
    total: number;
    pending: number;
    passed: number;
    failed: number;
    timedOut: number;
    contested: number;
  };
  lastEvent: KsbBondEventRecord | null;
}

export interface KsbPartyHistoryRoleView {
  role: 'provider' | 'counterparty' | 'verifier';
  totalBondedSompi: string;
  bondsReleased: number;
  bondsSlashed: number;
  totalSlashedValueSompi: string;
  lastUpdated: string | null;
}

export interface KsbPartyHistoryAppView {
  appId: string;
  appName: string | null;
  roles: KsbPartyHistoryRoleView[];
}

export interface KsbPartyHistoryBondRef {
  publicId: string;
  appId: string;
  role: 'provider' | 'counterparty';
  status: KsbBondStatus;
  bondAmountSompi: string;
  createdAt: string;
}

export interface KsbPartyHistoryView {
  address: string;
  summary: {
    totalBonds: number;
    asProvider: number;
    asCounterparty: number;
    asVerifier: number;
    released: number;
    slashed: number;
    active: number;
    totalBondedSompi: string;
    totalSlashedValueSompi: string;
  };
  apps: KsbPartyHistoryAppView[];
  recentBonds: KsbPartyHistoryBondRef[];
}

export interface KsbPartyScoreAppView {
  appId: string;
  appName: string | null;
  releaseRatio: number | null;
  slashRatio: number | null;
  totalBondedSompi: string;
  totalSlashedValueSompi: string;
  releasedCount: number;
  slashedCount: number;
}

export interface KsbPartyScoreView {
  address: string;
  score: {
    releaseRatio: number | null;
    slashRatio: number | null;
    activeRiskIndicator: number;
    totalBondedSompi: string;
    totalSlashedValueSompi: string;
    releasedCount: number;
    slashedCount: number;
    verifierActivityCount: number;
  };
  subScores: KsbPartyScoreAppView[];
  compatibility: {
    standard: 'erc-8004-compatible-shape-pending';
    status: 'partial';
  };
}

export interface KsbReputationValidationRecord {
  bondPublicId: string;
  appId: string;
  role: 'provider' | 'counterparty';
  outcome: 'released' | 'slashed' | 'pending';
  bondAmountSompi: string;
  createdAt: string;
}

export interface KsbReputationSignal {
  appId: string;
  appName: string | null;
  validations: number;
  passed: number;
  failed: number;
  passRate: number | null;
}

export interface KsbReputationVerifierAppActivity {
  appId: string;
  appName: string | null;
  validationsServed: number;
  bondedValueObservedSompi: string;
}

/**
 * The party acting as a verifier: how much validation work this address has
 * performed, as opposed to being the subject of validations.
 */
export interface KsbReputationVerifierActivity {
  validationsServed: number;
  appsServed: number;
  bondedValueObservedSompi: string;
  perApp: KsbReputationVerifierAppActivity[];
}

/**
 * An ERC-8004 aligned reputation profile for a party.
 *
 * KSB is the Kaspa-native implementation of the ERC-8004 Validation Registry
 * pattern (stake-secured re-execution). A resolved bond is one validation: a
 * release is a pass, a slash is a fail. This profile re-shapes a party's KSB
 * history into that validation-registry vocabulary so reputation is portable.
 */
export interface KsbReputationProfile {
  schema: 'erc-8004/validation-reputation';
  schemaVersion: string;
  subject: {
    account: string;
    address: string;
    registry: 'ksb';
    validationPattern: 'stake-secured-re-execution';
  };
  summary: {
    totalValidations: number;
    passed: number;
    failed: number;
    pending: number;
    passRate: number | null;
    reputationScore: number | null;
    activeRiskIndicator: number;
    stakeBondedSompi: string;
    stakeSlashedSompi: string;
  };
  signals: KsbReputationSignal[];
  recentValidations: KsbReputationValidationRecord[];
  verifierActivity: KsbReputationVerifierActivity;
  compatibility: {
    standard: 'erc-8004';
    registryRole: 'validation';
    status: 'aligned';
  };
  generatedAt: string;
}

export interface KsbCronRunResult {
  action: 'resolve-expired' | 'auto-verify' | 'rebuild-party-history' | 'dispatch-verifiers';
  scanned: number;
  updated: number;
  bondIds: string[];
  at: string;
}

export interface DispatchVerifierRuleInput {
  ruleName: string;
  /** Runtime params merged over the static params in verifierConfigJson. */
  params?: Record<string, unknown>;
}

export interface DispatchKsbVerificationInput {
  inputs?: DispatchVerifierRuleInput[];
  actorId?: string | null;
  summary?: string | null;
}

export interface KsbVerifierRuleOutcome {
  ruleName: string;
  verifierType: string;
  result: 'pending' | 'passed' | 'failed' | 'timed_out';
  evidenceJson: string;
  durationMs: number;
}

export interface KsbDispatchResult {
  bond: KsbBondDetail;
  statusBefore: KsbBondStatus;
  statusAfter: KsbBondStatus;
  outcomes: KsbVerifierRuleOutcome[];
}
