export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

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
  verifierConfigJson: JsonValue;
  slashDistributionJson: JsonValue;
  externalRef?: string | null;
  covenantScriptVersion?: string | null;
  covenantArtifactRef?: string | null;
  covenantArgsJson?: JsonValue | null;
  covenantUtxo?: string | null;
  lockTxHash?: string | null;
}

export interface SubmitKsbBondProofRuleInput {
  ruleName: string;
  result?: 'pending' | 'passed' | 'failed' | 'timed_out' | 'contested';
  evidenceJson?: JsonValue | null;
  verifierSignature?: string | null;
}

export interface SubmitKsbBondProofInput {
  proofJson?: JsonValue | null;
  submittedBy?: string | null;
  summary?: string | null;
  verifications?: SubmitKsbBondProofRuleInput[];
}

export interface ContestKsbBondInput {
  submittedBy?: string | null;
  summary?: string | null;
  reason?: string | null;
  evidenceJson?: JsonValue | null;
  ruleNames?: string[];
  moveToArbitration?: boolean;
}

export interface RecordKsbReleaseExecutionInput {
  resolutionTxHash: string;
  executionPayloadJson: JsonValue;
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
  distributionJson: JsonValue;
  executionPayloadJson: JsonValue;
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
  apps: Array<{
    appId: string;
    appName: string | null;
    roles: Array<{
      role: 'provider' | 'counterparty' | 'verifier';
      totalBondedSompi: string;
      bondsReleased: number;
      bondsSlashed: number;
      totalSlashedValueSompi: string;
      lastUpdated: string | null;
    }>;
  }>;
  recentBonds: Array<{
    publicId: string;
    appId: string;
    role: 'provider' | 'counterparty';
    status: KsbBondStatus;
    bondAmountSompi: string;
    createdAt: string;
  }>;
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
  subScores: Array<{
    appId: string;
    appName: string | null;
    releaseRatio: number | null;
    slashRatio: number | null;
    totalBondedSompi: string;
    totalSlashedValueSompi: string;
    releasedCount: number;
    slashedCount: number;
  }>;
  compatibility: {
    standard: 'erc-8004-compatible-shape-pending';
    status: 'partial';
  };
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

export interface KsbCronRunResult {
  action: 'resolve-expired' | 'auto-verify' | 'rebuild-party-history';
  scanned: number;
  updated: number;
  bondIds: string[];
  at: string;
}

export interface KsbClientOptions {
  baseUrl: string;
  apiKey?: string;
  operatorKey?: string;
  fetch?: typeof fetch;
}

export class KsbApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message = 'KSB API request failed') {
    super(message);
    this.name = 'KsbApiError';
    this.status = status;
    this.body = body;
  }
}

export class KsbClient {
  private baseUrl: string;
  private apiKey?: string;
  private operatorKey?: string;
  private fetchImpl: typeof fetch;

  constructor(options: KsbClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.operatorKey = options.operatorKey;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}, auth: 'none' | 'app' | 'operator' = 'none'): Promise<T> {
    const headers = new Headers(init.headers ?? {});
    headers.set('content-type', 'application/json');

    if (auth === 'app') {
      if (!this.apiKey) throw new Error('Missing apiKey for app-authenticated request');
      headers.set('x-ksb-api-key', this.apiKey);
    }

    if (auth === 'operator') {
      if (!this.operatorKey) throw new Error('Missing operatorKey for operator-authenticated request');
      headers.set('x-ksb-operator-key', this.operatorKey);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new KsbApiError(response.status, body, typeof body?.error === 'string' ? body.error : 'KSB API request failed');
    }
    return body as T;
  }

  registerApp(input: RegisterAppInput) {
    return this.request<RegisteredAppSecret>('/api/v1/apps/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }, 'operator');
  }

  listBonds(params: Record<string, string | number | undefined> = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null) query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ bonds: KsbBondRecord[] }>(`/api/v1/bonds${suffix}`);
  }

  createBond(input: CreateKsbBondInput) {
    return this.request<KsbBondDetail>('/api/v1/bonds', {
      method: 'POST',
      body: JSON.stringify(input),
    }, 'app');
  }

  getBond(bondId: string) {
    return this.request<KsbBondDetail>(`/api/v1/bonds/${encodeURIComponent(bondId)}`);
  }

  submitProof(bondId: string, input: SubmitKsbBondProofInput) {
    return this.request<KsbBondDetail>(`/api/v1/bonds/${encodeURIComponent(bondId)}/submit`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  contestBond(bondId: string, input: ContestKsbBondInput) {
    return this.request<KsbBondDetail>(`/api/v1/bonds/${encodeURIComponent(bondId)}/contest`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  recordRelease(bondId: string, input: RecordKsbReleaseExecutionInput) {
    return this.request<KsbBondDetail>(`/api/v1/bonds/${encodeURIComponent(bondId)}/release`, {
      method: 'POST',
      body: JSON.stringify(input),
    }, 'operator');
  }

  recordSlash(bondId: string, input: RecordKsbSlashExecutionInput) {
    return this.request<KsbBondDetail>(`/api/v1/bonds/${encodeURIComponent(bondId)}/slash`, {
      method: 'POST',
      body: JSON.stringify(input),
    }, 'operator');
  }

  getBondStatus(bondId: string) {
    return this.request<KsbBondStatusView>(`/api/v1/bonds/${encodeURIComponent(bondId)}/status`);
  }

  getPartyHistory(address: string) {
    return this.request<KsbPartyHistoryView>(`/api/v1/parties/${encodeURIComponent(address)}`);
  }

  getPartyScore(address: string) {
    return this.request<KsbPartyScoreView>(`/api/v1/parties/${encodeURIComponent(address)}/score`);
  }

  resolveExpired(nowUnix?: number) {
    return this.request<KsbCronRunResult>('/api/v1/cron/resolve-expired', {
      method: 'POST',
      body: JSON.stringify(nowUnix == null ? {} : { nowUnix }),
    }, 'operator');
  }

  autoVerify() {
    return this.request<KsbCronRunResult>('/api/v1/cron/auto-verify', {
      method: 'POST',
      body: JSON.stringify({}),
    }, 'operator');
  }

  rebuildPartyHistory() {
    return this.request<KsbCronRunResult>('/api/v1/cron/rebuild-party-history', {
      method: 'POST',
      body: JSON.stringify({}),
    }, 'operator');
  }

  listVerifierRules() {
    return this.request<{ rules: KsbVerifierRuleRecord[] }>('/api/v1/verifier-rules');
  }
}
