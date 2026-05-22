# KSB Testnet 12 Verification

Phase 9 end-to-end verification of the Kaspa Service Bond Protocol on
testnet 12.

## How verification runs

Two layers:

1. **Protocol-API cases** are automated by the harness in `e2e/`. It drives
   the `/api/v1` surface through its lifecycle against a running KSB
   instance and reports pass/fail per case.

   ```bash
   cd e2e
   cp .env.example .env   # KSB_BASE_URL points at the TN12 deployment
   npm install
   node --env-file=.env --experimental-strip-types src/verify.ts
   ```

2. **On-chain covenant cases** are operator-run steps using the TN12 proof
   harness in `scripts/` (lock, release, slash). These produce real TN12
   transactions; record their hashes below.

## Phase 9 test cases

| # | Case | Covered by | Status | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Bond created, verified, released | `e2e` TC3 (verify) + on-chain release | pending | release txid: _tbd_ |
| 2 | Bond created, deadline missed, slashed | `cron/resolve-expired` + on-chain slash | pending | slash txid: _tbd_ |
| 3 | Bond created, verification failed, slashed | `e2e` TC4 (fail) + on-chain slash | pending | slash txid: _tbd_ |
| 4 | Bond created, contested, moved to arbitration | `e2e` TC5 | pending | - |
| 5 | Custom verifier webhook end-to-end | `e2e` TC7 + a live signed webhook | pending | - |
| 6 | Multisig verifier end-to-end | operator-run | pending | - |
| 7 | Custom slash distribution executes correctly | `e2e` TC8 (validation) + on-chain slash | pending | slash txid: _tbd_ |
| 8 | Cron downtime recovery without duplicate txs | `e2e` TC12 (idempotency) | pending | - |
| 9 | Reputation updates after each resolution | `e2e` TC11 | pending | - |
| 10 | Each reference app completes a bond on TN12 | `references/*` run against TN12 | pending | - |

## Harness run log

Record each `e2e` harness run here.

| Date | KSB_BASE_URL | Result | Notes |
| --- | --- | --- | --- |
| _tbd_ | _tbd_ | _tbd_ | first TN12 run pending a live deployment |

## On-chain transactions

Record confirmed TN12 transaction hashes from operator-run release and
slash steps.

| Case | Type | Transaction hash | Confirmed |
| --- | --- | --- | --- |
| _tbd_ | _tbd_ | _tbd_ | _tbd_ |

## Status

Phase 9 is in progress. The verification harness and this document are in
place; the cases above are marked `pending` until they are run against a
live testnet 12 KSB deployment and the evidence columns are filled in.
