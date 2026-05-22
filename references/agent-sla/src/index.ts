/**
 * KSB reference integration: agent-to-agent SLA bond.
 *
 * A provider agent stakes a bond promising that one of its endpoints stays
 * reachable. The bond is verified by the built-in `http_status_check` rule:
 * the KSB verifier hub fetches the endpoint and a 200 response is a pass.
 *
 * This is a forkable adoption template. The whole integration is the
 * `runAgentSlaBond` function below; everything else is config plumbing.
 *
 * Configure with environment variables (see `.env.example`) and run:
 *   node --env-file=.env --experimental-strip-types src/index.ts
 */
import { KsbClient, KsbApiError } from 'ksb-sdk';

interface Config {
  baseUrl: string;
  operatorKey: string;
  appKey: string | null;
  agentHealthUrl: string;
  providerAddress: string;
  counterpartyAddress: string;
}

function loadConfig(): Config {
  const baseUrl = process.env.KSB_BASE_URL ?? 'http://localhost:3000';
  const operatorKey = process.env.KSB_OPERATOR_API_KEY ?? '';
  if (!operatorKey) {
    throw new Error('KSB_OPERATOR_API_KEY is required (used to register the app and dispatch the verifier hub)');
  }
  return {
    baseUrl,
    operatorKey,
    appKey: process.env.KSB_APP_API_KEY?.trim() || null,
    agentHealthUrl: process.env.AGENT_HEALTH_URL ?? 'https://api.example.com/health',
    providerAddress: process.env.PROVIDER_ADDRESS ?? 'kaspa:provider-agent',
    counterpartyAddress: process.env.COUNTERPARTY_ADDRESS ?? 'kaspa:consumer-agent',
  };
}

let stepNumber = 0;
function step(message: string) {
  stepNumber += 1;
  console.log(`\n[${stepNumber}] ${message}`);
}

async function runAgentSlaBond(config: Config) {
  const operatorClient = new KsbClient({ baseUrl: config.baseUrl, operatorKey: config.operatorKey });

  // An app is the integrating product. Reuse one if a key was provided,
  // otherwise register a fresh app for this run.
  let appKey = config.appKey;
  if (appKey) {
    step(`Reusing existing app via KSB_APP_API_KEY`);
  } else {
    step('Registering a new app');
    const registered = await operatorClient.registerApp({
      name: 'agent-sla-reference',
      defaultUseCaseTemplate: 'agent_sla',
    });
    appKey = registered.apiKey;
    console.log(`    app id: ${registered.app.appId}`);
  }

  const appClient = new KsbClient({ baseUrl: config.baseUrl, apiKey: appKey, operatorKey: config.operatorKey });

  // The provider agent stakes the SLA bond. The verifier config references
  // the built-in http_status_check rule with the endpoint to probe.
  step('Creating the SLA bond');
  const created = await appClient.createBond({
    useCaseTemplate: 'agent_sla',
    providerAddress: config.providerAddress,
    counterpartyAddress: config.counterpartyAddress,
    bondAmountSompi: '500000000',
    paymentAmountSompi: '50000000',
    deadlineUnix: Math.floor(Date.now() / 1000) + 3600,
    verifierConfigJson: {
      rules: [
        {
          name: 'http_status_check',
          verifierType: 'http',
          params: { url: config.agentHealthUrl, expectedStatus: 200 },
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
  console.log(`    bond id: ${bondId}`);

  // The operator dispatches the verifier hub. The hub runs http_status_check
  // against the agent endpoint and records the protocol-computed verdict.
  step('Dispatching the verifier hub');
  const dispatch = await operatorClient.dispatchVerification(bondId, {
    summary: 'SLA reference: dispatch http_status_check',
  });
  for (const outcome of dispatch.outcomes) {
    console.log(`    ${outcome.ruleName}: ${outcome.result} (${outcome.durationMs} ms)`);
  }

  // Anyone can read the lightweight status view.
  step('Reading the resolved status');
  const status = await appClient.getBondStatus(bondId);
  console.log(`    status: ${status.status}`);
  console.log(`    verifications: ${status.verificationSummary.passed} passed / ${status.verificationSummary.total} total`);

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
    await runAgentSlaBond(config);
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
