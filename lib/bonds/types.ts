export type BondState =
  | 'draft'
  | 'offered'
  | 'accepted'
  | 'funding_pending'
  | 'active'
  | 'verification_pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'released'
  | 'slashed'
  | 'failed_execution';

export interface CreateBondDraftInput {
  network: string;
  jobRef: string;
  buyerId: string;
  agentId: string;
  verifierId?: string | null;
  buyerAddress: string;
  agentAddress: string;
  verifierAddress?: string | null;
  platformFeeAddress: string;
  burnAddress: string;
  bondPrincipalSompi: string;
  slashableAmountSompi: string;
  releaseDeadlineUnix: number;
  slashDeadlineUnix: number;
  artifactKind?: string;
  artifactRef?: string | null;
  constructorArgsJson?: string | null;
  acceptanceRuleJson?: string | null;
  minAgentReputation?: number | null;
  requiresManualReview?: boolean;
  allowedVerifierPolicy?: string;
  maxResolutionMinutes?: number | null;
}

export interface AcceptBondInput {
  actorId?: string | null;
  summary?: string;
}

export interface RecordBondLockInput {
  lockTxid: string;
  lockVout: number;
  covenantAddress: string;
  artifactRef?: string | null;
  constructorArgsJson?: string | null;
  actorId?: string | null;
  summary?: string;
}

export interface RecordVerifierDecisionInput {
  verifierId: string;
  status: 'approved' | 'rejected' | 'expired';
  decisionReason?: string | null;
  evidenceJson?: string | null;
  signaturePayloadJson?: string | null;
  signatureHex?: string | null;
  signedAt?: string | null;
  expiresAt?: string | null;
  actorId?: string | null;
  summary?: string;
}

export interface RecordReleaseExecutionInput {
  releaseTxid: string;
  actorId?: string | null;
  summary?: string;
}

export interface RecordSlashExecutionInput {
  slashTxid: string;
  totalInputSompi: string;
  minerFeeSompi: string;
  distributableSompi: string;
  buyerAmountSompi: string;
  platformFeeAmountSompi: string;
  burnAmountSompi: string;
  buyerAddress: string;
  platformFeeAddress: string;
  burnAddress: string;
  policyJson?: string | null;
  actorId?: string | null;
  summary?: string;
}

export interface BondRecord {
  id: string;
  publicId: string;
  state: BondState;
  network: string;
  artifactKind: string;
  artifactRef: string | null;
  constructorArgsJson: string | null;
  jobRef: string;
  buyerId: string;
  agentId: string;
  verifierId: string | null;
  buyerAddress: string;
  agentAddress: string;
  verifierAddress: string | null;
  platformFeeAddress: string;
  burnAddress: string;
  bondPrincipalSompi: string;
  slashableAmountSompi: string;
  platformFeeBps: number;
  buyerShareBps: number;
  burnShareBps: number;
  releaseDeadlineUnix: number;
  slashDeadlineUnix: number;
  lockTxid: string | null;
  lockVout: number | null;
  covenantAddress: string | null;
  releaseTxid: string | null;
  slashTxid: string | null;
  failureReason: string | null;
  acceptedAt: string | null;
  fundedAt: string | null;
  activatedAt: string | null;
  verificationRequestedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BondEventRecord {
  id: string;
  bondId: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  summary: string;
  dataJson: string | null;
  createdAt: string;
}

export interface VerifierDecisionRecord {
  id: string;
  bondId: string;
  verifierId: string;
  status: string;
  decisionReason: string | null;
  evidenceJson: string | null;
  signaturePayloadJson: string | null;
  signatureHex: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlashDistributionRecord {
  id: string;
  bondId: string;
  lockTxid: string;
  slashTxid: string | null;
  totalInputSompi: string;
  minerFeeSompi: string;
  distributableSompi: string;
  buyerAmountSompi: string;
  platformFeeAmountSompi: string;
  burnAmountSompi: string;
  buyerAddress: string;
  platformFeeAddress: string;
  burnAddress: string;
  policyJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BondStatusView {
  bond: BondRecord;
  decision: VerifierDecisionRecord | null;
  slashDistribution: SlashDistributionRecord | null;
  events: BondEventRecord[];
}
