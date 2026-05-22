/**
 * KSB reference integration: bug bounty escrow bond.
 *
 * A sponsor escrows a bounty as a bond. A researcher submits a finding.
 * Verification uses a composed rule set: the disclosure write-up must be
 * published (`http_content_check`) AND the finding must be attested either
 * by the researcher's signature (`signature_check`) OR by an external triage
 * oracle (`external_oracle_check`).
 *
 * The reference also shows the dispute path: a sponsor who disagrees with the
 * verified outcome contests the bond into arbitration.
 *
 * Configure with environment variables (see `.env.example`) and run:
 *   node --env-file=.env --experimental-strip-types src/index.ts
 */
import { KsbClient, KsbApiError, type KsbRuleSetNode } from 'ksb-sdk';

interface Config {
  baseUrl: string;
  operatorKey: string;
  appKey: string | null;
  reportUrl: string;
  sponsorAddress: string;
  researcherAddress: string;
}

function loadConfig(): Config {
  const operatorKey = process.env.KSB_OPERATOR_API_KEY ?? '';
  if (!operatorKey) {
    throw new Error('KSB_OPERATOR_API_KEY is required (used to register the app)');
  }
  return {
    baseUrl: process.env.KSB_BASE_URL ?? 'http://localhost:3000',
    operatorKey,
    appKey: process.env.KSB_APP_API_KEY?.trim() || null,
    reportUrl: process.env.REPORT_URL ?? 'https://disclosures.example.com/report-42',
    sponsorAddress: process.env.SPONSOR_ADDRESS ?? 'kaspa:sponsor',
    researcherAddress: process.env.RESEARCHER_ADDRESS ?? 'kaspa:researcher',
  };
}

let stepNumber = 0;
function step(message: string) {
  stepNumber += 1;
  console.log(`\n[${stepNumber}] ${message}`);
}

async function runBugBountyBond(config: Config) {
  const operatorClient = new KsbClient({ baseUrl: config.baseUrl, operatorKey: config.operatorKey });

  let appKey = config.appKey;
  if (appKey) {
    step('Reusing existing app via KSB_APP_API_KEY');
  } else {
    step('Registering a new app');
    const registered = await operatorClient.registerApp({
      name: 'bug-bounty-reference',
      defaultUseCaseTemplate: 'bug_bounty',
    });
    appKey = registered.apiKey;
    console.log(`    app id: ${registered.app.appId}`);
  }

  const appClient = new KsbClient({ baseUrl: config.baseUrl, apiKey: appKey, operatorKey: config.operatorKey });

  // Composed rule set: a published write-up AND (researcher signature OR
  // triage oracle). Either attestation path satisfies the OR branch.
  const ruleSet: KsbRuleSetNode = {
    op: 'AND',
    children: [
      {
        name: 'http_content_check',
        verifierType: 'content',
        params: { url: config.reportUrl, mustContain: ['CVE-', 'reproduction steps'] },
      },
      {
        op: 'OR',
        children: [
          { name: 'signature_check', verifierType: 'signature', params: { algorithm: 'ed25519' } },
          { name: 'external_oracle_check', verifierType: 'oracle', params: { oracleUrl: 'https://triage.example.com/verdict' } },
        ],
      },
    ],
  };

  step('Escrowing the bounty as a bond');
  const created = await appClient.createBond({
    useCaseTemplate: 'bug_bounty',
    providerAddress: config.sponsorAddress,
    counterpartyAddress: config.researcherAddress,
    bondAmountSompi: '2000000000',
    deadlineUnix: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    verifierConfigJson: { ruleSet },
    slashDistributionJson: {
      counterparty_compensation: 0.9,
      burn: 0.055,
      verifier_fee: 0.04,
      protocol_fee: 0.005,
    },
  });
  const bondId = created.bond.publicId;
  console.log(`    bond id: ${bondId}`);

  // The researcher submits proof for the rules.
  step('Researcher submits the finding');
  await appClient.submitProof(bondId, {
    submittedBy: config.researcherAddress,
    summary: 'Signed disclosure plus published write-up',
    proofJson: { reportUrl: config.reportUrl },
    verifications: [
      { ruleName: 'signature_check', result: 'passed', evidenceJson: { signer: config.researcherAddress } },
      { ruleName: 'http_content_check', result: 'passed', evidenceJson: { url: config.reportUrl } },
    ],
  });
  let status = await appClient.getBondStatus(bondId);
  console.log(`    status after proof: ${status.status}`);

  // The sponsor disputes the finding and contests into arbitration rather
  // than letting the bond release automatically.
  step('Sponsor contests the outcome');
  await appClient.contestBond(bondId, {
    submittedBy: config.sponsorAddress,
    reason: 'Finding is a duplicate of an earlier report',
    moveToArbitration: true,
  });
  status = await appClient.getBondStatus(bondId);
  console.log(`    status after contest: ${status.status}`);

  console.log(`\nDone. Bond ${bondId} resolved to "${status.status}".`);
}

async function main() {
  let config: Config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid configuration');
    process.exit(1);
  }

  try {
    await runBugBountyBond(config);
  } catch (error) {
    if (error instanceof KsbApiError) {
      console.error(`\nKSB API error ${error.status}: ${error.message}`);
    } else {
      console.error(`\n${error instanceof Error ? error.message : 'Unexpected error'}`);
    }
    process.exit(1);
  }
}

void main();
