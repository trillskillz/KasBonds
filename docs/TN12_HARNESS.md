# TN12 Harness Setup

## Goal

Prepare this folder to produce the two hard-gate proof transactions for BondClaw:
- release path proof
- slash path proof

## Current harness contents

- `contracts/minimum-bond.sil`
- `artifacts/minimum-bond.json`
- `scripts/check-env.mjs`
- `scripts/check-rpc.mjs`
- `scripts/wallet-info.mjs`
- `scripts/covenant-address.mjs`
- `scripts/generate-key.mjs`
- `scripts/proof-plan.mjs`
- `scripts/lock-bond.mjs`
- `scripts/release-proof.mjs`
- `scripts/slash-proof.mjs`
- `.env.example`
- local compiler source at `vendor/silverscript/`
- TN12-compatible WASM SDK source at `vendor/x402-KAS/packages/kaspa-wasm/`

## What is still needed

### 1. TN12 wallet funding
This is no longer a blocker for the current proof harness. The deterministic proof wallet was already funded and used for live TN12 broadcasts.

### 2. Silverscript compiler path
This folder now includes a vendored local Silverscript source tree and a working local `silverc` binary at:
- `vendor/silverscript/target/debug/silverc`

What is still missing is a clean constructor-argument workflow for dynamic pubkeys and deadline values.
For the moment, the local proof contract is compiled with hardcoded constants so the harness has a working artifact path.

### 3. Kaspa TN12 SDK path
This folder now includes a TN12-compatible WASM SDK path through:
- `vendor/x402-KAS/packages/kaspa-wasm/kaspa.js`

Working local checks now exist for:
- connecting to TN12 wRPC
- deriving the covenant P2SH address from the compiled artifact

What is still missing:
- switching the runtime scripts over to the parameterized artifact path by default

The release-path builder now exists locally.
The slash-path builder now exists locally.

### 4. Final covenant parameterization
The current `contracts/minimum-bond.sil` file proved the hardcoded Phase 1 flow.
A new parameterized contract now also compiles successfully:
- `contracts/minimum-bond-parameterized.sil`
- `artifacts/minimum-bond-parameterized.constructor-args.json`
- `artifacts/minimum-bond-parameterized.json`

Constructor args are now generated with:
- `npm run ctor:args`

Parameterized compile path:
- `npm run compile:covenant:param`

Runtime scripts can now target a specific artifact with:
- `BOND_ARTIFACT_PATH=../artifacts/minimum-bond-parameterized.json`

## Expected env vars

Copy `.env.example` to `.env.local`.
It already contains a deterministic TN12 proof keyset that matches the current hardcoded covenant constants.
Fund the `TN12_PRIVATE_KEY` wallet or replace the whole keyset consistently.

## Immediate commands

```bash
cd /home/void/.openclaw/workspace2/bonds
npm run keygen
npm run compile:covenant
npm run check:rpc
npm run covenant:address
npm run proof:plan
npm run bond:lock
npm run proof:release
npm run proof:slash
```

## Recommended next build step

1. use `docs/OPERATOR_WORKFLOW.md` as the standard runbook
2. retire the hardcoded proof-only path further if needed
3. isolate the obsolete stranded test lock as known cleanup debt
4. only add more automation if operator friction remains high
