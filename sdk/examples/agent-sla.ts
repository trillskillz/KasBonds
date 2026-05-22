/**
 * Agent-to-agent SLA bond.
 *
 * A provider agent stakes a bond promising that an API endpoint stays
 * reachable. Verification uses the built-in `http_status_check` rule. If the
 * endpoint responds as expected before the deadline the bond is verified and
 * an operator can release it; otherwise it is slashed.
 *
 * Run against a local KSB instance:
 *   KSB_BASE_URL=http://localhost:3000 \
 *   KSB_OPERATOR_API_KEY=... \
 *   node --experimental-strip-types examples/agent-sla.ts
 */
import { KsbClient } from '../src/index';

const baseUrl = process.env.KSB_BASE_URL ?? 'http://localhost:3000';
const operatorKey = process.env.KSB_OPERATOR_API_KEY;

async function main() {
  const operatorClient = new KsbClient({ baseUrl, operatorKey });

  // 1. An operator bootstraps the consuming app once and hands it an API key.
  const app = await operatorClient.registerApp({
    name: 'agent-sla-demo',
    contact: 'ops@example.com',
    defaultUseCaseTemplate: 'agent_sla',
  });

  const appClient = new KsbClient({ baseUrl, apiKey: app.apiKey, operatorKey });

  // 2. The provider agent creates an SLA bond. The verifier config references
  //    the built-in http_status_check rule with its required params.
  const deadlineUnix = Math.floor(Date.now() / 1000) + 3600;
  const created = await appClient.createBond({
    useCaseTemplate: 'agent_sla',
    providerAddress: 'kaspa:provider-agent',
    counterpartyAddress: 'kaspa:consumer-agent',
    bondAmountSompi: '500000000',
    paymentAmountSompi: '50000000',
    deadlineUnix,
    verifierConfigJson: {
      rules: [
        {
          name: 'http_status_check',
          verifierType: 'http',
          params: { url: 'https://api.example.com/health', expectedStatus: 200 },
        },
      ],
    },
    slashDistributionJson: {
      counterparty_compensation: 0.5,
      burn: 0.45,
      verifier_fee: 0.045,
      protocol_fee: 0.005,
    },
  });

  const bondId = created.bond.publicId;

  // 3. The verifier runs the HTTP check and submits the result as a proof.
  await appClient.submitProof(bondId, {
    submittedBy: 'kaspa:verifier-agent',
    summary: 'Health endpoint returned 200 before the deadline',
    verifications: [
      {
        ruleName: 'http_status_check',
        result: 'passed',
        evidenceJson: { observedStatus: 200, checkedAt: new Date().toISOString() },
      },
    ],
  });

  // 4. Anyone can poll the lightweight status view.
  const status = await appClient.getBondStatus(bondId);
  console.log({
    appId: app.app.appId,
    bondId,
    status: status.status,
    passed: status.verificationSummary.passed,
    total: status.verificationSummary.total,
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
