/**
 * Custom verifier registration.
 *
 * An app registers its own verifier rule, bound to a signed webhook it
 * controls, then uses that rule inside a bond alongside a built-in rule. When
 * the verifier hub dispatches the bond it POSTs the bond context to the
 * webhook and expects a signed `{ verdict, signature }` reply.
 *
 * The webhook contract:
 *   request  POST { bondId, publicId, ruleName, deadlineUnix, params }
 *   response { "verdict": "pass" | "fail", "signature": "<hex or base64>" }
 * When a verifierPublicKey is registered, the signature over the verdict
 * string is verified before the verdict is trusted.
 *
 * Run against a local KSB instance:
 *   KSB_BASE_URL=http://localhost:3000 \
 *   KSB_OPERATOR_API_KEY=... \
 *   node --experimental-strip-types examples/custom-verifier.ts
 */
import { KsbClient, type KsbRuleSetNode } from '../src/index';

const baseUrl = process.env.KSB_BASE_URL ?? 'http://localhost:3000';
const operatorKey = process.env.KSB_OPERATOR_API_KEY;

async function main() {
  const operatorClient = new KsbClient({ baseUrl, operatorKey });

  // 1. An operator bootstraps the consuming app.
  const app = await operatorClient.registerApp({
    name: 'custom-verifier-demo',
    contact: 'ops@example.com',
    defaultUseCaseTemplate: 'custom',
  });

  const appClient = new KsbClient({ baseUrl, apiKey: app.apiKey, operatorKey });

  // 2. The app registers its own verifier rule bound to a signed webhook.
  //    Built-in rule names are reserved, so pick an app-specific name.
  const customRule = await appClient.registerVerifierRule({
    name: 'acme_review_check',
    description: 'Acme internal reviewer signs off on the delivered work',
    webhookUrl: 'https://verifier.acme.example.com/ksb/review',
    verifierPublicKey: process.env.ACME_VERIFIER_PUBLIC_KEY ?? null,
    defaultTimeoutMs: 20000,
  });

  // 3. Create a bond whose rule set mixes a built-in rule with the custom one.
  const ruleSet: KsbRuleSetNode = {
    op: 'AND',
    children: [
      {
        name: 'http_content_check',
        verifierType: 'content',
        params: { url: 'https://deliverables.acme.example.com/job-7', mustContain: ['signed-off'] },
      },
      { name: customRule.name, verifierType: 'webhook' },
    ],
  };

  const created = await appClient.createBond({
    useCaseTemplate: 'custom',
    providerAddress: 'kaspa:provider',
    counterpartyAddress: 'kaspa:acme',
    bondAmountSompi: '750000000',
    deadlineUnix: Math.floor(Date.now() / 1000) + 3 * 24 * 3600,
    verifierConfigJson: { ruleSet },
    slashDistributionJson: {
      counterparty_compensation: 0.6,
      burn: 0.35,
      verifier_fee: 0.045,
      protocol_fee: 0.005,
    },
  });

  const bondId = created.bond.publicId;

  // 4. The operator dispatches the verifier hub. The custom rule is resolved
  //    to its registered webhook and called for a signed verdict.
  const dispatch = await operatorClient.dispatchVerification(bondId, {
    summary: 'Dispatch built-in and custom verifier rules',
  });

  console.log({
    appId: app.app.appId,
    customRule: customRule.name,
    bondId,
    statusAfter: dispatch.statusAfter,
    outcomes: dispatch.outcomes.map((outcome) => ({
      rule: outcome.ruleName,
      type: outcome.verifierType,
      result: outcome.result,
    })),
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
