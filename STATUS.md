# KSB Status

## Current phase
Phase 1 complete. Reframing the project under the Kaspa Service Bond Protocol plan and remapping existing work into the new phase model.

## What has been started
- reset the project plan around the KSB infrastructure framing
- documented a concrete implementation gap analysis in `GAP_ANALYSIS.md`
- documented the KSB schema remapping and migration strategy in `schema/KSB_SCHEMA_REBASELINE.md`
- drafted the first canonical KSB migration in `schema/002_ksb_canonical.sql`
- updated the schema apply script to run numbered migrations in order
- added the first `/api/v1` KSB protocol routes for app registration, canonical bond list, and canonical bond detail reads
- added canonical `/api/v1` proof submission, contest handling, release/slash execution, party-history, party-score, lightweight status polling, first cron resolver routes, a party-history rebuild route, verifier-rule listing, operator-gated app registration and maintenance routes, signed execution-payload validation, cryptographic execution-signature verification, an initial OpenAPI spec, and an SDK skeleton
- added protocol-versioned response handling for `/api/v1`
- added authenticated canonical bond creation under `POST /api/v1/bonds`
- created `bonds/` workspace folder
- added implementation plan summary in `PLAN.md`
- added initial covenant requirements and blockers in `COVENANT_SPEC.md`
- scaffolded a TN12 harness with env template, covenant skeleton, and proof workflow scripts
- vendored and built the public Silverscript compiler locally
- wired a TN12-compatible WASM SDK path from the public x402 repository
- verified live TN12 wRPC connectivity
- implemented lock, release, and slash transaction builders
- corrected relay-fee handling for covenant spends
- broadcast a live release-path proof on TN12
- broadcast a live slash-path proof on TN12
- recovered the extra parked releaseable 10 KAS test lock
- wrote a proof evidence record in `docs/PROOF_EVIDENCE.md`
- proved that `silverc` accepts parameterized constructor args for the full bond contract when encoded with the correct JSON shape
- added a constructor-args generator and parameterized compile path
- added an explicit operator workflow and demoted the legacy path to debug-only
- started Phase 2 economics definition in `ECONOMICS.md`
- defined the minimum product state machine in `LIFECYCLE.md`
- drafted the initial raw SQL schema in `schema/001_phase2_initial.sql`
- documented the schema shape in `schema/README.md`
- added the first DB-backed create/read slice under `lib/` and `app/api/bonds/`
- documented the initial API surface in `docs/API_SLICE.md`
- applied the Phase 2 schema successfully to the live Turso database
- validated draft creation and status read end to end against live Turso
- validated bond list, accept, and lock-recording transitions end to end against live Turso
- validated verifier decision, release recording, and slash recording transitions end to end against live Turso
- replaced the placeholder homepage with a first operator console for filtered bond review, detail inspection, event history, and resolution actions
- expanded the operator console with create-draft, accept, and lock actions so the app can drive bonds from draft through active before resolution
- added a first verifier queue view with counts, review-focused bond buckets, and clearer execution handoff cues for approved versus rejected bonds
- added the built-in verifier rule catalog covering http, content, time, signature, and oracle checks, and merged it into the verifier-rule listing endpoint
- added launch-grade SDK examples for the agent SLA and bug bounty use cases, plus a typecheck path that compiles every example against the SDK source
- implemented the verifier hub: a dispatch engine that executes built-in rules (http, content, time, signature, oracle), persists protocol-computed results, and recomputes bond status, exposed through a per-bond dispatch route and a bulk dispatch cron
- added composable AND/OR verifier rule sets: bonds can declare a `ruleSet` tree, and proof submission, hub dispatch, and the auto-verify cron all derive bond status by evaluating that tree (a flat `rules` array still works as an implicit AND)
- added custom verifier registration: apps can bind a named rule to their own signed webhook through `POST /api/v1/verifier-rules`, stored in the new `ksb_custom_verifiers` table, and the hub dispatches those rules by calling the webhook for a signed pass or fail verdict
- prepared the SDK for npm publishing: MIT license, public-scope publish config, repository and package metadata, a prepublish build step, and a lean tarball verified with `npm pack`

## Current blockers
- one early test lock is still stuck under an obsolete low-fee contract variant
- the current schema is still BondClaw-specific and does not match the universal KSB Phase 2 schema yet
- the current API is still a proof-of-concept route set and does not match the KSB `/api/v1` protocol surface yet
- the current economics and slash modeling were partially built around the old product assumptions and need full migration to KSB protocol constants and configurable distribution policies
- there are no explicit failure-retry execution paths yet
- terminal-state and action-eligibility guardrails are still light UI checks, not a hardened operator workflow
- the verifier queue is still derived client-side from the general list, not backed by dedicated server-side review queries or assignment logic

## Immediate next move
Publish `@ksb/sdk` to npm under the public `@ksb` scope, then start the Phase 7 reputation work.
