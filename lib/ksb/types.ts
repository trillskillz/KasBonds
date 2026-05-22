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
