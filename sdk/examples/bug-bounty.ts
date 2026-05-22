/**
 * Bug bounty escrow bond.
 *
 * A sponsor stakes a bond against a bounty payout. A researcher submits a
 * proof of the finding. Verification combines two built-in rules: a
 * `signature_check` proving the researcher authored the report, and an
 * `http_content_check` confirming the disclosure write-up is published.
 *
 * This example also shows the contest path: if the sponsor disputes the
 * verified outcome the bond moves to arbitration instead of release.
 *
 * Run against a local KSB instance:
 *   KSB_BASE_URL=http://localhost:3000 \
 *   KSB_OPERATOR_API_KEY=... \
 *   node --experimental-strip-types examples/bug-bounty.ts
 */
import { KsbClient } from '../src/index';

const baseUrl = process.env.KSB_BASE_URL ?? 'http://localhost:3000';
const operatorKey = process.env.KSB_OPERATOR_API_KEY;

async function main() {
  const operatorClient = new KsbClient({ baseUrl, operatorKey });

  const app = await operatorClient.registerApp({
    name: 'bug-bounty-demo',
    contact: 'security@example.com',
    defaultUseCaseTemplate: 'bug_bounty',
  });

  const appClient = new KsbClient({ baseUrl, apiKey: app.apiKey, operatorKey });

  // The sponsor escrows the bounty as a bond.
  const created = await appClient.createBond({
    useCaseTemplate: 'bug_bounty',
    providerAddress: 'kaspa:sponsor',
    counterpartyAddress: 'kaspa:researcher',
    bondAmountSompi: '2000000000',
    deadlineUnix: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    verifierConfigJson: {
      rules: [
        {
          name: 'signature_check',
          verifierType: 'signature',
          params: { algorithm: 'ed25519' },
        },
        {
          name: 'http_content_check',
          verifierType: 'content',
          params: { mustContain: ['CVE-', 'reproduction steps'] },
        },
      ],
    },
    slashDistributionJson: {
      counterparty_compensation: 0.9,
      burn: 0.055,
      verifier_fee: 0.04,
      protocol_fee: 0.005,
    },
  });

  const bondId = created.bond.publicId;

  // The researcher submits proof for both rules.
  await appClient.submitProof(bondId, {
    submittedBy: 'kaspa:researcher',
    summary: 'Signed disclosure plus published write-up',
    proofJson: { reportUrl: 'https://disclosures.example.com/report-42' },
    verifications: [
      { ruleName: 'signature_check', result: 'passed', evidenceJson: { signer: 'kaspa:researcher' } },
      { ruleName: 'http_content_check', result: 'passed', evidenceJson: { matched: ['CVE-', 'reproduction steps'] } },
    ],
  });

  let status = await appClient.getBondStatus(bondId);
  console.log({ stage: 'after-proof', bondId, status: status.status });

  // The sponsor disagrees with the finding and contests, moving the bond to
  // arbitration rather than letting it release automatically.
  await appClient.contestBond(bondId, {
    submittedBy: 'kaspa:sponsor',
    reason: 'Finding is a duplicate of an earlier report',
    moveToArbitration: true,
  });

  status = await appClient.getBondStatus(bondId);
  console.log({ stage: 'after-contest', bondId, status: status.status });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
