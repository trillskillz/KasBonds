# KSB end-to-end verification harness

The Phase 9 verification harness. It drives the KSB protocol surface through
its lifecycle against a running instance and reports pass/fail per case.

Built on the published [`ksb-sdk`](https://www.npmjs.com/package/ksb-sdk).

## What it covers

Protocol-API lifecycle cases, each driven entirely through the SDK:

- TC1 app registration
- TC2 bond creation
- TC3 proof submission reaching `verified`
- TC4 failing proof reaching `failed`
- TC5 contest moving a bond to `arbitration`
- TC6 the built-in verifier rule catalog
- TC7 custom verifier registration
- TC8 slash distribution validation
- TC9 verifier hub dispatch resolving a rule
- TC10 a composable `OR` rule set
- TC11 the reputation profile reflecting history
- TC12 cron `auto-verify` idempotency

On-chain covenant cases (real testnet 12 release and slash transactions,
multisig verifier) are operator-run steps; they and the harness results are
tracked in `../TESTNET_VERIFICATION.md`.

## Run

```bash
cp .env.example .env   # set KSB_BASE_URL and KSB_OPERATOR_API_KEY
npm install
node --env-file=.env --experimental-strip-types src/verify.ts
```

The harness registers its own app and exits non-zero if any case fails.
Use `npm run typecheck` to compile-check without running.
