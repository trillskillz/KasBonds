# @ksb/sdk

Initial SDK for the Kaspa Service Bonds protocol.

## Current scope

This pass provides:
- typed request/response interfaces
- a small `KsbClient` wrapper around the current `/api/v1` HTTP surface
- app-authenticated and operator-authenticated request helpers
- a local TypeScript build layout
- a quickstart example under `examples/quickstart.ts`

It is still intentionally thin. The goal is to stabilize the protocol surface before polishing ergonomics.

## Build

```bash
cd sdk
npm install
npm run typecheck
npm run build
```

## Quickstart

```ts
import { KsbClient } from '@ksb/sdk';

const client = new KsbClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.KSB_APP_API_KEY,
  operatorKey: process.env.KSB_OPERATOR_API_KEY,
});

const bond = await client.createBond({
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

const status = await client.getBondStatus(bond.bond.publicId);
console.log(status.status);
```

For a fuller flow including operator-side app bootstrap, see `examples/quickstart.ts`.

## Next SDK work

- spec-to-code validation against `docs/openapi/ksb-v1.openapi.yaml`
- publishing workflow
- richer auth helpers
- signing helpers for release/slash execution payloads
- more launch-grade examples
