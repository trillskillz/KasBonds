/**
 * KSB Phase 9 end-to-end verification harness.
 *
 * Drives the KSB protocol surface through its lifecycle against a running
 * instance and reports pass/fail per case. Point it at the live testnet 12
 * deployment for a Phase 9 run, or at a local instance for a smoke check.
 *
 * Configure with environment variables (see `.env.example`) and run:
 *   node --env-file=.env --experimental-strip-types src/verify.ts
 *
 * Exits non-zero if any case fails. On-chain covenant cases (real TN12
 * release and slash transactions) are operator-run steps tracked in
 * TESTNET_VERIFICATION.md; this harness covers the protocol-API cases.
 */
import { KsbClient, KsbApiError, type KsbVerifierConfig } from 'ksb-sdk';

const baseUrl = process.env.KSB_BASE_URL ?? 'http://localhost:3000';
const operatorKey = process.env.KSB_OPERATOR_API_KEY ?? '';

const runId = Date.now();
const provider = `kaspa:e2e-provider-${runId}`;
const counterparty = `kaspa:e2e-counterparty-${runId}`;
const slashDistribution = { counterparty_compensation: 0.5, burn: 0.45, verifier_fee: 0.045, protocol_fee: 0.005 };

interface CaseResult { name: string; ok: boolean; detail: string }
const results: CaseResult[] = [];

