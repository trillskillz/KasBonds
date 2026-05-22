# KSB Phase 2 API Slice

## Scope

This current proof-of-concept API slice now covers:
- create bond draft
- list bonds
- accept bond
- record lock transaction
- record verifier decision
- record release execution
- record slash execution
- read bond status and history

## Route shape

### `POST /api/bonds`
Create a draft bond record.

Expected body fields:
- `network`
- `jobRef`
- `buyerId`
- `agentId`
- `buyerAddress`
- `agentAddress`
- `platformFeeAddress`
- `burnAddress`
- `bondPrincipalSompi`
- `slashableAmountSompi`
- `releaseDeadlineUnix`
- `slashDeadlineUnix`

Optional body fields:
- `verifierId`
- `verifierAddress`
- `artifactKind`
- `artifactRef`
- `constructorArgsJson`
- `acceptanceRuleJson`
- `minAgentReputation`
- `requiresManualReview`
- `allowedVerifierPolicy`
- `maxResolutionMinutes`

### `GET /api/bonds`
List bonds with optional filters:
- `buyerId`
- `agentId`
- `state`
- `limit`

### `POST /api/bonds/:bondId/accept`
Transition a bond from `draft` or `offered` into `accepted`.

### `POST /api/bonds/:bondId/lock`
Record the on-chain lock information and transition the bond to `active`.

Expected body fields:
- `lockTxid`
- `lockVout`
- `covenantAddress`

Optional body fields:
- `artifactRef`
- `constructorArgsJson`
- `actorId`
- `summary`

### `POST /api/bonds/:bondId/decision`
Record verifier decision and move the bond into:
- `approved`
- `rejected`
- `expired`

### `POST /api/bonds/:bondId/release`
Record release execution and move the bond into `released`.

Expected body fields:
- `releaseTxid`

### `POST /api/bonds/:bondId/slash`
Record slash execution, persist slash distribution, and move the bond into `slashed`.

Expected body fields:
- `slashTxid`
- `totalInputSompi`
- `minerFeeSompi`
- `distributableSompi`
- `buyerAmountSompi`
- `platformFeeAmountSompi`
- `burnAmountSompi`
- `buyerAddress`
- `platformFeeAddress`
- `burnAddress`

### `GET /api/bonds/:bondId`
Read:
- bond record
- verifier decision if present
- slash distribution if present
- event history

## Current implementation files

- `lib/db/client.ts`
- `lib/bonds/types.ts`
- `lib/bonds/repository.ts`
- `app/api/bonds/route.ts`
- `app/api/bonds/[bondId]/route.ts`
- `app/api/bonds/[bondId]/accept/route.ts`
- `app/api/bonds/[bondId]/lock/route.ts`
- `app/api/bonds/[bondId]/decision/route.ts`
- `app/api/bonds/[bondId]/release/route.ts`
- `app/api/bonds/[bondId]/slash/route.ts`

## Operator console

The homepage `/` is now wired as a lightweight KSB reference console on top of this API slice.
It provides:
- filtered bond listing
- first-pass verifier queue buckets
- per-bond detail inspection
- event history rendering
- create draft form
- accept action form
- lock recording form
- verifier decision action form
- release action form
- slash action form

## Important note

This is still an early reference surface.
It assumes:
- schema has already been applied
- Turso env vars are present
- operator discipline around terminal states until stronger workflow guardrails are added

It has now been validated end to end against a live Turso database from this workspace.

Validated result:
- `POST /api/bonds` successfully created a draft bond
- `GET /api/bonds/:bondId` successfully returned the bond plus initial event history
- `GET /api/bonds?buyerId=...` successfully listed bonds
- `POST /api/bonds/:bondId/accept` successfully transitioned the bond to `accepted`
- `POST /api/bonds/:bondId/lock` successfully transitioned the bond to `active`
- `POST /api/bonds/:bondId/decision` successfully transitioned one live test bond to `approved`
- `POST /api/bonds/:bondId/release` successfully transitioned that bond to `released`
- `POST /api/bonds/:bondId/decision` successfully transitioned a second live test bond to `rejected`
- `POST /api/bonds/:bondId/slash` successfully transitioned that bond to `slashed` and persisted slash distribution details

## Immediate next implementation step

Add after this slice:
- dedicated server-backed verifier queue and assignment semantics
- list views grouped by buyer, agent, and verifier in the UI layer
- explicit failure/retry execution paths
- stronger guardrails around terminal-state mutation from the UI layer
- richer action affordances that only surface valid transitions per current state
