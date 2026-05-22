import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type {
  CreateKsbBondInput,
  KsbBondDetail,
  KsbBondEventRecord,
  KsbBondRecord,
  KsbBondStatusView,
  KsbPartyHistoryView,
  KsbPartyScoreView,
  KsbCronRunResult,
  RecordKsbReleaseExecutionInput,
  RecordKsbSlashExecutionInput,
  KsbSlashingEventRecord,
  KsbVerifierRuleRecord,
  KsbVerificationRecord,
  RegisterAppInput,
  RegisteredAppRecord,
  RegisteredAppSecret,
  ContestKsbBondInput,
  SubmitKsbBondProofInput,
  KsbBondStatus,
  DispatchKsbVerificationInput,
  KsbDispatchResult,
  KsbVerifierRuleOutcome,
  RegisterVerifierRuleInput,
  RegisteredVerifierRule,
  KsbReputationProfile,
  KsbReputationSignal,
  KsbReputationValidationRecord,
} from './types';
import { BUILT_IN_VERIFIER_RULES, isBuiltInVerifierRule } from './verifier-rules';
import { executeVerifierRule, executeWebhookVerifier } from './verifier-hub';
import { collectRuleSpecs, evaluateBondStatus, parseRuleSetConfig, type RuleSpec } from './rule-sets';

function makeAppId() {
  return `app_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function makeBondPublicId() {
  return `bond_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function makeApiKey() {
  return `ksb_${randomBytes(24).toString('hex')}`;
}

function hashApiKey(apiKey: string) {
  return createHash('sha256').update(apiKey).digest('hex');
}

function normalizeJsonInput(value: string | Record<string, unknown> | null | undefined, fieldName: string, required = false) {
  if (value == null || value === '') {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return null;
  }

  if (typeof value === 'string') {
    JSON.parse(value);
    return value;
  }

  return JSON.stringify(value);
}

function validateDistributionJson(distributionJson: string) {
  const parsed = JSON.parse(distributionJson) as Record<string, unknown>;
  const protocolFee = Number(parsed.protocol_fee);
  if (Number.isNaN(protocolFee) || Math.abs(protocolFee - 0.005) > 0.0000001) {
    throw new Error('slashDistributionJson must include protocol_fee fixed at 0.005');
  }

  const total = (Object.values(parsed) as Array<string | number>).reduce<number>((sum, value) => sum + Number(value), 0);
  if (Math.abs(total - 1) > 0.0000001) {
    throw new Error('slashDistributionJson must sum to 1.0');
  }
}

function parseJsonObject(value: string | null | undefined, fieldName: string) {
  if (!value) {
    return {} as Record<string, unknown>;
  }

  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function addKnownAddresses(value: unknown, acc: Set<string>) {
  if (typeof value === 'string' && value.trim()) {
    acc.add(value.trim());
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && entry.trim()) {
        acc.add(entry.trim());
      } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const record = entry as Record<string, unknown>;
        addKnownAddresses(record.address, acc);
        addKnownAddresses(record.verifierAddress, acc);
        addKnownAddresses(record.oracleAddress, acc);
      }
    }
  }
}

function extractVerifierAddresses(verifierConfigJson: string) {
  const parsed = parseJsonObject(verifierConfigJson, 'verifierConfigJson');
  const acc = new Set<string>();

  addKnownAddresses(parsed.verifierAddress, acc);
  addKnownAddresses(parsed.verifierAddresses, acc);
  addKnownAddresses(parsed.oracleAddress, acc);
  addKnownAddresses(parsed.oracleAddresses, acc);
  addKnownAddresses(parsed.verifiers, acc);
  addKnownAddresses(parsed.oracles, acc);

  const ruleCollections = [parsed.rules, parsed.verifications, parsed.ruleSet];
  for (const collection of ruleCollections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    for (const entry of collection) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }

      const record = entry as Record<string, unknown>;
      addKnownAddresses(record.verifierAddress, acc);
      addKnownAddresses(record.verifierAddresses, acc);
      addKnownAddresses(record.oracleAddress, acc);
      addKnownAddresses(record.oracleAddresses, acc);
      addKnownAddresses(record.verifier, acc);
      addKnownAddresses(record.oracle, acc);
      addKnownAddresses(record.verifiers, acc);
      addKnownAddresses(record.oracles, acc);
    }
  }

  return Array.from(acc);
}

function normalizeEvidenceInput(value: string | Record<string, unknown> | null | undefined) {
  return normalizeJsonInput(value ?? null, 'evidenceJson', false);
}

function assertSompiString(value: string | null | undefined, fieldName: string, required = true) {
  if (value == null || value === '') {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return null;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`${fieldName} must be a decimal sompi string`);
  }

  return value;
}

function normalizeIsoTimestamp(value: string | null | undefined, fieldName: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  const millis = Date.parse(normalized);
  if (!Number.isFinite(millis)) {
    throw new Error(`${fieldName} must be a valid ISO timestamp`);
  }

  return new Date(millis).toISOString();
}

function normalizeExecutionSignature(value: string | null | undefined, fieldName: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  if (normalized.length < 16) {
    throw new Error(`${fieldName} must look like a real signature`);
  }
  return normalized;
}

function validateExecutionPayload(
  payloadJson: string,
  expected: {
    action: 'release' | 'slash';
    bondId: string;
    publicId: string;
    resolutionTxHash: string;
    slashAmountSompi?: string | null;
    reason?: string | null;
  },
) {
  const payload = parseJsonObject(payloadJson, 'executionPayloadJson');

  if (payload.action !== expected.action) {
    throw new Error(`executionPayloadJson.action must be ${expected.action}`);
  }
  if (payload.bondId !== expected.bondId && payload.bondId !== expected.publicId) {
    throw new Error('executionPayloadJson.bondId must match the target bond');
  }
  if (payload.publicId != null && payload.publicId !== expected.publicId) {
    throw new Error('executionPayloadJson.publicId must match the target bond');
  }
  if (payload.resolutionTxHash !== expected.resolutionTxHash) {
    throw new Error('executionPayloadJson.resolutionTxHash must match resolutionTxHash');
  }
  if (expected.action === 'slash') {
    if (payload.reason !== expected.reason) {
      throw new Error('executionPayloadJson.reason must match reason');
    }
    if (payload.slashAmountSompi !== expected.slashAmountSompi) {
      throw new Error('executionPayloadJson.slashAmountSompi must match slashAmountSompi');
    }
  }

  return payload;
}

