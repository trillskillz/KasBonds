import { KsbClient } from '../src/index';

const client = new KsbClient({
  baseUrl: process.env.KSB_BASE_URL ?? 'http://localhost:3000',
  apiKey: process.env.KSB_APP_API_KEY,
  operatorKey: process.env.KSB_OPERATOR_API_KEY,
});

async function main() {
  const app = await client.registerApp({
    name: 'quickstart-demo',
    contact: 'demo@example.com',
    defaultUseCaseTemplate: 'custom',
  });

  const appClient = new KsbClient({
    baseUrl: process.env.KSB_BASE_URL ?? 'http://localhost:3000',
    apiKey: app.apiKey,
    operatorKey: process.env.KSB_OPERATOR_API_KEY,
  });

  const bond = await appClient.createBond({
    providerAddress: 'kaspa:provider...',
    counterpartyAddress: 'kaspa:counterparty...',
    bondAmountSompi: '1000000000',
    deadlineUnix: Math.floor(Date.now() / 1000) + 3600,
    verifierConfigJson: {
      verifierAddress: 'kaspa:verifier...',
      rules: [{ name: 'http-check', verifierAddress: 'kaspa:verifier...' }],
    },
    slashDistributionJson: {
      provider: 0.7,
      counterparty: 0.295,
      protocol_fee: 0.005,
    },
  });

  const status = await appClient.getBondStatus(bond.bond.publicId);

  console.log({
    appId: app.app.appId,
    bondId: bond.bond.publicId,
    status: status.status,
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
