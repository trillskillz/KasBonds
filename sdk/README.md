# @ksb/sdk

Initial SDK for the Kaspa Service Bonds protocol.

## Current scope

This pass provides:
- typed request/response interfaces
- a small `KsbClient` wrapper around the current `/api/v1` HTTP surface
- app-authenticated and operator-authenticated request helpers
- a local TypeScript build layout
- launch-grade examples under `examples/`

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

const status = await client.getBondStatus(bond.bond.publicId);
console.log(status.status);
```

## Examples

The `examples/` directory holds runnable end-to-end flows:
- `quickstart.ts` - operator app bootstrap, bond creation, status read
- `agent-sla.ts` - agent-to-agent SLA bond verified by `http_status_check`
- `bug-bounty.ts` - bug bounty escrow with a composed `AND`/`OR` rule set, including the contest path
- `custom-verifier.ts` - register an app-owned signed webhook verifier and dispatch it inside a bond

Built-in rule names referenced by the examples come from the protocol catalog
returned by `GET /api/v1/verifier-rules`.

Typecheck every example against the SDK source:

```bash
npm run examples:typecheck
```

## Verifier rules

`listVerifierRules()` returns the built-in protocol catalog merged with any
app-registered custom rules. `registerVerifierRule()` (app authenticated)
binds a named rule to an app-owned signed webhook that the verifier hub calls
for a pass or fail verdict.

## Next SDK work

- spec-to-code validation against `docs/openapi/ksb-v1.openapi.yaml`
- publishing workflow
- richer auth helpers
- signing helpers for release/slash execution payloads
- a personal commitment reference example
