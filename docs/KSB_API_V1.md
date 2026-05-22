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
- `GET /api/v1/bonds/:bondId/status`

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
It does not yet include:
- score or history APIs
- cron resolver routes

## Next recommended slice

1. score, history, and cron resolver routes
