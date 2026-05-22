/**
 * KSB reference integration: personal commitment bond.
 *
 * A person stakes a bond on a personal goal with a deadline - a commitment
 * device. The bond is verified by the built-in `deadline_time_check` rule:
 * the goal must be completed on or before the deadline.
 *
 * `deadline_time_check` needs a runtime input (the claimed completion time)
 * that is not known at bond creation, so this reference shows how to pass
 * `inputs` when dispatching the verifier hub.
 *
 * Configure with environment variables (see `.env.example`) and run:
 *   node --env-file=.env --experimental-strip-types src/index.ts
 */
import { KsbClient, KsbApiError } from 'ksb-sdk';

interface Config {
  baseUrl: string;
  operatorKey: string;
  appKey: string | null;
  committerAddress: string;
  accountabilityAddress: string;
  deadlineUnix: number;
  completedAtUnix: number;
}

function loadConfig(): Config {
  const operatorKey = process.env.KSB_OPERATOR_API_KEY ?? '';
  if (!operatorKey) {
    throw new Error('KSB_OPERATOR_API_KEY is required (used to register the app and dispatch the verifier hub)');
  }
  const now = Math.floor(Date.now() / 1000);
  const deadlineUnix = Number(process.env.DEADLINE_UNIX) || now + 7 * 24 * 3600;
  const completedAtUnix = Number(process.env.COMPLETED_AT_UNIX) || now;
  return {
    baseUrl: process.env.KSB_BASE_URL ?? 'http://localhost:3000',
    operatorKey,
    appKey: process.env.KSB_APP_API_KEY?.trim() || null,
    committerAddress: process.env.COMMITTER_ADDRESS ?? 'kaspa:committer',
    accountabilityAddress: process.env.ACCOUNTABILITY_ADDRESS ?? 'kaspa:accountability-partner',
    deadlineUnix,
    completedAtUnix,
  };
}

let stepNumber = 0;
function step(message: string) {
  stepNumber += 1;
  console.log(`\n[${stepNumber}] ${message}`);
}

async function runPersonalCommitmentBond(config: Config) {
  const operatorClient = new KsbClient({ baseUrl: config.baseUrl, operatorKey: config.operatorKey });

  let appKey = config.appKey;
  if (appKey) {
    step('Reusing existing app via KSB_APP_API_KEY');
  } else {
    step('Registering a new app');
    const registered = await operatorClient.registerApp({
      name: 'personal-commitment-reference',
      defaultUseCaseTemplate: 'personal_commitment',
    });
    appKey = registered.apiKey;
    console.log(`    app id: ${registered.app.appId}`);
  }

  const appClient = new KsbClient({ baseUrl: config.baseUrl, apiKey: appKey, operatorKey: config.operatorKey });

  // The committer stakes the bond on their goal. The verifier config
  // references deadline_time_check; the bond deadline is the goal deadline.
  step('Staking the commitment bond');
  const created = await appClient.createBond({
    useCaseTemplate: 'personal_commitment',
    providerAddress: config.committerAddress,
    counterpartyAddress: config.accountabilityAddress,
    bondAmountSompi: '250000000',
    deadlineUnix: config.deadlineUnix,
    verifierConfigJson: {
      rules: [
        { name: 'deadline_time_check', verifierType: 'time', params: { graceSeconds: 0 } },
      ],
    },
    slashDistributionJson: {
      counterparty_compensation: 0.6,
      burn: 0.395,
      protocol_fee: 0.005,
    },
  });
  const bondId = created.bond.publicId;
  console.log(`    bond id: ${bondId}`);
  console.log(`    deadline: ${new Date(config.deadlineUnix * 1000).toISOString()}`);

  // Dispatch the verifier hub, passing the claimed completion time as a
  // runtime input. deadline_time_check compares it against the bond deadline.
  step('Dispatching the verifier hub with the completion time');
  const dispatch = await operatorClient.dispatchVerification(bondId, {
    summary: 'Personal commitment: dispatch deadline_time_check',
    inputs: [
      { ruleName: 'deadline_time_check', params: { completedAtUnix: config.completedAtUnix } },
    ],
  });
  for (const outcome of dispatch.outcomes) {
    console.log(`    ${outcome.ruleName}: ${outcome.result} (${outcome.durationMs} ms)`);
  }

  step('Reading the resolved status');
  const status = await appClient.getBondStatus(bondId);
  console.log(`    status: ${status.status}`);

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
    await runPersonalCommitmentBond(config);
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