function rowToRegisteredApp(row: any): RegisteredAppRecord {
  return {
    appId: String(row.app_id),
    name: String(row.name),
    contact: row.contact ?? null,
    webhookUrl: row.webhook_url ?? null,
    defaultUseCaseTemplate: String(row.default_use_case_template),
    totalBonds: Number(row.total_bonds),
    totalVolumeSompi: String(row.total_volume_sompi),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToBond(row: any): KsbBondRecord {
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    appId: String(row.app_id),
    useCaseTemplate: String(row.use_case_template),
    providerAddress: String(row.provider_address),
    counterpartyAddress: String(row.counterparty_address),
    bondAmountSompi: String(row.bond_amount_sompi),
    paymentAmountSompi: row.payment_amount_sompi == null ? null : String(row.payment_amount_sompi),
    deadlineUnix: Number(row.deadline_unix),
    verifierConfigJson: String(row.verifier_config_json),
    slashDistributionJson: String(row.slash_distribution_json),
    status: row.status,
    externalRef: row.external_ref ?? null,
    covenantScriptVersion: row.covenant_script_version ?? null,
    covenantArtifactRef: row.covenant_artifact_ref ?? null,
    covenantArgsJson: row.covenant_args_json ?? null,
    covenantUtxo: row.covenant_utxo ?? null,
    lockTxHash: row.lock_tx_hash ?? null,
    resolutionTxHash: row.resolution_tx_hash ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    resolvedAt: row.resolved_at ?? null,
  };
}

function rowToVerification(row: any): KsbVerificationRecord {
  return {
    id: String(row.id),
    bondId: String(row.bond_id),
    ruleName: String(row.rule_name),
    result: String(row.result),
    evidenceJson: row.evidence_json ?? null,
    verifierSignature: String(row.verifier_signature),
    verifiedAt: String(row.verified_at),
  };
}

function rowToVerifierRule(row: any): KsbVerifierRuleRecord {
  return {
    name: String(row.name),
    description: String(row.description),
    schemaJson: String(row.schema_json),
    verifierType: String(row.verifier_type),
    defaultTimeoutMs: Number(row.default_timeout_ms),
    createdAt: String(row.created_at),
    source: 'custom',
  };
}

function rowToSlashingEvent(row: any): KsbSlashingEventRecord {
  return {
    id: String(row.id),
    bondId: String(row.bond_id),
    reason: String(row.reason),
    slashAmountSompi: String(row.slash_amount_sompi),
    distributionJson: String(row.distribution_json),
    slashTxHash: String(row.slash_tx_hash),
    createdAt: String(row.created_at),
  };
}

function rowToBondEvent(row: any): KsbBondEventRecord {
  return {
    id: String(row.id),
    bondId: String(row.bond_id),
    eventType: String(row.event_type),
    actorType: String(row.actor_type),
    actorId: row.actor_id ?? null,
    summary: String(row.summary),
    dataJson: row.data_json ?? null,
    createdAt: String(row.created_at),
  };
}

function addSompiStrings(a: string, b: string) {
  return (BigInt(a || '0') + BigInt(b || '0')).toString();
}

async function addKsbBondEvent(
  db: any,
  bondId: string,
  eventType: string,
  actorType: string,
  actorId: string | null,
  summary: string,
  dataJson?: string | null,
) {
  await (db as any).$client.execute({
    sql: `
      INSERT INTO ksb_bond_events (
        id, bond_id, event_type, actor_type, actor_id, summary, data_json
      ) VALUES (
        :id, :bondId, :eventType, :actorType, :actorId, :summary, :dataJson
      )
    `,
    args: {
      id: randomUUID(),
      bondId,
      eventType,
      actorType,
      actorId,
      summary,
      dataJson: dataJson ?? null,
    },
  });
}

async function ensureVerifierRule(db: any, rule: { ruleName: string; verifierType: string; description: string; schemaJson: string }) {
  await (db as any).$client.execute({
    sql: `
      INSERT INTO ksb_verifier_rules (
        name, description, schema_json, verifier_type, default_timeout_ms
      ) VALUES (
        :name, :description, :schemaJson, :verifierType, :defaultTimeoutMs
      )
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description,
        schema_json = excluded.schema_json,
        verifier_type = excluded.verifier_type
    `,
    args: {
      name: rule.ruleName,
      description: rule.description,
      schemaJson: rule.schemaJson,
      verifierType: rule.verifierType,
      defaultTimeoutMs: 300000,
    },
  });
}

async function upsertKsbPartyResolution(
  db: any,
  bond: KsbBondRecord,
  outcome: 'released' | 'slashed',
  slashAmountSompi?: string,
) {
  const roles = [
    { address: bond.providerAddress, role: 'provider' },
    { address: bond.counterpartyAddress, role: 'counterparty' },
  ] as const;

  for (const entry of roles) {
    await (db as any).$client.execute({
      sql: `
        INSERT INTO ksb_party_history (
          address, app_id, role, total_bonded_sompi, bonds_released, bonds_slashed, total_slashed_value_sompi
        ) VALUES (
          :address, :appId, :role, '0', :bondsReleased, :bondsSlashed, :totalSlashedValueSompi
        )
        ON CONFLICT(address, app_id, role) DO UPDATE SET
          bonds_released = ksb_party_history.bonds_released + :bondsReleased,
          bonds_slashed = ksb_party_history.bonds_slashed + :bondsSlashed,
          total_slashed_value_sompi = CAST(CAST(ksb_party_history.total_slashed_value_sompi AS INTEGER) + CAST(:totalSlashedValueSompi AS INTEGER) AS TEXT),
          last_updated = CURRENT_TIMESTAMP
      `,
      args: {
        address: entry.address,
        appId: bond.appId,
        role: entry.role,
        bondsReleased: outcome === 'released' ? 1 : 0,
        bondsSlashed: outcome === 'slashed' ? 1 : 0,
        totalSlashedValueSompi: outcome === 'slashed' ? slashAmountSompi ?? '0' : '0',
      },
    });
  }
}

async function upsertKsbPartyBondedAmount(
  db: any,
  bond: Pick<KsbBondRecord, 'appId' | 'providerAddress' | 'counterpartyAddress' | 'bondAmountSompi' | 'verifierConfigJson'>,
) {
  const verifierAddresses = extractVerifierAddresses(bond.verifierConfigJson);
  const participants = [
    { address: bond.providerAddress, role: 'provider' as const },
    { address: bond.counterpartyAddress, role: 'counterparty' as const },
    ...verifierAddresses.map((address) => ({ address, role: 'verifier' as const })),
  ];

  for (const entry of participants) {
    await (db as any).$client.execute({
      sql: `
        INSERT INTO ksb_party_history (
          address, app_id, role, total_bonded_sompi, bonds_released, bonds_slashed, total_slashed_value_sompi
        ) VALUES (
          :address, :appId, :role, :bondAmountSompi, 0, 0, '0'
        )
        ON CONFLICT(address, app_id, role) DO UPDATE SET
          total_bonded_sompi = CAST(CAST(ksb_party_history.total_bonded_sompi AS INTEGER) + CAST(:bondAmountSompi AS INTEGER) AS TEXT),
          last_updated = CURRENT_TIMESTAMP
      `,
      args: {
        address: entry.address,
        appId: bond.appId,
        role: entry.role,
        bondAmountSompi: bond.bondAmountSompi,
      },
    });
  }
}

export async function registerApp(db: any, input: RegisterAppInput): Promise<RegisteredAppSecret> {
  const normalizedName = input.name?.trim();
  if (!normalizedName) {
    throw new Error('App name is required');
  }

  const appId = makeAppId();
  const apiKey = makeApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  await (db as any).$client.execute({
    sql: `
      INSERT INTO ksb_registered_apps (
        app_id,
        name,
        contact,
        webhook_url,
        api_key_hash,
        default_use_case_template
      ) VALUES (
        :appId,
        :name,
        :contact,
        :webhookUrl,
        :apiKeyHash,
        :defaultUseCaseTemplate
      )
    `,
    args: {
      appId,
      name: normalizedName,
      contact: input.contact ?? null,
      webhookUrl: input.webhookUrl ?? null,
      apiKeyHash,
      defaultUseCaseTemplate: input.defaultUseCaseTemplate ?? 'custom',
    },
  });

  const result = await (db as any).$client.execute({
    sql: `SELECT * FROM ksb_registered_apps WHERE app_id = :appId LIMIT 1`,
    args: { appId },
  });

  return {
    app: rowToRegisteredApp(result.rows[0]),
    apiKey,
  };
}

export async function authenticateAppApiKey(db: any, apiKey: string): Promise<RegisteredAppRecord> {
  const normalized = apiKey.trim();
  if (!normalized) {
    throw new Error('API key is required');
  }

  const result = await (db as any).$client.execute({
    sql: `SELECT * FROM ksb_registered_apps WHERE api_key_hash = :apiKeyHash LIMIT 1`,
    args: { apiKeyHash: hashApiKey(normalized) },
  });

  const row = result.rows[0];
  if (!row) {
    throw new Error('Invalid API key');
  }

  return rowToRegisteredApp(row);
}

export async function createKsbBond(db: any, appId: string, input: CreateKsbBondInput): Promise<KsbBondDetail> {
  const providerAddress = input.providerAddress?.trim();
  const counterpartyAddress = input.counterpartyAddress?.trim();
  if (!providerAddress) {
    throw new Error('providerAddress is required');
  }
  if (!counterpartyAddress) {
    throw new Error('counterpartyAddress is required');
  }
  if (!Number.isFinite(input.deadlineUnix)) {
    throw new Error('deadlineUnix must be a valid number');
  }

  const bondAmountSompi = assertSompiString(input.bondAmountSompi, 'bondAmountSompi');
  const paymentAmountSompi = assertSompiString(input.paymentAmountSompi ?? null, 'paymentAmountSompi', false);
  const verifierConfigJson = normalizeJsonInput(input.verifierConfigJson, 'verifierConfigJson', true)!;
  const slashDistributionJson = normalizeJsonInput(input.slashDistributionJson, 'slashDistributionJson', true)!;
  const covenantArgsJson = normalizeJsonInput(input.covenantArgsJson ?? null, 'covenantArgsJson', false);
  validateDistributionJson(slashDistributionJson);

  const appResult = await (db as any).$client.execute({
    sql: `SELECT * FROM ksb_registered_apps WHERE app_id = :appId LIMIT 1`,
    args: { appId },
  });
  const appRow = appResult.rows[0];
  if (!appRow) {
    throw new Error(`Registered app not found: ${appId}`);
  }

  const bondId = randomUUID();
  const publicId = makeBondPublicId();
  const useCaseTemplate = input.useCaseTemplate ?? rowToRegisteredApp(appRow).defaultUseCaseTemplate;

  await (db as any).$client.execute({
    sql: `
      INSERT INTO ksb_bonds (
        id,
        public_id,
        app_id,
        use_case_template,
        provider_address,
        counterparty_address,
        bond_amount_sompi,
        payment_amount_sompi,
        deadline_unix,
        verifier_config_json,
        slash_distribution_json,
        status,
        external_ref,
        covenant_script_version,
        covenant_artifact_ref,
        covenant_args_json,
        covenant_utxo,
        lock_tx_hash
      ) VALUES (
        :id,
        :publicId,
        :appId,
        :useCaseTemplate,
        :providerAddress,
        :counterpartyAddress,
        :bondAmountSompi,
        :paymentAmountSompi,
        :deadlineUnix,
        :verifierConfigJson,
        :slashDistributionJson,
        'proposed',
        :externalRef,
        :covenantScriptVersion,
        :covenantArtifactRef,
        :covenantArgsJson,
        :covenantUtxo,
        :lockTxHash
      )
    `,
    args: {
      id: bondId,
      publicId,
      appId,
      useCaseTemplate,
      providerAddress,
      counterpartyAddress,
      bondAmountSompi,
      paymentAmountSompi,
      deadlineUnix: input.deadlineUnix,
      verifierConfigJson,
      slashDistributionJson,
      externalRef: input.externalRef ?? null,
      covenantScriptVersion: input.covenantScriptVersion ?? null,
      covenantArtifactRef: input.covenantArtifactRef ?? null,
      covenantArgsJson,
      covenantUtxo: input.covenantUtxo ?? null,
      lockTxHash: input.lockTxHash ?? null,
    },
  });

  await (db as any).$client.execute({
    sql: `
      UPDATE ksb_registered_apps
      SET
        total_bonds = total_bonds + 1,
        total_volume_sompi = CAST(CAST(total_volume_sompi AS INTEGER) + CAST(:bondAmountSompi AS INTEGER) AS TEXT)
      WHERE app_id = :appId
    `,
    args: { appId, bondAmountSompi },
  });

  await addKsbBondEvent(
    db,
    bondId,
    'bond_created',
    'app',
    appId,
    'KSB bond proposed',
    JSON.stringify({ useCaseTemplate, externalRef: input.externalRef ?? null }),
  );

  await upsertKsbPartyBondedAmount(db, {
    appId,
    providerAddress,
    counterpartyAddress,
    bondAmountSompi: bondAmountSompi!,
    verifierConfigJson,
  });

  return getKsbBondDetail(db, publicId);
}

export async function listKsbBonds(
  db: any,
  filters: {
    appId?: string | null;
    providerAddress?: string | null;
    counterpartyAddress?: string | null;
    status?: string | null;
    limit?: number;
  },
): Promise<KsbBondRecord[]> {
  const clauses: string[] = [];
  const args: Record<string, unknown> = {};

  if (filters.appId) {
    clauses.push('app_id = :appId');
    args.appId = filters.appId;
  }
  if (filters.providerAddress) {
    clauses.push('provider_address = :providerAddress');
    args.providerAddress = filters.providerAddress;
  }
  if (filters.counterpartyAddress) {
    clauses.push('counterparty_address = :counterpartyAddress');
    args.counterpartyAddress = filters.counterpartyAddress;
  }
  if (filters.status) {
    clauses.push('status = :status');
    args.status = filters.status;
  }

  args.limit = filters.limit ?? 50;
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const result = await (db as any).$client.execute({
    sql: `SELECT * FROM ksb_bonds ${where} ORDER BY created_at DESC LIMIT :limit`,
    args,
  });

  return result.rows.map(rowToBond);
}

export async function listKsbVerifierRules(db: any): Promise<KsbVerifierRuleRecord[]> {
  const result = await (db as any).$client.execute({
    sql: `SELECT * FROM ksb_verifier_rules ORDER BY name ASC`,
    args: {},
  });

  // The protocol catalog of built-in rules is always present. Custom rules
  // stored by apps are merged in, and a custom row never shadows a built-in
  // rule of the same name.
  const customRules = result.rows
    .map(rowToVerifierRule)
    .filter((rule: KsbVerifierRuleRecord) => !isBuiltInVerifierRule(rule.name));

  return [...BUILT_IN_VERIFIER_RULES, ...customRules].sort((a, b) => a.name.localeCompare(b.name));
}

function parseVerifierRuleSpecs(verifierConfigJson: string): RuleSpec[] {
  return collectRuleSpecs(parseRuleSetConfig(verifierConfigJson));
}

interface CustomVerifierBinding {
  webhookUrl: string;
  verifierPublicKey: string | null;
  defaultTimeoutMs: number;
}

function rowToRegisteredVerifierRule(verifierRow: any, ruleRow: any): RegisteredVerifierRule {
  return {
    name: String(verifierRow.rule_name),
    appId: String(verifierRow.app_id),
    description: String(ruleRow.description),
    verifierType: 'webhook',
    webhookUrl: String(verifierRow.webhook_url),
    verifierPublicKey: verifierRow.verifier_public_key ?? null,
    defaultTimeoutMs: Number(ruleRow.default_timeout_ms),
    schemaJson: String(ruleRow.schema_json),
    createdAt: String(verifierRow.created_at),
    updatedAt: String(verifierRow.updated_at),
  };
}

/**
 * Register a custom verifier: a named rule bound to an app-owned signed
 * webhook. The rule definition is stored in `ksb_verifier_rules` and the
 * webhook binding in `ksb_custom_verifiers`. Built-in rule names are reserved,
 * and a rule already owned by another app cannot be reclaimed.
 */
export async function registerCustomVerifier(
  db: any,
  appId: string,
  input: RegisterVerifierRuleInput,
): Promise<RegisteredVerifierRule> {
  const name = input.name?.trim();
  if (!name) {
    throw new Error('Verifier rule name is required');
  }
  if (!/^[a-z0-9_]+$/i.test(name)) {
    throw new Error('Verifier rule name must contain only letters, digits, and underscores');
  }
  if (isBuiltInVerifierRule(name)) {
    throw new Error(`"${name}" is a built-in protocol rule and cannot be registered as a custom verifier`);
  }

  const webhookUrl = input.webhookUrl?.trim();
  if (!webhookUrl) {
    throw new Error('webhookUrl is required');
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    throw new Error('webhookUrl must be a valid absolute URL');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('webhookUrl must use http or https');
  }

  const verifierPublicKey = input.verifierPublicKey?.trim() || null;
  const description = input.description?.trim() || `Custom webhook verifier registered by ${appId}`;
  const schemaJson = normalizeJsonInput(input.schemaJson ?? null, 'schemaJson', false) ?? '{}';
  const defaultTimeoutMs = Number.isFinite(Number(input.defaultTimeoutMs)) && Number(input.defaultTimeoutMs) > 0
    ? Math.min(Math.floor(Number(input.defaultTimeoutMs)), 120000)
    : 30000;

  const appResult = await (db as any).$client.execute({
    sql: `SELECT app_id FROM ksb_registered_apps WHERE app_id = :appId LIMIT 1`,
    args: { appId },
  });
  if (!appResult.rows[0]) {
    throw new Error(`Registered app not found: ${appId}`);
  }

  const ownerResult = await (db as any).$client.execute({
    sql: `SELECT app_id FROM ksb_custom_verifiers WHERE rule_name = :name LIMIT 1`,
    args: { name },
  });
  const existingOwner = ownerResult.rows[0];
  if (existingOwner && String(existingOwner.app_id) !== appId) {
    throw new Error(`Verifier rule "${name}" is already registered by another app`);
  }

  // The rule definition row satisfies the ksb_custom_verifiers foreign key.
  await (db as any).$client.execute({
    sql: `
      INSERT INTO ksb_verifier_rules (name, description, schema_json, verifier_type, default_timeout_ms)
      VALUES (:name, :description, :schemaJson, 'webhook', :defaultTimeoutMs)
      ON CONFLICT(name) DO UPDATE SET
        description = excluded.description,
        schema_json = excluded.schema_json,
        verifier_type = 'webhook',
        default_timeout_ms = excluded.default_timeout_ms
    `,
    args: { name, description, schemaJson, defaultTimeoutMs },
  });

  await (db as any).$client.execute({
    sql: `
      INSERT INTO ksb_custom_verifiers (rule_name, app_id, webhook_url, verifier_public_key)
      VALUES (:name, :appId, :webhookUrl, :verifierPublicKey)
      ON CONFLICT(rule_name) DO UPDATE SET
        webhook_url = excluded.webhook_url,
        verifier_public_key = excluded.verifier_public_key
    `,
    args: { name, appId, webhookUrl, verifierPublicKey },
  });

  const [verifierResult, ruleResult] = await Promise.all([
    (db as any).$client.execute({ sql: `SELECT * FROM ksb_custom_verifiers WHERE rule_name = :name LIMIT 1`, args: { name } }),
    (db as any).$client.execute({ sql: `SELECT * FROM ksb_verifier_rules WHERE name = :name LIMIT 1`, args: { name } }),
  ]);

  return rowToRegisteredVerifierRule(verifierResult.rows[0], ruleResult.rows[0]);
}

/** Load the webhook bindings for a set of rule names, keyed by rule name. */
async function getCustomVerifierMap(db: any, ruleNames: string[]): Promise<Map<string, CustomVerifierBinding>> {
  const map = new Map<string, CustomVerifierBinding>();
  const names = Array.from(new Set(ruleNames.filter(Boolean)));
  if (names.length === 0) {
    return map;
  }

  const placeholders = names.map((_, index) => `:r${index}`).join(', ');
  const args: Record<string, unknown> = {};
  names.forEach((name, index) => {
    args[`r${index}`] = name;
  });

  const result = await (db as any).$client.execute({
    sql: `
      SELECT cv.rule_name, cv.webhook_url, cv.verifier_public_key, vr.default_timeout_ms
      FROM ksb_custom_verifiers cv
      JOIN ksb_verifier_rules vr ON vr.name = cv.rule_name
      WHERE cv.rule_name IN (${placeholders})
    `,
    args,
  });

  for (const row of result.rows) {
    map.set(String(row.rule_name), {
      webhookUrl: String(row.webhook_url),
      verifierPublicKey: row.verifier_public_key ?? null,
      defaultTimeoutMs: Number(row.default_timeout_ms),
    });
  }
  return map;
}

/**
 * Verifier hub dispatch for a single bond.
 *
 * Runs every rule declared in the bond `verifierConfigJson` through the
 * verifier hub, persists the protocol-computed result for each rule, and
 * recomputes the bond status. Runtime inputs supplied by the caller are
 * merged over the static params declared in the config.
 */
export async function dispatchKsbBondVerifications(
  db: any,
  idOrPublicId: string,
  input: DispatchKsbVerificationInput = {},
): Promise<KsbDispatchResult> {
  const detail = await getKsbBondDetail(db, idOrPublicId);
  const bond = detail.bond;

  const dispatchable: KsbBondStatus[] = ['proposed', 'committed', 'active', 'verified', 'failed', 'timed_out'];
  if (!dispatchable.includes(bond.status)) {
    throw new Error(`Verifier dispatch is not allowed from status ${bond.status}`);
  }

  const specs = parseVerifierRuleSpecs(bond.verifierConfigJson);
  if (specs.length === 0) {
    throw new Error('verifierConfigJson declares no verifier rules to dispatch');
  }

  const customVerifiers = await getCustomVerifierMap(db, specs.map((spec) => spec.ruleName));

  const inputMap = new Map<string, Record<string, unknown>>();
  for (const entry of input.inputs ?? []) {
    const name = entry.ruleName?.trim();
    if (name) {
      inputMap.set(name, entry.params && typeof entry.params === 'object' && !Array.isArray(entry.params) ? entry.params : {});
    }
  }

  const ctx = { deadlineUnix: bond.deadlineUnix };
  const outcomes: KsbVerifierRuleOutcome[] = [];

  for (const spec of specs) {
    const custom = customVerifiers.get(spec.ruleName);

    // Registered custom verifiers already own their ksb_verifier_rules row;
    // only synthesize a row for built-in or config-declared rules.
    if (!custom) {
      await ensureVerifierRule(db, {
        ruleName: spec.ruleName,
        verifierType: spec.verifierType,
        description: spec.description,
        schemaJson: spec.schemaJson,
      });
    }

    const params = { ...spec.params, ...(inputMap.get(spec.ruleName) ?? {}) };
    const verifierType = custom ? 'webhook' : spec.verifierType;
    const startedAt = Date.now();
    const execution = custom
      ? await executeWebhookVerifier(
          { webhookUrl: custom.webhookUrl, verifierPublicKey: custom.verifierPublicKey, timeoutMs: custom.defaultTimeoutMs },
          { bondId: bond.id, publicId: bond.publicId, ruleName: spec.ruleName, deadlineUnix: bond.deadlineUnix, params },
        )
      : await executeVerifierRule(spec.ruleName, params, ctx);
    const durationMs = Date.now() - startedAt;
    const evidenceJson = JSON.stringify({
      ...execution.evidence,
      dispatchedAt: new Date().toISOString(),
      durationMs,
    });

    outcomes.push({
      ruleName: spec.ruleName,
      verifierType,
      result: execution.result,
      evidenceJson,
      durationMs,
    });

    const existing = detail.verifications.find((verification) => verification.ruleName === spec.ruleName) ?? null;
    if (existing) {
      await (db as any).$client.execute({
        sql: `
          UPDATE ksb_verifications
          SET result = :result, evidence_json = :evidenceJson, verifier_signature = 'ksb-hub', verified_at = CURRENT_TIMESTAMP
          WHERE id = :id
        `,
        args: { id: existing.id, result: execution.result, evidenceJson },
      });
      continue;
    }

    await (db as any).$client.execute({
      sql: `
        INSERT INTO ksb_verifications (
          id, bond_id, rule_name, result, evidence_json, verifier_signature
        ) VALUES (
          :id, :bondId, :ruleName, :result, :evidenceJson, 'ksb-hub'
        )
      `,
      args: { id: randomUUID(), bondId: bond.id, ruleName: spec.ruleName, result: execution.result, evidenceJson },
    });
  }

  const refreshed = await getKsbBondDetail(db, bond.id);
  const resultsByRule: Record<string, string> = {};
  for (const verification of refreshed.verifications) {
    resultsByRule[verification.ruleName] = verification.result;
  }
  const statusAfter = evaluateBondStatus(bond.verifierConfigJson, resultsByRule);

  if (statusAfter !== bond.status) {
    await (db as any).$client.execute({
      sql: `UPDATE ksb_bonds SET status = :status WHERE id = :bondId`,
      args: { status: statusAfter, bondId: bond.id },
    });
  }

  await addKsbBondEvent(
    db,
    bond.id,
    'verifiers_dispatched',
    input.actorId ? 'operator' : 'system',
    input.actorId?.trim() || null,
    input.summary?.trim() || 'Verifier hub dispatched configured rules',
    JSON.stringify({
      from: bond.status,
      to: statusAfter,
      outcomes: outcomes.map((outcome) => ({ ruleName: outcome.ruleName, result: outcome.result, durationMs: outcome.durationMs })),
    }),
  );

  return {
    bond: await getKsbBondDetail(db, bond.id),
    statusBefore: bond.status,
    statusAfter,
    outcomes,
  };
}

/**
 * Cron entry point: dispatch verifier rules for every in-progress bond.
 *
 * Bonds whose rules need runtime inputs that are not embedded in the config
 * stay in their current status until those inputs arrive. Bonds with no
 * dispatchable rules are skipped.
 */
export async function dispatchPendingKsbVerifications(db: any): Promise<KsbCronRunResult> {
  const bondsResult = await (db as any).$client.execute({
    sql: `
      SELECT id, public_id
      FROM ksb_bonds
      WHERE status IN ('committed', 'active')
      ORDER BY updated_at ASC
      LIMIT 100
    `,
    args: {},
  });

  const bondIds: string[] = [];
  for (const row of bondsResult.rows) {
    try {
      const result = await dispatchKsbBondVerifications(db, String(row.id), { summary: 'Scheduled verifier dispatch' });
      if (result.statusAfter !== result.statusBefore) {
        bondIds.push(String(row.public_id));
      }
    } catch {
      // Bonds with no dispatchable rules or a transient failure are skipped;
      // the cron stays idempotent and retries them on the next run.
    }
  }

  return {
    action: 'dispatch-verifiers',
    scanned: bondsResult.rows.length,
    updated: bondIds.length,
    bondIds,
    at: new Date().toISOString(),
  };
}

export async function getKsbBondDetail(db: any, idOrPublicId: string): Promise<KsbBondDetail> {
  const bondResult = await (db as any).$client.execute({
    sql: `SELECT * FROM ksb_bonds WHERE id = :idOrPublicId OR public_id = :idOrPublicId LIMIT 1`,
    args: { idOrPublicId },
  });

  const bondRow = bondResult.rows[0];
  if (!bondRow) {
    throw new Error(`KSB bond not found: ${idOrPublicId}`);
  }

  const bond = rowToBond(bondRow);
  const [appResult, verificationResult, slashingResult, eventResult] = await Promise.all([
    (db as any).$client.execute({ sql: `SELECT * FROM ksb_registered_apps WHERE app_id = :appId LIMIT 1`, args: { appId: bond.appId } }),
    (db as any).$client.execute({ sql: `SELECT * FROM ksb_verifications WHERE bond_id = :bondId ORDER BY verified_at ASC`, args: { bondId: bond.id } }),
    (db as any).$client.execute({ sql: `SELECT * FROM ksb_slashing_events WHERE bond_id = :bondId LIMIT 1`, args: { bondId: bond.id } }),
    (db as any).$client.execute({ sql: `SELECT * FROM ksb_bond_events WHERE bond_id = :bondId ORDER BY created_at ASC`, args: { bondId: bond.id } }),
  ]);

  return {
    bond,
    app: appResult.rows[0] ? rowToRegisteredApp(appResult.rows[0]) : null,
    verifications: verificationResult.rows.map(rowToVerification),
    slashingEvent: slashingResult.rows[0] ? rowToSlashingEvent(slashingResult.rows[0]) : null,
    events: eventResult.rows.map(rowToBondEvent),
  };
}

export async function getKsbBondStatusView(db: any, idOrPublicId: string): Promise<KsbBondStatusView> {
  const detail = await getKsbBondDetail(db, idOrPublicId);
  const { bond, verifications, events } = detail;

  const summary = verifications.reduce(
    (acc, verification) => {
      acc.total += 1;
      if (verification.result === 'pending') acc.pending += 1;
      if (verification.result === 'passed') acc.passed += 1;
      if (verification.result === 'failed') acc.failed += 1;
      if (verification.result === 'timed_out') acc.timedOut += 1;
      if (verification.result === 'contested') acc.contested += 1;
      return acc;
    },
    { total: 0, pending: 0, passed: 0, failed: 0, timedOut: 0, contested: 0 },
  );

  return {
    bondId: bond.id,
    publicId: bond.publicId,
    appId: bond.appId,
    useCaseTemplate: bond.useCaseTemplate,
    status: bond.status,
    providerAddress: bond.providerAddress,
    counterpartyAddress: bond.counterpartyAddress,
    deadlineUnix: bond.deadlineUnix,
    lockTxHash: bond.lockTxHash,
    resolutionTxHash: bond.resolutionTxHash,
    resolvedAt: bond.resolvedAt,
    updatedAt: bond.updatedAt,
    verificationSummary: summary,
    lastEvent: events.length ? events[events.length - 1] : null,
  };
}

export async function submitKsbBondProof(db: any, idOrPublicId: string, input: SubmitKsbBondProofInput): Promise<KsbBondDetail> {
  const detail = await getKsbBondDetail(db, idOrPublicId);
  const bond = detail.bond;

  if (!['proposed', 'committed', 'active', 'verified', 'failed'].includes(bond.status)) {
    throw new Error(`Proof submission is not allowed from status ${bond.status}`);
  }

  const configuredRules = parseVerifierRuleSpecs(bond.verifierConfigJson);
  const submittedRules = (input.verifications ?? []).map((entry) => ({
    ruleName: entry.ruleName?.trim(),
    result: entry.result ?? 'pending',
    evidenceJson: normalizeEvidenceInput(entry.evidenceJson),
    verifierSignature: entry.verifierSignature?.trim() || 'pending',
  })).filter((entry) => entry.ruleName);

  const ruleMap = new Map<string, { ruleName: string; verifierType: string; description: string; schemaJson: string }>();
  for (const rule of configuredRules) {
    ruleMap.set(rule.ruleName, rule);
  }
  for (const rule of submittedRules) {
    if (!ruleMap.has(rule.ruleName)) {
      ruleMap.set(rule.ruleName, {
        ruleName: rule.ruleName,
        verifierType: 'custom',
        description: 'Rule first seen during proof submission',
        schemaJson: '{}',
      });
    }
  }

  if (ruleMap.size === 0) {
    throw new Error('No verifier rules found in verifierConfigJson or submit payload');
  }

  const submittedBy = input.submittedBy?.trim() || null;
  const proofJson = normalizeJsonInput(input.proofJson ?? null, 'proofJson', false);

  for (const rule of ruleMap.values()) {
    await ensureVerifierRule(db, rule);
  }

  for (const rule of ruleMap.values()) {
    const submitted = submittedRules.find((entry) => entry.ruleName === rule.ruleName) ?? null;
    const existing = detail.verifications.find((entry) => entry.ruleName === rule.ruleName) ?? null;

    if (existing) {
      await (db as any).$client.execute({
        sql: `
          UPDATE ksb_verifications
          SET
            result = :result,
            evidence_json = :evidenceJson,
            verifier_signature = :verifierSignature,
            verified_at = CURRENT_TIMESTAMP
          WHERE id = :id
        `,
        args: {
          id: existing.id,
          result: submitted?.result ?? existing.result,
          evidenceJson: submitted?.evidenceJson ?? existing.evidenceJson,
          verifierSignature: submitted?.verifierSignature ?? existing.verifierSignature,
        },
      });
      continue;
    }

    await (db as any).$client.execute({
      sql: `
        INSERT INTO ksb_verifications (
          id, bond_id, rule_name, result, evidence_json, verifier_signature
        ) VALUES (
          :id, :bondId, :ruleName, :result, :evidenceJson, :verifierSignature
        )
      `,
      args: {
        id: randomUUID(),
        bondId: bond.id,
        ruleName: rule.ruleName,
        result: submitted?.result ?? 'pending',
        evidenceJson: submitted?.evidenceJson ?? null,
        verifierSignature: submitted?.verifierSignature ?? 'pending',
      },
    });
  }

  const resultsByRule: Record<string, string> = {};
  for (const rule of ruleMap.values()) {
    resultsByRule[rule.ruleName] = submittedRules.find((entry) => entry.ruleName === rule.ruleName)?.result
      ?? detail.verifications.find((entry) => entry.ruleName === rule.ruleName)?.result
      ?? 'pending';
  }
  const nextStatus = evaluateBondStatus(bond.verifierConfigJson, resultsByRule);

  await (db as any).$client.execute({
    sql: `UPDATE ksb_bonds SET status = :status WHERE id = :bondId`,
    args: { status: nextStatus, bondId: bond.id },
  });

  await addKsbBondEvent(
    db,
    bond.id,
    'proof_submitted',
    submittedBy ? 'party' : 'system',
    submittedBy,
    input.summary?.trim() || 'Proof submitted for verification',
    JSON.stringify({ proofJson: proofJson ? JSON.parse(proofJson) : null, submittedRules: submittedRules.map((entry) => ({ ruleName: entry.ruleName, result: entry.result })) }),
  );

  return getKsbBondDetail(db, bond.id);
}

export async function contestKsbBond(db: any, idOrPublicId: string, input: ContestKsbBondInput): Promise<KsbBondDetail> {
  const detail = await getKsbBondDetail(db, idOrPublicId);
  const bond = detail.bond;

  if (!['verified', 'failed', 'timed_out', 'contested', 'arbitration'].includes(bond.status)) {
    throw new Error(`Contest is not allowed from status ${bond.status}`);
  }

  const normalizedRuleNames = (input.ruleNames ?? []).map((name) => name.trim()).filter(Boolean);
  const matchingVerifications = normalizedRuleNames.length
    ? detail.verifications.filter((verification) => normalizedRuleNames.includes(verification.ruleName))
    : detail.verifications;

  if (normalizedRuleNames.length && matchingVerifications.length === 0) {
    throw new Error('No matching verification rules found for contest');
  }

  for (const verification of matchingVerifications) {
    await (db as any).$client.execute({
      sql: `
        UPDATE ksb_verifications
        SET
          result = 'contested',
          evidence_json = COALESCE(:evidenceJson, evidence_json),
          verified_at = CURRENT_TIMESTAMP
        WHERE id = :id
      `,
      args: {
        id: verification.id,
        evidenceJson: normalizeEvidenceInput(input.evidenceJson),
      },
    });
  }

  const nextStatus = input.moveToArbitration ? 'arbitration' : 'contested';
  await (db as any).$client.execute({
    sql: `UPDATE ksb_bonds SET status = :status WHERE id = :bondId`,
    args: { status: nextStatus, bondId: bond.id },
  });

  const submittedBy = input.submittedBy?.trim() || null;
  await addKsbBondEvent(
    db,
    bond.id,
    input.moveToArbitration ? 'bond_sent_to_arbitration' : 'bond_contested',
    submittedBy ? 'party' : 'system',
    submittedBy,
    input.summary?.trim() || (input.moveToArbitration ? 'Bond moved to arbitration' : 'Bond outcome contested'),
    JSON.stringify({
      reason: input.reason?.trim() || null,
      ruleNames: normalizedRuleNames,
      evidenceJson: input.evidenceJson ?? null,
    }),
  );

  return getKsbBondDetail(db, bond.id);
}

export async function recordKsbReleaseExecution(
  db: any,
  idOrPublicId: string,
  input: RecordKsbReleaseExecutionInput,
): Promise<KsbBondDetail> {
  const txHash = input.resolutionTxHash?.trim();
  if (!txHash) {
    throw new Error('resolutionTxHash is required');
  }

  const executionPayloadJson = normalizeJsonInput(input.executionPayloadJson, 'executionPayloadJson', true)!;
  const executionSignature = normalizeExecutionSignature(input.executionSignature, 'executionSignature');
  const executionSigner = input.executionSigner?.trim();
  if (!executionSigner) {
    throw new Error('executionSigner is required');
  }
  const executionSignedAt = normalizeIsoTimestamp(input.executionSignedAt, 'executionSignedAt');

  const current = await getKsbBondDetail(db, idOrPublicId);
  if (!['verified', 'released'].includes(current.bond.status)) {
    throw new Error(`Release cannot be recorded from status ${current.bond.status}`);
  }

  validateExecutionPayload(executionPayloadJson, {
    action: 'release',
    bondId: current.bond.id,
    publicId: current.bond.publicId,
    resolutionTxHash: txHash,
  });

  const isFirstResolution = current.bond.status !== 'released';

  await (db as any).$client.execute({
    sql: `
      UPDATE ksb_bonds
      SET status = 'released', resolution_tx_hash = :resolutionTxHash, resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)
      WHERE id = :bondId
    `,
    args: { resolutionTxHash: txHash, bondId: current.bond.id },
  });

  if (isFirstResolution) {
    await upsertKsbPartyResolution(db, current.bond, 'released');
    await addKsbBondEvent(
      db,
      current.bond.id,
      'bond_released',
      'operator',
      input.actorId?.trim() || null,
      input.summary?.trim() || 'Release execution recorded',
      JSON.stringify({ resolutionTxHash: txHash, executionPayloadJson: JSON.parse(executionPayloadJson), executionSignature, executionSigner, executionSignedAt }),
    );
  }

  return getKsbBondDetail(db, current.bond.id);
}

export async function recordKsbSlashExecution(
  db: any,
  idOrPublicId: string,
  input: RecordKsbSlashExecutionInput,
): Promise<KsbBondDetail> {
  const txHash = input.resolutionTxHash?.trim();
  const reason = input.reason?.trim();
  if (!txHash) {
    throw new Error('resolutionTxHash is required');
  }
  if (!reason) {
    throw new Error('reason is required');
  }

  const slashAmountSompi = assertSompiString(input.slashAmountSompi, 'slashAmountSompi');
  const distributionJson = normalizeJsonInput(input.distributionJson, 'distributionJson', true)!;
  const executionPayloadJson = normalizeJsonInput(input.executionPayloadJson, 'executionPayloadJson', true)!;
  const executionSignature = normalizeExecutionSignature(input.executionSignature, 'executionSignature');
  const executionSigner = input.executionSigner?.trim();
  if (!executionSigner) {
    throw new Error('executionSigner is required');
  }
  const executionSignedAt = normalizeIsoTimestamp(input.executionSignedAt, 'executionSignedAt');
  const current = await getKsbBondDetail(db, idOrPublicId);
  if (!['failed', 'timed_out', 'contested', 'arbitration', 'slashed'].includes(current.bond.status)) {
    throw new Error(`Slash cannot be recorded from status ${current.bond.status}`);
  }

  validateExecutionPayload(executionPayloadJson, {
    action: 'slash',
    bondId: current.bond.id,
    publicId: current.bond.publicId,
    resolutionTxHash: txHash,
    slashAmountSompi,
    reason,
  });

  const isFirstResolution = current.bond.status !== 'slashed';

  await (db as any).$client.execute({
    sql: `
      UPDATE ksb_bonds
      SET status = 'slashed', resolution_tx_hash = :resolutionTxHash, resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)
      WHERE id = :bondId
    `,
    args: { resolutionTxHash: txHash, bondId: current.bond.id },
  });

  await (db as any).$client.execute({
    sql: `
      INSERT INTO ksb_slashing_events (
        id, bond_id, reason, slash_amount_sompi, distribution_json, slash_tx_hash
      ) VALUES (
        :id, :bondId, :reason, :slashAmountSompi, :distributionJson, :slashTxHash
      )
      ON CONFLICT(bond_id) DO UPDATE SET
        reason = excluded.reason,
        slash_amount_sompi = excluded.slash_amount_sompi,
        distribution_json = excluded.distribution_json,
        slash_tx_hash = excluded.slash_tx_hash
    `,
    args: {
      id: current.slashingEvent?.id ?? randomUUID(),
      bondId: current.bond.id,
      reason,
      slashAmountSompi,
      distributionJson,
      slashTxHash: txHash,
    },
  });

  if (isFirstResolution) {
    await upsertKsbPartyResolution(db, current.bond, 'slashed', slashAmountSompi ?? '0');
    await addKsbBondEvent(
      db,
      current.bond.id,
      'bond_slashed',
      'operator',
      input.actorId?.trim() || null,
      input.summary?.trim() || 'Slash execution recorded',
      JSON.stringify({ resolutionTxHash: txHash, reason, slashAmountSompi, executionPayloadJson: JSON.parse(executionPayloadJson), executionSignature, executionSigner, executionSignedAt }),
    );
  }

  return getKsbBondDetail(db, current.bond.id);
}

export async function getKsbPartyHistory(db: any, address: string): Promise<KsbPartyHistoryView> {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    throw new Error('address is required');
  }

  const [historyResult, providerBondResult, counterpartyBondResult] = await Promise.all([
    (db as any).$client.execute({
      sql: `
        SELECT h.*, a.name AS app_name
        FROM ksb_party_history h
        LEFT JOIN ksb_registered_apps a ON a.app_id = h.app_id
        WHERE h.address = :address
        ORDER BY h.app_id, h.role
      `,
      args: { address: normalizedAddress },
    }),
    (db as any).$client.execute({
      sql: `
        SELECT public_id, app_id, status, bond_amount_sompi, created_at
        FROM ksb_bonds
        WHERE provider_address = :address
        ORDER BY created_at DESC
        LIMIT 25
      `,
      args: { address: normalizedAddress },
    }),
    (db as any).$client.execute({
      sql: `
        SELECT public_id, app_id, status, bond_amount_sompi, created_at
        FROM ksb_bonds
        WHERE counterparty_address = :address
        ORDER BY created_at DESC
        LIMIT 25
      `,
      args: { address: normalizedAddress },
    }),
  ]);

  const appMap = new Map<string, { appId: string; appName: string | null; roles: Array<any> }>();
  let released = 0;
  let slashed = 0;
  let totalBondedSompi = '0';
  let totalSlashedValueSompi = '0';
  let asVerifier = 0;

  for (const row of historyResult.rows) {
    const appId = String(row.app_id);
    if (!appMap.has(appId)) {
      appMap.set(appId, { appId, appName: row.app_name ?? null, roles: [] });
    }

    const role = String(row.role) as 'provider' | 'counterparty' | 'verifier';
    const roleView = {
      role,
      totalBondedSompi: String(row.total_bonded_sompi),
      bondsReleased: Number(row.bonds_released),
      bondsSlashed: Number(row.bonds_slashed),
      totalSlashedValueSompi: String(row.total_slashed_value_sompi),
      lastUpdated: row.last_updated ? String(row.last_updated) : null,
    };
    appMap.get(appId)!.roles.push(roleView);

    released += roleView.bondsReleased;
    slashed += roleView.bondsSlashed;
    totalBondedSompi = addSompiStrings(totalBondedSompi, roleView.totalBondedSompi);
    totalSlashedValueSompi = addSompiStrings(totalSlashedValueSompi, roleView.totalSlashedValueSompi);
    if (role === 'verifier') asVerifier += roleView.bondsReleased + roleView.bondsSlashed;
  }

  const recentBonds = [
    ...providerBondResult.rows.map((row: any) => ({
      publicId: String(row.public_id),
      appId: String(row.app_id),
      role: 'provider' as const,
      status: row.status,
      bondAmountSompi: String(row.bond_amount_sompi),
      createdAt: String(row.created_at),
    })),
    ...counterpartyBondResult.rows.map((row: any) => ({
      publicId: String(row.public_id),
      appId: String(row.app_id),
      role: 'counterparty' as const,
      status: row.status,
      bondAmountSompi: String(row.bond_amount_sompi),
      createdAt: String(row.created_at),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25);

  const uniqueBonds = new Set(recentBonds.map((bond) => `${bond.role}:${bond.publicId}`));
  const totalBonds = uniqueBonds.size;
  const asProvider = recentBonds.filter((bond) => bond.role === 'provider').length;
  const asCounterparty = recentBonds.filter((bond) => bond.role === 'counterparty').length;
  const active = recentBonds.filter((bond) => ['proposed', 'committed', 'active', 'verified', 'failed', 'timed_out', 'contested', 'arbitration'].includes(bond.status)).length;

  return {
    address: normalizedAddress,
    summary: {
      totalBonds,
      asProvider,
      asCounterparty,
      asVerifier,
      released,
      slashed,
      active,
      totalBondedSompi,
      totalSlashedValueSompi,
    },
    apps: Array.from(appMap.values()),
    recentBonds,
  };
}

export async function getKsbPartyScore(db: any, address: string): Promise<KsbPartyScoreView> {
  const history = await getKsbPartyHistory(db, address);

  let releasedCount = 0;
  let slashedCount = 0;
  let verifierActivityCount = 0;

  const subScores = history.apps.map((app) => {
    let appReleased = 0;
    let appSlashed = 0;
    let appTotalBondedSompi = '0';
    let appTotalSlashedValueSompi = '0';

    for (const role of app.roles) {
      appReleased += role.bondsReleased;
      appSlashed += role.bondsSlashed;
      appTotalBondedSompi = addSompiStrings(appTotalBondedSompi, role.totalBondedSompi);
      appTotalSlashedValueSompi = addSompiStrings(appTotalSlashedValueSompi, role.totalSlashedValueSompi);
      if (role.role === 'verifier') {
        verifierActivityCount += role.bondsReleased + role.bondsSlashed;
      }
    }

    releasedCount += appReleased;
    slashedCount += appSlashed;
    const resolved = appReleased + appSlashed;

    return {
      appId: app.appId,
      appName: app.appName,
      releaseRatio: resolved > 0 ? appReleased / resolved : null,
      slashRatio: resolved > 0 ? appSlashed / resolved : null,
      totalBondedSompi: appTotalBondedSompi,
      totalSlashedValueSompi: appTotalSlashedValueSompi,
      releasedCount: appReleased,
      slashedCount: appSlashed,
    };
  });

  const resolvedCount = releasedCount + slashedCount;

  return {
    address: history.address,
    score: {
      releaseRatio: resolvedCount > 0 ? releasedCount / resolvedCount : null,
      slashRatio: resolvedCount > 0 ? slashedCount / resolvedCount : null,
      activeRiskIndicator: history.summary.totalBonds > 0 ? history.summary.active / history.summary.totalBonds : 0,
      totalBondedSompi: history.summary.totalBondedSompi,
      totalSlashedValueSompi: history.summary.totalSlashedValueSompi,
      releasedCount,
      slashedCount,
      verifierActivityCount,
    },
    subScores,
    compatibility: {
      standard: 'erc-8004-compatible-shape-pending',
      status: 'partial',
    },
  };
}

const KSB_REPUTATION_SCHEMA_VERSION = '0.2';

/**
 * Build an ERC-8004 aligned reputation profile for a party.
 *
 * Re-shapes the party's KSB history and score into validation-registry
 * vocabulary: each resolved bond is one validation, a release is a pass and a
 * slash is a fail. `reputationScore` is the pass rate scaled to 0..100.
 */
export async function getKsbReputationProfile(db: any, address: string): Promise<KsbReputationProfile> {
  const [history, score] = await Promise.all([
    getKsbPartyHistory(db, address),
    getKsbPartyScore(db, address),
  ]);

  const passed = score.score.releasedCount;
  const failed = score.score.slashedCount;
  const resolved = passed + failed;
  const passRate = resolved > 0 ? passed / resolved : null;
  const pending = Math.max(history.summary.totalBonds - resolved, 0);

  const signals: KsbReputationSignal[] = score.subScores.map((sub) => ({
    appId: sub.appId,
    appName: sub.appName,
    validations: sub.releasedCount + sub.slashedCount,
    passed: sub.releasedCount,
    failed: sub.slashedCount,
    passRate: sub.releaseRatio,
  }));

  const recentValidations: KsbReputationValidationRecord[] = history.recentBonds.map((bond) => ({
    bondPublicId: bond.publicId,
    appId: bond.appId,
    role: bond.role,
    outcome: bond.status === 'released' ? 'released' : bond.status === 'slashed' ? 'slashed' : 'pending',
    bondAmountSompi: bond.bondAmountSompi,
    createdAt: bond.createdAt,
  }));

  // The party as a verifier: validation work performed, drawn from the
  // verifier-role rows in ksb_party_history.
  const verifierPerApp = history.apps
    .map((app) => {
      const verifierRoles = app.roles.filter((role) => role.role === 'verifier');
      const validationsServed = verifierRoles.reduce((sum, role) => sum + role.bondsReleased + role.bondsSlashed, 0);
      const bondedValueObservedSompi = verifierRoles.reduce(
        (sum, role) => addSompiStrings(sum, role.totalBondedSompi),
        '0',
      );
      return { appId: app.appId, appName: app.appName, validationsServed, bondedValueObservedSompi };
    })
    .filter((entry) => entry.validationsServed > 0 || entry.bondedValueObservedSompi !== '0');

  const verifierActivity = {
    validationsServed: verifierPerApp.reduce((sum, entry) => sum + entry.validationsServed, 0),
    appsServed: verifierPerApp.length,
    bondedValueObservedSompi: verifierPerApp.reduce(
      (sum, entry) => addSompiStrings(sum, entry.bondedValueObservedSompi),
      '0',
    ),
    perApp: verifierPerApp,
  };

  return {
    schema: 'erc-8004/validation-reputation',
    schemaVersion: KSB_REPUTATION_SCHEMA_VERSION,
    subject: {
      account: `kaspa:${history.address}`,
      address: history.address,
      registry: 'ksb',
      validationPattern: 'stake-secured-re-execution',
    },
    summary: {
      totalValidations: history.summary.totalBonds,
      passed,
      failed,
      pending,
      passRate,
      reputationScore: passRate == null ? null : Math.round(passRate * 100),
      activeRiskIndicator: score.score.activeRiskIndicator,
      stakeBondedSompi: history.summary.totalBondedSompi,
      stakeSlashedSompi: history.summary.totalSlashedValueSompi,
    },
    signals,
    recentValidations,
    verifierActivity,
    compatibility: {
      standard: 'erc-8004',
      registryRole: 'validation',
      status: 'aligned',
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function resolveExpiredKsbBonds(db: any, nowUnix = Math.floor(Date.now() / 1000)): Promise<KsbCronRunResult> {
  const result = await (db as any).$client.execute({
    sql: `
      SELECT id, public_id, status, deadline_unix
      FROM ksb_bonds
      WHERE status IN ('proposed', 'committed', 'active', 'verified', 'failed')
        AND deadline_unix <= :nowUnix
      ORDER BY deadline_unix ASC
      LIMIT 200
    `,
    args: { nowUnix },
  });

  const bondIds: string[] = [];

  for (const row of result.rows) {
    const bondId = String(row.id);
    const publicId = String(row.public_id);

    await (db as any).$client.execute({
      sql: `
        UPDATE ksb_bonds
        SET status = 'timed_out'
        WHERE id = :bondId
          AND status IN ('proposed', 'committed', 'active', 'verified', 'failed')
          AND deadline_unix <= :nowUnix
      `,
      args: { bondId, nowUnix },
    });

    await addKsbBondEvent(
      db,
      bondId,
      'bond_timed_out',
      'system',
      null,
      'Resolver marked bond as timed out',
      JSON.stringify({ publicId, deadlineUnix: Number(row.deadline_unix), resolver: 'resolve-expired' }),
    );

    bondIds.push(publicId);
  }

  return {
    action: 'resolve-expired',
    scanned: result.rows.length,
    updated: bondIds.length,
    bondIds,
    at: new Date().toISOString(),
  };
}

export async function autoVerifyKsbBonds(db: any): Promise<KsbCronRunResult> {
  const bondsResult = await (db as any).$client.execute({
    sql: `
      SELECT id, public_id, status, verifier_config_json
      FROM ksb_bonds
      WHERE status IN ('proposed', 'committed', 'active', 'verified', 'failed', 'contested', 'timed_out')
      ORDER BY updated_at ASC
      LIMIT 200
    `,
    args: {},
  });

  const bondIds: string[] = [];

  for (const row of bondsResult.rows) {
    const bondId = String(row.id);
    const publicId = String(row.public_id);
    const currentStatus = String(row.status);
    const verificationsResult = await (db as any).$client.execute({
      sql: `SELECT rule_name, result FROM ksb_verifications WHERE bond_id = :bondId`,
      args: { bondId },
    });

    if (!verificationsResult.rows.length) {
      continue;
    }

    const resultsByRule: Record<string, string> = {};
    for (const verificationRow of verificationsResult.rows) {
      resultsByRule[String(verificationRow.rule_name)] = String(verificationRow.result);
    }

    const nextStatus = evaluateBondStatus(String(row.verifier_config_json), resultsByRule);

    if (nextStatus === currentStatus) {
      continue;
    }

    await (db as any).$client.execute({
      sql: `UPDATE ksb_bonds SET status = :status WHERE id = :bondId`,
      args: { status: nextStatus, bondId },
    });

    await addKsbBondEvent(
      db,
      bondId,
      'bond_auto_verified',
      'system',
      null,
      'Resolver updated bond status from verification results',
      JSON.stringify({ publicId, from: currentStatus, to: nextStatus, resolver: 'auto-verify' }),
    );

    bondIds.push(publicId);
  }

  return {
    action: 'auto-verify',
    scanned: bondsResult.rows.length,
    updated: bondIds.length,
    bondIds,
    at: new Date().toISOString(),
  };
}

export async function rebuildKsbPartyHistory(db: any): Promise<KsbCronRunResult> {
  const bondsResult = await (db as any).$client.execute({
    sql: `
      SELECT b.*, s.slash_amount_sompi
      FROM ksb_bonds b
      LEFT JOIN ksb_slashing_events s ON s.bond_id = b.id
      ORDER BY b.created_at ASC
      LIMIT 1000
    `,
    args: {},
  });

  await (db as any).$client.execute({
    sql: `DELETE FROM ksb_party_history`,
    args: {},
  });

  for (const row of bondsResult.rows) {
    const bond = rowToBond(row);
    await upsertKsbPartyBondedAmount(db, bond);

    if (bond.status === 'released') {
      await upsertKsbPartyResolution(db, bond, 'released');
    } else if (bond.status === 'slashed') {
      await upsertKsbPartyResolution(
        db,
        bond,
        'slashed',
        row.slash_amount_sompi ? String(row.slash_amount_sompi) : bond.bondAmountSompi,
      );
    }
  }

  return {
    action: 'rebuild-party-history',
    scanned: bondsResult.rows.length,
    updated: bondsResult.rows.length,
    bondIds: bondsResult.rows.map((row: any) => String(row.public_id)),
    at: new Date().toISOString(),
  };
}
