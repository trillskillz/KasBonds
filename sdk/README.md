# @ksb/sdk

Initial SDK skeleton for the Kaspa Service Bonds protocol.

## Current scope

This first pass provides:
- typed request/response interfaces
- a small `KsbClient` wrapper around the current `/api/v1` HTTP surface
- app-authenticated and operator-authenticated request helpers

It is intentionally thin. The goal is to make protocol gaps obvious before the SDK is polished.

## Example

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
    rules: [{ name: 'http-check' }],
  },
  slashDistributionJson: {
    provider: 0.7,
    counterparty: 0.295,
    protocol_fee: 0.005,
  },
});

const status = await client.getBondStatus(bond.bond.publicId);
```

## Next SDK work

- package/build layout
- generated or validated types from OpenAPI
- richer auth helpers
- signing helpers for release/slash execution payloads
- examples directory and quickstart
