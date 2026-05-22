# KSB API v1

## Current scope

This is the first protocol-oriented KSB API surface built on top of the canonical `ksb_*` tables.

Current routes:
- `POST /api/v1/apps/register`
- `GET /api/v1/bonds`
- `POST /api/v1/bonds`
- `GET /api/v1/bonds/:bondId`
- `POST /api/v1/bonds/:bondId/submit`
- `POST /api/v1/bonds/:bondId/contest`
- `POST /api/v1/bonds/:bondId/release`
- `POST /api/v1/bonds/:bondId/slash`
- `GET /api/v1/bonds/:bondId/status`
- `GET /api/v1/parties/:addr`
- `GET /api/v1/parties/:addr/score`
- `POST /api/v1/cron/resolve-expired`
- `POST /api/v1/cron/auto-verify`
- `POST /api/v1/cron/rebuild-party-history`
- `GET /api/v1/verifier-rules`

Every route:
- exports `export const dynamic = 'force-dynamic'`
- returns `X-KSB-Protocol-Version`

## Route details

### `POST /api/v1/apps/register`
Registers an application for KSB usage.

Request body:
- `name` required
- `contact` optional
- `webhookUrl` optional
- `defaultUseCaseTemplate` optional

Response:
- registered app record
- generated API key returned once at creation time

### `GET /api/v1/bonds`
Lists canonical KSB bonds.

Optional query params:
- `appId`
- `providerAddress`
- `counterpartyAddress`
- `status`
- `limit`

### `POST /api/v1/bonds`
Creates a canonical KSB bond in `proposed` state.

Authentication:
- `x-ksb-api-key: <api-key>` header, or
- `Authorization: Bearer <api-key>`

Request body:
- `providerAddress`
- `counterpartyAddress`
- `bondAmountSompi`
- `deadlineUnix`
- `verifierConfigJson`
- `slashDistributionJson`

Optional body fields:
- `useCaseTemplate`
- `paymentAmountSompi`
- `externalRef`
- `covenantScriptVersion`
- `covenantArtifactRef`
- `covenantArgsJson`
- `covenantUtxo`
- `lockTxHash`

Constraint:
- `slashDistributionJson` must include `protocol_fee: 0.005`
- slash distribution values must sum to `1.0`

### `GET /api/v1/bonds/:bondId`
Reads canonical KSB bond detail.

Returns:
- bond record
- registered app record when available
- verification rows
- slashing event when present
- KSB bond events

### `POST /api/v1/bonds/:bondId/submit`
Submits proof and initializes or updates rule-level verification rows for a canonical KSB bond.

Request body:
- `proofJson` optional object or JSON string
- `submittedBy` optional string
- `summary` optional string
- `verifications` optional array of:
  - `ruleName` required
  - `result` optional, defaults to `pending`
  - `evidenceJson` optional object or JSON string
  - `verifierSignature` optional string

Behavior:
- reads rules from `verifierConfigJson.rules` when present
- allows submitted rules to extend the configured set
- upserts `ksb_verifier_rules` placeholders for referenced rules
- creates or updates `ksb_verifications`
- moves bond status to one of:
  - `active`
  - `verified`
  - `failed`
  - `timed_out`
  - `contested`

### `POST /api/v1/bonds/:bondId/contest`
Contests a resolved or disputed bond outcome.

Request body:
- `submittedBy` optional string
- `summary` optional string
- `reason` optional string
- `evidenceJson` optional object or JSON string
- `ruleNames` optional string array to target specific verification rows
- `moveToArbitration` optional boolean

Behavior:
- allowed from `verified`, `failed`, `timed_out`, `contested`, or `arbitration`
- marks matching verification rows as `contested`
- moves bond status to:
  - `contested`, or
  - `arbitration` when `moveToArbitration` is true
- appends a bond event recording the dispute

### `POST /api/v1/bonds/:bondId/release`
Records canonical release execution after a verified outcome.

