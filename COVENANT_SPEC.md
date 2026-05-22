# BondClaw Covenant Spec

## Phase 1 objective

Prove the core SLA bond primitive on Kaspa Testnet 12.

Required proof:
- one covenant release path transaction confirmed on TN12
- one covenant slash path transaction confirmed on TN12

## Product-specific minimum covenant behavior

The minimum viable bond covenant must:
- lock `N` KAS in a covenant UTXO
- allow release to the agent address if a verifier-oracle signature is presented before deadline `T`
- allow slash after deadline `T` using a separate slash key
- route the slash path to at least two destinations:
  - buyer compensation
  - burn destination
- support a 5% platform fee in the slash output split

## Target slash distribution

```ts
const SLASH_DISTRIBUTION = {
  BUYER_COMPENSATION: 0.50,
  PLATFORM_FEE: 0.05,
  BURN: 0.45,
};
```

## Current feasibility view

Public Kaspa docs and public TN12 covenant projects strongly indicate that:
- Toccata covenant features are live on TN12
- Silverscript targets TN12 successfully
- covenant deploy and settle flows are already demonstrated publicly on TN12

## Local harness status

A local harness has now been started in this folder with:
- `contracts/minimum-bond.sil`
- `artifacts/minimum-bond.json`
- `.env.example`
- `scripts/check-env.mjs`
- `scripts/check-rpc.mjs`
- `scripts/wallet-info.mjs`
- `scripts/covenant-address.mjs`
- `scripts/lock-bond.mjs`
- `scripts/release-proof.mjs`
- `scripts/slash-proof.mjs`
- `scripts/generate-key.mjs`
- `scripts/proof-plan.mjs`
- vendored compiler source in `vendor/silverscript/`
- vendored TN12-compatible WASM SDK path in `vendor/x402-KAS/`

This is enough to begin the real proof workflow once TN12 funds are present.

## Known public RPC path

Current public examples point to TN12 node access through a wRPC endpoint shaped like:
- `ws://tn12-node.kaspa.com:17210`

This has now been validated in the local harness.
Observed local connection result:
- network id: `testnet-12`
- server version: `1.2.0-toc.2`
- sync status: `true`

## Candidate covenant shape

A likely starting point is a two-entrypoint SilverScript contract with constructor args like:
- `pubkey oracleKey`
- `pubkey slashKey`
- `pubkey agentKey` or agent destination script
- `byte[] buyerDestinationScript`
- `byte[] burnDestinationScript`
- `byte[] feeDestinationScript`
- `int deadline`
- maybe `int buyerAmount`
- maybe `int feeAmount`

Current local starting contract is no longer signature-only.
It now enforces:
- release output count and destination
- release full-value return minus miner fee
- slash output count
- slash buyer/platform/burn destinations
- slash 50/5/45 value split after miner fee

Important:
- it still uses hardcoded constants so the compile path works locally
- constructor-argument encoding for dynamic pubkeys and deadline values still needs to be pinned down
- it is good enough for a controlled TN12 proof harness
- it is not sufficient for production because destinations and policy are still hardcoded into the contract

### Release entrypoint
Checks:
- `checkSig(oracleSig, oracleKey)`
- `tx.outputs.length == 1`
- output 0 routes to the agent destination
- output 0 value equals input value minus fixed miner fee

Note:
- if pre-deadline enforcement is still required on release, we still need to pin down the exact parser-accepted pattern for that branch in this contract variant

### Slash entrypoint
Checks:
- `checkSig(slashSig, slashKey)`
- `tx.time >= deadline`
- `tx.outputs.length == 3`
- output 0 routes buyer compensation
- output 1 routes the 5% platform fee
- output 2 routes burn value
- values split 50/5/45 after fixed miner fee

Current local harness status:
- the covenant now enforces this split directly
- the builder now mirrors the on-chain enforced layout instead of inventing it off-chain

## Hard technical questions to answer in Phase 1

1. Can the slash split be enforced directly in one covenant spend under TN12 mass constraints?
2. Do we need fixed output ordering to make verification deterministic?
3. Should the release path use only oracle signature, or oracle plus buyer signature for certain bond classes?
4. Is a separate slash key necessary, or should timeout alone authorize the slash branch?
5. What is the most reliable burn destination pattern on Kaspa TN12?

## Local blocker status

The two required TN12 proof branches have now been broadcast successfully from this workspace.
Progress since then:
- the extra parked releaseable test lock has been recovered
- a full parameterized constructor-args compile path now works locally

Remaining blockers:
- one early low-fee test lock remains stranded under the obsolete contract variant
- the live runtime scripts still need to be switched over to the parameterized artifact path

## Next concrete tasks

1. switch runtime scripts to configurable artifact selection
2. use parameterized constructor inputs for lock, release, and slash flows
3. remove hardcoded proof-only constants from the main runtime path
4. rerun the proof flow with configurable policy values
