# KSB Schema Rebaseline

## Goal

Define the canonical KSB Phase 2 schema and map the current proof-of-concept tables into that universal protocol model.

## Design principles

- optimize for cross-application reuse, not a single workflow
- keep covenant execution references, but separate them from app-specific semantics
- make verifier configuration and slash policy explicit JSON snapshots on each bond
- support public reputation aggregation across many apps
- preserve raw SQL compatibility through `(db as any).$client.execute()`

## Canonical Phase 2 entities

### 1. `registered_apps`
Purpose:
- identify the application using KSB
- store auth, webhook, and volume metadata

Key fields:
- `app_id`
- `name`
- `contact`
- `webhook_url`
- `api_key_hash`
- `default_use_case_template`
- `created_at`

### 2. `bonds`
Purpose:
- universal bond record for any KSB use case

Key fields:
- `id`
- `public_id`
- `app_id`
- `use_case_template`
- `provider_address`
- `counterparty_address`
- `bond_amount_sompi`
- `payment_amount_sompi`
- `deadline_unix`
- `verifier_config_json`
- `slash_distribution_json`
- `status`
- `covenant_utxo`
- `lock_tx_hash`
- `resolution_tx_hash`
- `created_at`
- `resolved_at`

Recommended status set:
- `proposed`
- `committed`
- `active`
- `verified`
- `failed`
- `timed_out`
- `contested`
- `arbitration`
- `released`
- `slashed`
- `failed_execution`

### 3. `verifications`
Purpose:
- store verifier rule execution results
- allow many rule checks per bond

Key fields:
- `id`
- `bond_id`
- `rule_name`
- `result`
- `evidence`
- `verified_at`
- `verifier_signature`

### 4. `slashing_events`
Purpose:
- store final slash execution records and exact routing

Key fields:
- `id`
- `bond_id`
- `reason`
- `slash_amount_sompi`
- `distribution_json`
- `slash_tx_hash`
- `created_at`

### 5. `party_history`
Purpose:
- aggregate reputation and bond participation by address, app, and role

Key fields:
- `address`
- `app_id`
- `role`
- `total_bonded_sompi`
- `bonds_released`
- `bonds_slashed`
- `total_slashed_value_sompi`
- `last_updated`

### 6. `verifier_rules`
Purpose:
- register built-in and supported rule definitions

Key fields:
- `name`
- `description`
- `schema_json`
- `verifier_type`
- `default_timeout_ms`
- `created_at`

## Current table to KSB mapping

### Current `bonds` -> Canonical `bonds`
Directly reusable concepts:
- `id`
- `public_id`
- `lock_txid` -> `lock_tx_hash`
- `release_txid` and `slash_txid` -> `resolution_tx_hash`
- `created_at`
- `resolved_at`

Needs remapping:
- `buyer_address` -> `counterparty_address`
- `agent_address` -> `provider_address`
- `bond_principal_sompi` -> `bond_amount_sompi`
- `release_deadline_unix` and `slash_deadline_unix` -> new deadline model
- `constructor_args_json` and `artifact_ref` should move into a covenant snapshot field or companion execution table

Needs removal from canonical core bond record:
- `buyer_id`
- `agent_id`
- `job_ref`
- fixed share basis-point fields
- product-specific acceptance-rule assumptions

Needs addition:
- `app_id`
- `use_case_template`
- `payment_amount_sompi`
- `verifier_config_json`
- `slash_distribution_json`
- `covenant_utxo`

### Current `bond_events`
Keep conceptually, but treat as an implementation detail rather than the Phase 2 canonical minimum. It can remain as:
- `bond_events`
or later become:
- `bond_lifecycle_events`

This is useful for the reference app and operator console, even if not listed in the minimal KSB brief.

### Current `verifier_decisions` -> Canonical `verifications`
Current table stores only one final decision row.
KSB needs rule-level records.

Migration direction:
- preserve `verifier_decisions` short-term for current UI
- introduce `verifications` for canonical rule execution
- optionally derive a final bond outcome from aggregated verification rows

### Current `slash_distributions` -> Canonical `slashing_events`
Current structure is close, but should be generalized:
- `distribution_json` becomes the canonical policy and actual routing record
- exact address and amount outputs can remain denormalized for convenience

### Current `bond_acceptance_rules`
This is not a canonical KSB core table.
It is a product-layer concern and should likely be replaced by:
- app-level verifier configuration
- app-defined bond creation policies
- optional extra metadata table if needed

### Current `agent_bond_history` -> Canonical `party_history`
Conceptually overlaps, but KSB needs cross-app address aggregation rather than app-specific actor ids.

Migration direction:
- replace with address-centric `party_history`
- aggregate by `address`, `app_id`, and `role`

## Compatibility strategy

### Short-term
- keep the current proof schema live
- add canonical KSB schema docs first
- avoid destructive migration until route and repository design are settled

### Mid-term
- add new canonical tables beside current ones
- write adapters that populate both current UI tables and canonical KSB tables during transition
- move new `/api/v1` protocol routes to canonical tables first

### Long-term
- deprecate product-specific tables after the KSB protocol routes, SDK, and reference apps no longer depend on them

## Recommended next migration slice

1. create `registered_apps`
2. create canonical `verifier_rules`
3. create canonical `party_history`
4. add canonical `bonds_v2` or replace-plan SQL draft before touching live tables
5. define a new repository layer for `/api/v1` using KSB-native types

## Decision

Do not mutate the live proof schema blindly.
First produce a second migration SQL file that introduces the KSB canonical entities beside the current proof tables, then build `/api/v1` on top of that new layer.