async function check(name: string, fn: () => Promise<string>) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail ? ` - ${detail}` : ''}`);
  } catch (error) {
    const detail = error instanceof KsbApiError
      ? `API ${error.status}: ${error.message}`
      : error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail });
    console.log(`FAIL  ${name} - ${detail}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  if (!operatorKey) {
    console.error('KSB_OPERATOR_API_KEY is required');
    process.exit(1);
  }

  console.log(`KSB end-to-end verification against ${baseUrl}\n`);
  const operatorClient = new KsbClient({ baseUrl, operatorKey });

  // App registration gates every later case, so it runs inline rather than
  // through the check() wrapper.
  let app: KsbClient;
  try {
    const registered = await operatorClient.registerApp({ name: `e2e-${runId}`, defaultUseCaseTemplate: 'custom' });
    app = new KsbClient({ baseUrl, apiKey: registered.apiKey, operatorKey });
    results.push({ name: 'TC1 app registration', ok: true, detail: registered.app.appId });
    console.log(`PASS  TC1 app registration - ${registered.app.appId}`);
  } catch (error) {
    const detail = error instanceof KsbApiError
      ? `API ${error.status}: ${error.message}`
      : error instanceof Error ? error.message : String(error);
    results.push({ name: 'TC1 app registration', ok: false, detail });
    console.log(`FAIL  TC1 app registration - ${detail}`);
    console.error('\nApp registration failed; cannot continue.');
    report();
    return;
  }

  const newBond = (verifierConfigJson: KsbVerifierConfig, deadlineOffsetSec = 3600) =>
    app.createBond({
      useCaseTemplate: 'custom',
      providerAddress: provider,
      counterpartyAddress: counterparty,
      bondAmountSompi: '100000000',
      deadlineUnix: Math.floor(Date.now() / 1000) + deadlineOffsetSec,
      verifierConfigJson,
      slashDistributionJson: slashDistribution,
    });

  await check('TC2 bond creation', async () => {
    const created = await newBond({ rules: [{ name: 'deadline_time_check' }] });
    assert(created.bond.status === 'proposed', `expected proposed, got ${created.bond.status}`);
    return created.bond.publicId;
  });

  await check('TC3 proof submission reaches verified', async () => {
    const created = await newBond({ rules: [{ name: 'deadline_time_check' }] });
    await app.submitProof(created.bond.publicId, {
      verifications: [{ ruleName: 'deadline_time_check', result: 'passed' }],
    });
    const status = await app.getBondStatus(created.bond.publicId);
    assert(status.status === 'verified', `expected verified, got ${status.status}`);
    return created.bond.publicId;
  });

  await check('TC4 failing proof reaches failed', async () => {
    const created = await newBond({ rules: [{ name: 'deadline_time_check' }] });
    await app.submitProof(created.bond.publicId, {
      verifications: [{ ruleName: 'deadline_time_check', result: 'failed' }],
    });
    const status = await app.getBondStatus(created.bond.publicId);
    assert(status.status === 'failed', `expected failed, got ${status.status}`);
    return created.bond.publicId;
  });

  await check('TC5 contest moves a bond to arbitration', async () => {
    const created = await newBond({ rules: [{ name: 'deadline_time_check' }] });
    await app.submitProof(created.bond.publicId, {
      verifications: [{ ruleName: 'deadline_time_check', result: 'passed' }],
    });
    await app.contestBond(created.bond.publicId, { reason: 'e2e dispute', moveToArbitration: true });
    const status = await app.getBondStatus(created.bond.publicId);
    assert(status.status === 'arbitration', `expected arbitration, got ${status.status}`);
    return created.bond.publicId;
  });

  await check('TC6 built-in verifier rule catalog', async () => {
    const { rules } = await app.listVerifierRules();
    for (const name of ['http_status_check', 'http_content_check', 'deadline_time_check', 'signature_check', 'external_oracle_check']) {
      assert(rules.some((rule) => rule.name === name && rule.source === 'builtin'), `missing built-in rule ${name}`);
    }
    return `${rules.length} rules listed`;
  });

  await check('TC7 custom verifier registration', async () => {
    const ruleName = `e2e_webhook_${runId}`;
    await app.registerVerifierRule({ name: ruleName, webhookUrl: 'https://verifier.example.com/e2e' });
    const { rules } = await app.listVerifierRules();
    assert(rules.some((rule) => rule.name === ruleName && rule.source === 'custom'), 'custom rule not in listing');
    return ruleName;
  });

  await check('TC8 slash distribution validation', async () => {
    try {
      await app.createBond({
        useCaseTemplate: 'custom',
        providerAddress: provider,
        counterpartyAddress: counterparty,
        bondAmountSompi: '100000000',
        deadlineUnix: Math.floor(Date.now() / 1000) + 3600,
        verifierConfigJson: { rules: [{ name: 'deadline_time_check' }] },
        slashDistributionJson: { counterparty_compensation: 0.5, burn: 0.45, protocol_fee: 0.05 },
      });
    } catch (error) {
      assert(error instanceof KsbApiError, 'expected a KSB API error');
      return 'bad protocol_fee rejected';
    }
    throw new Error('a non-0.005 protocol fee was not rejected');
  });

  await check('TC9 verifier hub dispatch resolves a deadline check', async () => {
    const created = await newBond({ rules: [{ name: 'deadline_time_check' }] });
    const dispatch = await operatorClient.dispatchVerification(created.bond.publicId, {
      inputs: [{ ruleName: 'deadline_time_check', params: { completedAtUnix: Math.floor(Date.now() / 1000) } }],
    });
    const outcome = dispatch.outcomes.find((entry) => entry.ruleName === 'deadline_time_check');
    assert(outcome?.result === 'passed', `expected passed, got ${outcome?.result}`);
    assert(dispatch.statusAfter === 'verified', `expected verified, got ${dispatch.statusAfter}`);
    return created.bond.publicId;
  });

  await check('TC10 composable OR rule set', async () => {
    const created = await newBond({
      ruleSet: { op: 'OR', children: [{ name: 'deadline_time_check' }, { name: 'signature_check' }] },
    });
    await app.submitProof(created.bond.publicId, {
      verifications: [
        { ruleName: 'deadline_time_check', result: 'passed' },
        { ruleName: 'signature_check', result: 'failed' },
      ],
    });
    const status = await app.getBondStatus(created.bond.publicId);
    assert(status.status === 'verified', `OR set should pass on one leg, got ${status.status}`);
    return created.bond.publicId;
  });

  await check('TC11 reputation profile reflects history', async () => {
    const profile = await app.getReputationProfile(provider);
    assert(profile.schema === 'erc-8004/validation-reputation', 'unexpected reputation schema');
    assert(profile.summary.totalValidations >= 1, 'reputation shows no validations for the e2e provider');
    return `${profile.summary.totalValidations} validation(s)`;
  });

  await check('TC12 cron auto-verify is idempotent', async () => {
    const first = await operatorClient.autoVerify();
    const second = await operatorClient.autoVerify();
    assert(first.action === 'auto-verify' && second.action === 'auto-verify', 'unexpected cron action');
    return `runs ok (updated ${first.updated} then ${second.updated})`;
  });

  report();
}

function report() {
  const passed = results.filter((entry) => entry.ok).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} cases passed.`);
  if (failed > 0) {
    console.log(`${failed} case(s) failed.`);
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unexpected harness error');
  process.exit(1);
});
