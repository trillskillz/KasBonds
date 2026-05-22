import { randomUUID } from 'node:crypto';

import type {
  AcceptBondInput,
  BondEventRecord,
  BondRecord,
  BondStatusView,
  CreateBondDraftInput,
  RecordBondLockInput,
  RecordReleaseExecutionInput,
  RecordSlashExecutionInput,
  RecordVerifierDecisionInput,
  SlashDistributionRecord,
  VerifierDecisionRecord,
} from './types';

function makePublicId() {
  return `bond_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function rowToBondRecord(row: any): BondRecord {
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    state: row.state,
    network: String(row.network),
    artifactKind: String(row.artifact_kind),
    artifactRef: row.artifact_ref ?? null,
    constructorArgsJson: row.constructor_args_json ?? null,
    jobRef: String(row.job_ref),
    buyerId: String(row.buyer_id),
    agentId: String(row.agent_id),
    verifierId: row.verifier_id ?? null,
    buyerAddress: String(row.buyer_address),
    agentAddress: String(row.agent_address),
    verifierAddress: row.verifier_address ?? null,
    platformFeeAddress: String(row.platform_fee_address),
    burnAddress: String(row.burn_address),
    bondPrincipalSompi: String(row.bond_principal_sompi),
    slashableAmountSompi: String(row.slashable_amount_sompi),
    platformFeeBps: Number(row.platform_fee_bps),
    buyerShareBps: Number(row.buyer_share_bps),
    burnShareBps: Number(row.burn_share_bps),
    releaseDeadlineUnix: Number(row.release_deadline_unix),
    slashDeadlineUnix: Number(row.slash_deadline_unix),
    lockTxid: row.lock_txid ?? null,
    lockVout: row.lock_vout == null ? null : Number(row.lock_vout),
    covenantAddress: row.covenant_address ?? null,
    releaseTxid: row.release_txid ?? null,
    slashTxid: row.slash_txid ?? null,
    failureReason: row.failure_reason ?? null,
    acceptedAt: row.accepted_at ?? null,
    fundedAt: row.funded_at ?? null,
    activatedAt: row.activated_at ?? null,
    verificationRequestedAt: row.verification_requested_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToEventRecord(row: any): BondEventRecord {
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

function rowToDecisionRecord(row: any): VerifierDecisionRecord {
  return {
    id: String(row.id),
    bondId: String(row.bond_id),
    verifierId: String(row.verifier_id),
    status: String(row.status),
    decisionReason: row.decision_reason ?? null,
    evidenceJson: row.evidence_json ?? null,
    signaturePayloadJson: row.signature_payload_json ?? null,
    signatureHex: row.signature_hex ?? null,
    signedAt: row.signed_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToSlashDistributionRecord(row: any): SlashDistributionRecord {
  return {
    id: String(row.id),
    bondId: String(row.bond_id),
    lockTxid: String(row.lock_txid),
    slashTxid: row.slash_txid ?? null,
    totalInputSompi: String(row.total_input_sompi),
    minerFeeSompi: String(row.miner_fee_sompi),
    distributableSompi: String(row.distributable_sompi),
    buyerAmountSompi: String(row.buyer_amount_sompi),
    platformFeeAmountSompi: String(row.platform_fee_amount_sompi),
    burnAmountSompi: String(row.burn_amount_sompi),
    buyerAddress: String(row.buyer_address),
    platformFeeAddress: String(row.platform_fee_address),
    burnAddress: String(row.burn_address),
    policyJson: row.policy_json ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function addBondEvent(
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
      INSERT INTO bond_events (
        id,
        bond_id,
        event_type,
        actor_type,
        actor_id,
        summary,
        data_json
      ) VALUES (
        :id,
        :bondId,
        :eventType,
        :actorType,
        :actorId,
        :summary,
        :dataJson
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

export async function createBondDraft(db: any, input: CreateBondDraftInput): Promise<BondRecord> {
  const id = randomUUID();
  const publicId = makePublicId();
  const acceptanceRuleId = randomUUID();

  await (db as any).$client.execute({
    sql: `
      INSERT INTO bonds (
        id,
        public_id,
        state,
        network,
        artifact_kind,
        artifact_ref,
        constructor_args_json,
        job_ref,
        buyer_id,
        agent_id,
        verifier_id,
        buyer_address,
        agent_address,
        verifier_address,
        platform_fee_address,
        burn_address,
        bond_principal_sompi,
        slashable_amount_sompi,
        release_deadline_unix,
        slash_deadline_unix
      ) VALUES (
        :id,
        :publicId,
        'draft',
        :network,
        :artifactKind,
        :artifactRef,
        :constructorArgsJson,
        :jobRef,
        :buyerId,
        :agentId,
        :verifierId,
        :buyerAddress,
        :agentAddress,
        :verifierAddress,
        :platformFeeAddress,
        :burnAddress,
        :bondPrincipalSompi,
        :slashableAmountSompi,
        :releaseDeadlineUnix,
        :slashDeadlineUnix
      )
    `,
    args: {
      id,
      publicId,
      network: input.network,
      artifactKind: input.artifactKind ?? 'parameterized',
      artifactRef: input.artifactRef ?? null,
      constructorArgsJson: input.constructorArgsJson ?? null,
      jobRef: input.jobRef,
      buyerId: input.buyerId,
      agentId: input.agentId,
      verifierId: input.verifierId ?? null,
      buyerAddress: input.buyerAddress,
      agentAddress: input.agentAddress,
      verifierAddress: input.verifierAddress ?? null,
      platformFeeAddress: input.platformFeeAddress,
      burnAddress: input.burnAddress,
      bondPrincipalSompi: input.bondPrincipalSompi,
      slashableAmountSompi: input.slashableAmountSompi,
      releaseDeadlineUnix: input.releaseDeadlineUnix,
      slashDeadlineUnix: input.slashDeadlineUnix,
    },
  });

  await (db as any).$client.execute({
    sql: `
      INSERT INTO bond_acceptance_rules (
        id,
        bond_id,
        min_agent_reputation,
        requires_manual_review,
        allowed_verifier_policy,
        max_resolution_minutes,
        rule_json
      ) VALUES (
        :id,
        :bondId,
        :minAgentReputation,
        :requiresManualReview,
        :allowedVerifierPolicy,
        :maxResolutionMinutes,
        :ruleJson
      )
    `,
    args: {
      id: acceptanceRuleId,
      bondId: id,
      minAgentReputation: input.minAgentReputation ?? null,
      requiresManualReview: input.requiresManualReview ? 1 : 0,
      allowedVerifierPolicy: input.allowedVerifierPolicy ?? 'centralized',
      maxResolutionMinutes: input.maxResolutionMinutes ?? null,
      ruleJson: input.acceptanceRuleJson ?? null,
    },
  });

  await addBondEvent(
    db,
    id,
    'draft_created',
    'system',
    null,
    'Bond draft created',
    JSON.stringify({ jobRef: input.jobRef, buyerId: input.buyerId, agentId: input.agentId }),
  );

  return (await getBondStatus(db, publicId)).bond;
}

export async function acceptBond(db: any, idOrPublicId: string, input: AcceptBondInput = {}): Promise<BondRecord> {
  const current = await getBondStatus(db, idOrPublicId);
  if (!['draft', 'offered'].includes(current.bond.state)) {
    throw new Error(`Bond cannot be accepted from state ${current.bond.state}`);
  }

  await (db as any).$client.execute({
    sql: `UPDATE bonds SET state = 'accepted', accepted_at = CURRENT_TIMESTAMP WHERE id = :bondId`,
    args: { bondId: current.bond.id },
  });

  await addBondEvent(db, current.bond.id, 'offer_accepted', 'agent', input.actorId ?? current.bond.agentId, input.summary ?? 'Bond offer accepted');

  return (await getBondStatus(db, current.bond.id)).bond;
}

export async function recordBondLock(db: any, idOrPublicId: string, input: RecordBondLockInput): Promise<BondRecord> {
  const current = await getBondStatus(db, idOrPublicId);
  if (!['accepted', 'funding_pending', 'active'].includes(current.bond.state)) {
    throw new Error(`Bond lock cannot be recorded from state ${current.bond.state}`);
  }

  await (db as any).$client.execute({
    sql: `
      UPDATE bonds
      SET
        state = 'active',
        lock_txid = :lockTxid,
        lock_vout = :lockVout,
        covenant_address = :covenantAddress,
        artifact_ref = COALESCE(:artifactRef, artifact_ref),
        constructor_args_json = COALESCE(:constructorArgsJson, constructor_args_json),
        funded_at = COALESCE(funded_at, CURRENT_TIMESTAMP),
        activated_at = CURRENT_TIMESTAMP
      WHERE id = :bondId
    `,
    args: {
      bondId: current.bond.id,
      lockTxid: input.lockTxid,
      lockVout: input.lockVout,
      covenantAddress: input.covenantAddress,
      artifactRef: input.artifactRef ?? null,
      constructorArgsJson: input.constructorArgsJson ?? null,
    },
  });

  await addBondEvent(
    db,
    current.bond.id,
    'lock_confirmed',
    'operator',
    input.actorId ?? null,
    input.summary ?? 'Bond lock recorded',
    JSON.stringify({ lockTxid: input.lockTxid, lockVout: input.lockVout, covenantAddress: input.covenantAddress }),
  );

  return (await getBondStatus(db, current.bond.id)).bond;
}

export async function recordVerifierDecision(db: any, idOrPublicId: string, input: RecordVerifierDecisionInput): Promise<BondStatusView> {
  const current = await getBondStatus(db, idOrPublicId);
  if (!['active', 'verification_pending', 'approved', 'rejected', 'expired'].includes(current.bond.state)) {
    throw new Error(`Verifier decision cannot be recorded from state ${current.bond.state}`);
  }

  const decisionId = current.decision?.id ?? randomUUID();
  const nextState = input.status;
  const eventType = input.status === 'approved' ? 'verifier_approved' : input.status === 'rejected' ? 'verifier_rejected' : 'deadline_expired';

  await (db as any).$client.execute({
    sql: `
      INSERT INTO verifier_decisions (
        id, bond_id, verifier_id, status, decision_reason, evidence_json, signature_payload_json, signature_hex, signed_at, expires_at
      ) VALUES (
        :id, :bondId, :verifierId, :status, :decisionReason, :evidenceJson, :signaturePayloadJson, :signatureHex, :signedAt, :expiresAt
      )
      ON CONFLICT(bond_id) DO UPDATE SET
        verifier_id = excluded.verifier_id,
        status = excluded.status,
        decision_reason = excluded.decision_reason,
        evidence_json = excluded.evidence_json,
        signature_payload_json = excluded.signature_payload_json,
        signature_hex = excluded.signature_hex,
        signed_at = excluded.signed_at,
        expires_at = excluded.expires_at,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: {
      id: decisionId,
      bondId: current.bond.id,
      verifierId: input.verifierId,
      status: input.status,
      decisionReason: input.decisionReason ?? null,
      evidenceJson: input.evidenceJson ?? null,
      signaturePayloadJson: input.signaturePayloadJson ?? null,
      signatureHex: input.signatureHex ?? null,
      signedAt: input.signedAt ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });

  await (db as any).$client.execute({
    sql: `UPDATE bonds SET state = :state, verification_requested_at = COALESCE(verification_requested_at, CURRENT_TIMESTAMP) WHERE id = :bondId`,
    args: { state: nextState, bondId: current.bond.id },
  });

  await addBondEvent(
    db,
    current.bond.id,
    eventType,
    input.status === 'expired' ? 'system' : 'verifier',
    input.actorId ?? input.verifierId,
    input.summary ?? `Verifier marked bond as ${input.status}`,
    JSON.stringify({ decisionReason: input.decisionReason ?? null, evidenceJson: input.evidenceJson ?? null }),
  );

  return getBondStatus(db, current.bond.id);
}

