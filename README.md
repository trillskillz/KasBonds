# KasBonds

KasBonds is a reference implementation of the **Kaspa Service Bond Protocol (KSB)**.

KSB is a Kaspa-native bond primitive for trust-minimized service commitments:
- a provider stakes KAS against a promise
- proof is submitted and verified
- the bond is either released or slashed based on outcome
- slash routing is policy-driven and protocol-aware

This repo currently combines:
- a **TN12 covenant proof harness**
- a **Next.js reference app**
- an evolving **`/api/v1` KSB protocol surface**
- canonical **schema and protocol planning docs**

## Current status

Implemented now:
- TN12 release-path proof
- TN12 slash-path proof
- canonical KSB schema draft
- app registration route
- canonical bond create/list/detail routes
- bond status polling route
- proof submission route
- contest route
- party history and score endpoints
- resolver and maintenance cron routes
- verifier rule listing
- built-in verifier rule catalog (http, content, time, signature, oracle)
- verifier hub dispatch (protocol-computed rule execution)
- composable AND/OR verifier rule sets
- custom verifier registration (app-owned signed webhooks)
- ERC-8004 aligned party reputation profiles
- initial OpenAPI spec
- `ksb-sdk` package published to npm
- three reference integrations (agent SLA, bug bounty, personal commitment)

Still in progress:
- Phase 9 testnet end-to-end verification

See also:
- `STATUS.md`
- `PLAN.md`
- `GAP_ANALYSIS.md`
- `TESTNET_VERIFICATION.md`
- `MAINNET_LAUNCH.md`
- `docs/KSB_API_V1.md`

## Repo layout

- `app/` - Next.js app and API routes
- `lib/ksb/` - canonical KSB repository + protocol helpers
- `lib/bonds/` - legacy BondClaw-era reference flow still kept during transition
- `schema/` - raw SQL schema and rebaseline docs
- `contracts/` - SilverScript bond contracts
- `artifacts/` - compiled covenant artifacts
- `scripts/` - TN12 and schema utility scripts
- `references/` - standalone reference integrations built on `ksb-sdk`
- `e2e/` - Phase 9 end-to-end verification harness
- `docs/` - operator and protocol docs
- `vendor/` - vendored dependencies used by the proof harness

## Quick start

```bash
npm install
npm run typecheck
npm run build
```

For local app work:

```bash
npm run dev
```

For schema application:

```bash
npm run db:apply
```

For TN12 proof work, start with:
- `docs/TN12_HARNESS.md`
- `docs/OPERATOR_WORKFLOW.md`
- `COVENANT_SPEC.md`

## Environment

Copy the example env file and fill in the required values:

```bash
cp .env.example .env.local
```

Main values used in this repo include:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `TN12_WRPC_URL`
- `TN12_NETWORK`
- `TN12_PRIVATE_KEY`
- verifier/slash/operator destination addresses

## API surface

Current KSB protocol routes:
- `POST /api/v1/apps/register`
- `GET /api/v1/bonds`
- `POST /api/v1/bonds`
- `GET /api/v1/bonds/:bondId`
- `GET /api/v1/bonds/:bondId/status`
- `POST /api/v1/bonds/:bondId/submit`
- `POST /api/v1/bonds/:bondId/dispatch`
- `POST /api/v1/bonds/:bondId/contest`
- `POST /api/v1/bonds/:bondId/release`
- `POST /api/v1/bonds/:bondId/slash`
- `GET /api/v1/parties/:addr`
- `GET /api/v1/parties/:addr/score`
- `GET /api/v1/parties/:addr/reputation`
- `POST /api/v1/cron/resolve-expired`
- `POST /api/v1/cron/auto-verify`
- `POST /api/v1/cron/dispatch-verifiers`
- `POST /api/v1/cron/rebuild-party-history`
- `GET /api/v1/verifier-rules`
- `POST /api/v1/verifier-rules`

Details live in `docs/KSB_API_V1.md`.

Protocol artifacts:
- OpenAPI: `docs/openapi/ksb-v1.openapi.yaml`
- SDK skeleton: `sdk/`

SDK helpers:
- `npm run sdk:typecheck`
- `npm run sdk:build`
- `npm run sdk:examples:typecheck`

SDK examples live in `sdk/examples/`:
- `quickstart.ts` - operator app bootstrap, bond creation, status read
- `agent-sla.ts` - agent-to-agent SLA bond verified by `http_status_check`
- `bug-bounty.ts` - bug bounty escrow with a composed AND/OR rule set, including the contest path
- `custom-verifier.ts` - register an app-owned signed webhook verifier and dispatch it inside a bond

## Notes

- The repo is mid-transition from an earlier BondClaw proof app into a cleaner KSB protocol reference implementation.
- Raw SQL is used through `(db as any).$client.execute()` by design.
- The vendored dependencies make the repo larger, but keep the proof harness self-contained.