Allowed from:
- `verified`
- `released` for idempotent replay/update

Request body:
- `resolutionTxHash`
- optional `actorId`
- optional `summary`

Behavior:
- writes `resolution_tx_hash`
- moves status to `released`
- stamps `resolved_at`
- updates party release counters on first terminal transition

### `POST /api/v1/bonds/:bondId/slash`
Records canonical slash execution after a failed, timed out, or disputed outcome.

Allowed from:
- `failed`
- `timed_out`
- `contested`
- `arbitration`
- `slashed` for idempotent replay/update

Request body:
- `resolutionTxHash`
- `reason`
- `slashAmountSompi`
- `distributionJson`
- optional `actorId`
- optional `summary`

Behavior:
- writes `resolution_tx_hash`
- moves status to `slashed`
- upserts `ksb_slashing_events`
- stamps `resolved_at`
- updates party slash counters on first terminal transition

### `GET /api/v1/parties/:addr`
Reads public participation history for an address.

Returns:
- address summary totals
- per-app role breakdown from `ksb_party_history`
- recent bond participation as provider or counterparty

Notes:
- this first slice prefers useful public history over perfect completeness
- verifier role totals come from `ksb_party_history`
- recent bond activity is derived from canonical `ksb_bonds`
- provider and counterparty bonded totals are now maintained at bond creation time
- verifier participation is heuristically inferred from known verifier/oracle address fields in `verifierConfigJson`

### `GET /api/v1/parties/:addr/score`
Reads a public reputation-style score view for an address.

Returns:
- overall release ratio
- overall slash ratio
- active risk indicator
- total bonded and slashed value summaries
- per-app sub-scores
- a partial ERC-8004 compatibility marker

Notes:
- this is the first scoring slice, not a final reputation model
- current inputs come from `ksb_party_history` plus derived activity totals
- output shape is intentionally pointed toward future ERC-8004 compatibility

### `POST /api/v1/cron/resolve-expired`
Resolver route for timeout transitions.

Behavior:
- scans canonical bonds in `proposed`, `committed`, `active`, `verified`, or `failed`
- marks bonds past `deadlineUnix` as `timed_out`
- appends a resolver event per updated bond
- intended to be idempotent through status guards

Optional request body:
- `nowUnix` to override current time for testing

### `POST /api/v1/cron/auto-verify`
Resolver route that derives lifecycle status from verification rows.

Behavior:
- scans canonical bonds with active or recently derived statuses
- reads `ksb_verifications`
- applies this precedence:
  - `contested`
  - `failed`
  - `timed_out`
  - `verified` when all rows passed
  - otherwise `active`
- appends a resolver event when a status changes
- intended to be idempotent through no-op status checks

### `POST /api/v1/cron/rebuild-party-history`
Maintenance route that rebuilds `ksb_party_history` from canonical KSB tables.

Behavior:
- clears current `ksb_party_history`
- replays canonical bond participation from `ksb_bonds`
- reapplies terminal release/slash totals from canonical status plus `ksb_slashing_events`
- useful after schema changes or for reconciling older rows

### `GET /api/v1/verifier-rules`
Lists canonical verifier rules known to the KSB protocol layer.

Returns:
- rule name
- description
- schema JSON snapshot
- verifier type
- default timeout ms
- created timestamp

### `GET /api/v1/bonds/:bondId/status`
Reads a lighter-weight status polling view for a canonical KSB bond.

Returns:
- core bond identity and lifecycle status
- provider and counterparty addresses
- deadline, lock tx hash, resolution tx hash
- aggregate verification counts by result
- latest bond event

## Important note

This is the first KSB protocol slice.
It now includes app registration plus canonical bond creation and read operations.
## Next recommended slice

1. auth/signature expectations for operator-facing resolution and maintenance routes
2. stronger verifier-role attribution semantics beyond heuristic config parsing
