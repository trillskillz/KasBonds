# KSB Gap Analysis

## Purpose

This file maps the current BondClaw implementation to the new Kaspa Service Bond Protocol (KSB) plan and identifies the highest-priority gaps.

## Current assets that already satisfy KSB direction

### Phase 1 evidence already complete
- TN12 RPC connectivity confirmed
- TN12 covenant compilation path working
- release-path proof confirmed on TN12
- slash-path proof confirmed on TN12
- covenant documentation already exists in `COVENANT_SPEC.md`
- proof evidence already exists in `docs/PROOF_EVIDENCE.md`

This means the project already has real Phase 1 proof, even though it was developed under the BondClaw framing.

## Major mismatches

### 1. Naming and positioning mismatch
Current implementation still presents itself as:
- BondClaw
- a product-oriented app
- an agent-specific SLA bond workflow

KSB requires:
- infrastructure framing
- protocol-first language
- ecosystem-wide use case neutrality
- SDK and reference implementation language instead of single-product language

### 2. Economics mismatch
Current docs and schema still assume:
- 5% platform fee
- buyer/platform/burn split baked into the initial model

KSB requires:
- 0.5% protocol fee
- configurable slash distribution per bond
- verifier fee support
- protocol constants, not product-specific economics

### 3. Schema mismatch
Current schema is optimized for a single app workflow and includes fields like:
- `buyer_id`
- `agent_id`
- `job_ref`
- acceptance-rule tables specific to the current product model
- slash distribution represented in fixed basis-point columns

KSB Phase 2 requires a more universal schema centered on:
- `app_id`
- `use_case_template`
- `provider_address`
- `counterparty_address`
- `payment_amount`
- `verifier_config`
- `slash_distribution`
- `registered_apps`
- `party_history`
- generalized verification records

### 4. API mismatch
Current routes are:
- `/api/bonds`
- `/api/bonds/[bondId]/accept`
- `/api/bonds/[bondId]/lock`
- `/api/bonds/[bondId]/decision`
- `/api/bonds/[bondId]/release`
- `/api/bonds/[bondId]/slash`

KSB Phase 3 requires:
- `/api/v1/...` versioned routes
- app registration
- proof submission
- contest support
- public party history and score APIs
- cron verification and expiration endpoints
- version header on every response

### 5. Verifier framework mismatch
Current verifier model is still narrow:
- one recorded verifier decision
- no rule registry implementation yet
- no custom webhook verifier path
- no structured `verifier_config` execution model

KSB requires:
- pluggable verifier rule system
- built-in rule library
- custom verifier webhook registration
- composable rule-set execution
- verifier oracle handling as a protocol concern

### 6. Reputation mismatch
Current implementation has:
- partial agent history concepts
- no public party score API
- no ERC-8004 compatible output

KSB requires:
- cross-app party history
- per-address scoring
- per-app sub-scores
- ERC-8004 compatible reputation payloads

### 7. SDK mismatch
Current implementation has:
- no `@ksb/sdk`
- no public create/submit/resolve/getStatus surface
- no examples directory showing integration patterns

KSB requires the SDK to be the main developer surface.

### 8. Reference integration mismatch
Current implementation has:
- one evolving reference web app
- no app-neutral examples

KSB requires three launch-grade references:
- agent SLA
- bug bounty
- personal commitment

## Highest-priority alignment tasks

### Immediate low-risk edits
1. rename visible BondClaw branding to KSB in app metadata and docs
2. replace 5% fee defaults in docs with 0.5% protocol-fee framing
3. document the existing TN12 work explicitly as KSB Phase 1 evidence

### Immediate architecture work
1. design a KSB-native schema migration plan from current tables to the universal Phase 2 schema
2. design `/api/v1` protocol routes without breaking current proof-of-concept routes
3. define protocol constants and slash-distribution validation rules

### Medium-term protocol work
1. implement app registration and API key model
2. implement proof submission and verifier dispatch
3. implement cron-based expired and failed bond resolution
4. implement party history and score aggregation
5. publish `@ksb/sdk`

## Recommended migration strategy

### Option A - Hard pivot in place
Rewrite the current app in place around the KSB schema and routes.

Pros:
- fastest single-repo path
- preserves current working environment

Cons:
- more migration complexity
- current BondClaw assumptions may leak into protocol design

### Option B - Preserve current proof app, add KSB reference layer beside it
Keep current implementation as a proof harness and build KSB reference protocol modules beside it.

Pros:
- cleaner protocol design
- preserves validated proof work
- easier to separate protocol from demo app

Cons:
- more moving parts short term

## Recommendation

Prefer Option B conceptually, but implement pragmatically in the same workspace:
- keep the validated TN12 harness and current app as reference evidence
- add KSB-native docs, schema planning, and `/api/v1` protocol surfaces incrementally
- avoid destructive rewrites until the KSB schema and route model are pinned down
