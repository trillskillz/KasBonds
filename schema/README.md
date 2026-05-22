# KSB Phase 2 Schema

## Purpose

This schema directory now contains both the current proof-of-concept schema and the KSB rebaseline work needed to reach the universal protocol model.
It is designed for raw SQL execution and tracks:
- bond lifecycle state
- verifier decisions
- on-chain lock, release, and slash execution
- slash distribution economics
- operator and system event history

## Current proof-of-concept tables

### `bonds`
Primary record for each bond.
Stores business identity, lifecycle state, on-chain references, and policy snapshot.

### `bond_events`
Append-only event log for state transitions and operator/system notes.

### `verifier_decisions`
Single current verifier decision row per bond.
Captures decision state, evidence, and signing metadata.

### `slash_distributions`
Stores exact slash accounting for buyer compensation, platform fee, and burn outputs.

### `bond_acceptance_rules`
Stores acceptance and review rules captured at bond creation time.

### `agent_bond_history`
Denormalized history table for agent, buyer, and verifier activity views.

## Modeling choices

- sompi amounts are stored as decimal strings so no precision is lost
- state uses a strict check constraint matching `LIFECYCLE.md`
- slash split basis points default to the proven Phase 1 policy
- constructor args are stored as JSON snapshot text on the bond row
- verifier flow is modeled as one decision row plus event history

## KSB rebaseline note

The current SQL file `001_phase2_initial.sql` still reflects the earlier BondClaw proof application model.
The canonical KSB rebaseline and migration strategy are documented in `KSB_SCHEMA_REBASELINE.md`.
The first canonical KSB migration draft now exists in `002_ksb_canonical.sql`.

## Near-term usage

The next application slice should support:
1. insert bond draft
2. transition to offered and accepted
3. record funding intent and lock tx
4. request and record verifier decision
5. record release or slash execution
6. render state and history from SQL rows

## Migration order

Schema files are applied in numeric filename order.
Current sequence:
1. `001_phase2_initial.sql`
2. `002_ksb_canonical.sql`

## Raw SQL note

This project constraint still applies:
- use raw SQL only through `(db as any).$client.execute()`
- do not use `drizzle-kit push` on existing tables