export async function recordReleaseExecution(db: any, idOrPublicId: string, input: RecordReleaseExecutionInput): Promise<BondStatusView> {
  const current = await getBondStatus(db, idOrPublicId);
  if (!['approved', 'released'].includes(current.bond.state)) {
    throw new Error(`Release cannot be recorded from state ${current.bond.state}`);
  }

  await (db as any).$client.execute({
    sql: `UPDATE bonds SET state = 'released', release_txid = :releaseTxid, resolved_at = CURRENT_TIMESTAMP WHERE id = :bondId`,
    args: { releaseTxid: input.releaseTxid, bondId: current.bond.id },
  });

  await addBondEvent(
    db,
    current.bond.id,
    'release_confirmed',
    'operator',
    input.actorId ?? null,
    input.summary ?? 'Release transaction recorded',
    JSON.stringify({ releaseTxid: input.releaseTxid }),
  );

  return getBondStatus(db, current.bond.id);
}

export async function recordSlashExecution(db: any, idOrPublicId: string, input: RecordSlashExecutionInput): Promise<BondStatusView> {
  const current = await getBondStatus(db, idOrPublicId);
  if (!['rejected', 'expired', 'slashed'].includes(current.bond.state)) {
    throw new Error(`Slash cannot be recorded from state ${current.bond.state}`);
  }
  if (!current.bond.lockTxid) {
    throw new Error('Cannot record slash execution without a lock txid on the bond');
  }

  const slashDistributionId = current.slashDistribution?.id ?? randomUUID();

  await (db as any).$client.execute({
    sql: `UPDATE bonds SET state = 'slashed', slash_txid = :slashTxid, resolved_at = CURRENT_TIMESTAMP WHERE id = :bondId`,
    args: { slashTxid: input.slashTxid, bondId: current.bond.id },
  });

  await (db as any).$client.execute({
    sql: `
      INSERT INTO slash_distributions (
        id, bond_id, lock_txid, slash_txid, total_input_sompi, miner_fee_sompi, distributable_sompi,
        buyer_amount_sompi, platform_fee_amount_sompi, burn_amount_sompi,
        buyer_address, platform_fee_address, burn_address, policy_json
      ) VALUES (
        :id, :bondId, :lockTxid, :slashTxid, :totalInputSompi, :minerFeeSompi, :distributableSompi,
        :buyerAmountSompi, :platformFeeAmountSompi, :burnAmountSompi,
        :buyerAddress, :platformFeeAddress, :burnAddress, :policyJson
      )
      ON CONFLICT(bond_id) DO UPDATE SET
        slash_txid = excluded.slash_txid,
        total_input_sompi = excluded.total_input_sompi,
        miner_fee_sompi = excluded.miner_fee_sompi,
        distributable_sompi = excluded.distributable_sompi,
        buyer_amount_sompi = excluded.buyer_amount_sompi,
        platform_fee_amount_sompi = excluded.platform_fee_amount_sompi,
        burn_amount_sompi = excluded.burn_amount_sompi,
        buyer_address = excluded.buyer_address,
        platform_fee_address = excluded.platform_fee_address,
        burn_address = excluded.burn_address,
        policy_json = excluded.policy_json,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: {
      id: slashDistributionId,
      bondId: current.bond.id,
      lockTxid: current.bond.lockTxid,
      slashTxid: input.slashTxid,
      totalInputSompi: input.totalInputSompi,
      minerFeeSompi: input.minerFeeSompi,
      distributableSompi: input.distributableSompi,
      buyerAmountSompi: input.buyerAmountSompi,
      platformFeeAmountSompi: input.platformFeeAmountSompi,
      burnAmountSompi: input.burnAmountSompi,
      buyerAddress: input.buyerAddress,
      platformFeeAddress: input.platformFeeAddress,
      burnAddress: input.burnAddress,
      policyJson: input.policyJson ?? null,
    },
  });

  await addBondEvent(
    db,
    current.bond.id,
    'slash_confirmed',
    'operator',
    input.actorId ?? null,
    input.summary ?? 'Slash transaction recorded',
    JSON.stringify({ slashTxid: input.slashTxid }),
  );

  return getBondStatus(db, current.bond.id);
}

export async function listBonds(db: any, filters: { buyerId?: string | null; agentId?: string | null; state?: string | null; limit?: number }): Promise<BondRecord[]> {
  const clauses: string[] = [];
  const args: Record<string, unknown> = {};

  if (filters.buyerId) {
    clauses.push('buyer_id = :buyerId');
    args.buyerId = filters.buyerId;
  }
  if (filters.agentId) {
    clauses.push('agent_id = :agentId');
    args.agentId = filters.agentId;
  }
  if (filters.state) {
    clauses.push('state = :state');
    args.state = filters.state;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  args.limit = filters.limit ?? 50;

  const result = await (db as any).$client.execute({
    sql: `SELECT * FROM bonds ${where} ORDER BY created_at DESC LIMIT :limit`,
    args,
  });

  return result.rows.map(rowToBondRecord);
}

export async function getBondStatus(db: any, idOrPublicId: string): Promise<BondStatusView> {
  const bondResult = await (db as any).$client.execute({
    sql: `SELECT * FROM bonds WHERE id = :idOrPublicId OR public_id = :idOrPublicId LIMIT 1`,
    args: { idOrPublicId },
  });

  const bondRow = bondResult.rows[0];
  if (!bondRow) {
    throw new Error(`Bond not found: ${idOrPublicId}`);
  }

  const bond = rowToBondRecord(bondRow);

  const [eventsResult, decisionResult, slashDistributionResult] = await Promise.all([
    (db as any).$client.execute({ sql: `SELECT * FROM bond_events WHERE bond_id = :bondId ORDER BY created_at ASC`, args: { bondId: bond.id } }),
    (db as any).$client.execute({ sql: `SELECT * FROM verifier_decisions WHERE bond_id = :bondId LIMIT 1`, args: { bondId: bond.id } }),
    (db as any).$client.execute({ sql: `SELECT * FROM slash_distributions WHERE bond_id = :bondId LIMIT 1`, args: { bondId: bond.id } }),
  ]);

  return {
    bond,
    events: eventsResult.rows.map(rowToEventRecord),
    decision: decisionResult.rows[0] ? rowToDecisionRecord(decisionResult.rows[0]) : null,
    slashDistribution: slashDistributionResult.rows[0] ? rowToSlashDistributionRecord(slashDistributionResult.rows[0]) : null,
  };
}
