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

## Current auth model

### App-authenticated route
- `POST /api/v1/bonds`
  - accepts `x-ksb-api-key: <api-key>` or `Authorization: Bearer <api-key>`

### Operator-authenticated routes
- `POST /api/v1/apps/register`
- `POST /api/v1/bonds/:bondId/release`
- `POST /api/v1/bonds/:bondId/slash`
- `POST /api/v1/cron/resolve-expired`
- `POST /api/v1/cron/auto-verify`
- `POST /api/v1/cron/rebuild-party-history`

Operator auth currently requires:
- `KSB_OPERATOR_API_KEY` configured in the environment
- `x-ksb-operator-key: <key>` or `Authorization: Bearer <key>`

If `KSB_OPERATOR_API_KEY` is unset, those routes return `503` rather than staying silently open.

Execution-signature verification currently requires:
- `KSB_OPERATOR_SIGNING_PUBLIC_KEY`
- optional `KSB_OPERATOR_SIGNER_ID` to pin the expected signer identity
- optional `KSB_EXECUTION_SIGNATURE_MAX_AGE_SECONDS` (defaults to `900`)

## Route details

### `POST /api/v1/apps/register`
Registers an application for KSB usage.

Authentication:
- operator API key required

Request body:
- `name` required
- `contact` optional
- `webhookUrl` optional
- `defaultUseCaseTemplate` optional

Response:
- registered app record
- generated API key returned once at creation time

Note:
- app registration is now treated as operator-controlled bootstrap, not a public self-service route

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

Authentication:
- operator API key required

Allowed from:
- `verified`
- `released` for idempotent replay/update

Request body:
- `resolutionTxHash`
- `executionPayloadJson`
- `executionSignature`
- `executionSigner`
- `executionSignedAt`
- optional `actorId`
- optional `summary`

Behavior:
- writes `resolution_tx_hash`
- moves status to `released`
- stamps `resolved_at`
- updates party release counters on first terminal transition
- requires a signed execution payload whose `action`, bond id, and `resolutionTxHash` match the request
- cryptographically verifies `executionSignature` against `executionPayloadJson`

### `POST /api/v1/bonds/:bondId/slash`
Records canonical slash execution after a failed, timed out, or disputed outcome.

Authentication:
- operator API key required

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
- `executionPayloadJson`
- `executionSignature`
- `executionSigner`
- `executionSignedAt`
- optional `actorId`
- optional `summary`

Behavior:
- writes `resolution_tx_hash`
- moves status to `slashed`
- upserts `ksb_slashing_events`
- stamps `resolved_at`
- updates party slash counters on first terminal transition
- requires a signed execution payload whose `action`, bond id, `reason`, `slashAmountSompi`, and `resolutionTxHash` match the request
- cryptographically verifies `executionSignature` against `executionPayloadJson`

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
- verifier participation is now inferred only from explicit known verifier/oracle fields in `verifierConfigJson`
- supported verifier attribution fields currently include top-level and rule-level forms such as `verifierAddress`, `verifierAddresses`, `oracleAddress`, `oracleAddresses`, `verifiers`, and `oracles`

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

Authentication:
- operator API key required

Behavior:
- scans canonical bonds in `proposed`, `committed`, `active`, `verified`, or `failed`
- marks bonds past `deadlineUnix` as `timed_out`
- appends a resolver event per updated bond
- intended to be idempotent through status guards

Optional request body:
- `nowUnix` to override current time for testing

### `POST /api/v1/cron/auto-verify`
Resolver route that derives lifecycle status from verification rows.

Authentication:
- operator API key required

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

Authentication:
- operator API key required

Behavior:
- clears current `ksb_party_history`
- replays canonical bond participation from `ksb_bonds`
- reapplies terminal release/slash totals from canonical status plus `ksb_slashing_events`
- useful after schema changes or for reconciling older rows

### `GET /api/v1/verifier-rules`
Lists verifier rules known to the KSB protocol layer.

The response always includes the built-in protocol rule catalog and merges in
any custom rules declared by registered apps. A custom rule never shadows a
built-in rule of the same name.

Built-in rules:
- `http_status_check` - HTTP endpoint returns an expected status code
- `http_content_check` - response body contains or omits required content
- `deadline_time_check` - completion timestamp lands on or before the deadline
- `signature_check` - signature verifies against a known public key
- `external_oracle_check` - decision delegated to a signed external oracle

Each rule returns:
- rule name
- description
- schema JSON snapshot
- verifier type (`http`, `content`, `time`, `signature`, `oracle`, or `custom`)
- default timeout ms
- created timestamp (`null` for built-in rules)
- source (`builtin` or `custom`)

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

1. define a deliberate self-service onboarding path if public app registration is desired later
2. consider whether issue #4 is complete enough to close after the verifier-attribution tightening
