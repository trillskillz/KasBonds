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
  createdAt: string;
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

export interface KsbCronRunResult {
  action: 'resolve-expired' | 'auto-verify' | 'rebuild-party-history';
  scanned: number;
  updated: number;
  bondIds: string[];
  at: string;
}
