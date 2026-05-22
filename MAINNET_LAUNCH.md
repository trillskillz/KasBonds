# KSB Mainnet Launch Runbook

Phase 10 of the Kaspa Service Bond Protocol: the mainnet launch.

## Status

**Not started. Blocked on hard gates.**

Phase 10 is a gated phase. Nothing in it may be executed until every hard
gate below is satisfied. This document is the runbook to follow once the
gates clear; it is prepared ahead of time so launch day is mechanical.

## Hard gates

All three must be true before any mainnet action is taken.

- [ ] **Toccata mainnet activation confirmed.** The activation window is
  June 5 to June 20, 2026. KSB launches only after activation is confirmed
  on the live network, never before.
- [ ] **External security audit complete.** A third-party audit of the
  covenant scripts and the protocol layer is finished, all critical and
  high severity findings are resolved, and the report is published.
- [ ] **Phase 9 green.** Every case in `TESTNET_VERIFICATION.md` passes on
  testnet 12, including the on-chain release and slash transactions.

If any gate fails, stop. If Toccata activation slips past June 20, fall
back to the multisig plus timelock pattern and document it before
revisiting this runbook.

## Task 10.1 - Audit completion

- [ ] Engage an external auditor for the SilverScript covenant and the
  `/api/v1` protocol layer
- [ ] Resolve every critical and high severity finding
- [ ] Re-test the resolved findings against testnet 12
- [ ] Publish the audit report and link it from `README.md`

## Task 10.2 - Mainnet deployment

Run only after Task 10.1 and all hard gates are satisfied.

- [ ] Deploy the audited covenant primitives on Kaspa mainnet
- [ ] Run a 1 KAS release-path test: lock, verify, release; confirm on chain
- [ ] Run a 1 KAS slash-path test: lock, miss the deadline, slash; confirm
  the distribution split on chain
- [ ] Record both transaction hashes in the launch log below
- [ ] Confirm both paths settle exactly as modeled before any third-party
  bond is accepted

The covenant lock, release, and slash steps use the proof harness in
`scripts/` against mainnet RPC and a funded mainnet key.

## Task 10.3 - Public launch

- [ ] Publish the production SDK. Bump `ksb-sdk` to `1.0.0` only after the
  audit and the mainnet deployment tests pass, then `npm publish`
- [ ] Deploy the public KSB instance and alias it to `ksb.kaspa.org`
  (`vercel --prod --force`, then `vercel alias set <url> ksb.kaspa.org`)
- [ ] Confirm the protocol docs and OpenAPI spec are reachable from the
  public instance
- [ ] Run each of the three `references/` apps against mainnet so a real
  bond completes for the agent SLA, bug bounty, and personal commitment
  use cases

## Task 10.4 - Ecosystem outreach

- [ ] Submit a pull request adding KSB to `awesome-kaspa`
- [ ] Coordinate the launch with the Kaspa core developers
- [ ] Contact ecosystem builders who need commitment enforcement and offer
  integration support
- [ ] Publish the technical blog post on the KSB design and the ERC-8004
  Validation Registry alignment
- [ ] Publish the activation-day announcement thread

Outreach messaging keeps to the KSB positioning: open infrastructure, a
public good, MIT licensed, funded by the fixed 0.5% protocol fee. KSB is
the reference primitive other Kaspa projects integrate instead of
rebuilding lock, verify, release, or slash.

## Launch log

Fill in on launch day.

| Item | Value |
| --- | --- |
| Toccata activation confirmed | _tbd_ |
| Audit report | _tbd_ |
| Mainnet release-path test txid | _tbd_ |
| Mainnet slash-path test txid | _tbd_ |
| `ksb-sdk` production version | _tbd_ |
| Public instance | _tbd_ |

## Output of Phase 10

Mainnet live, the three reference apps completing real bonds, and outreach
complete. Until then this runbook stays a checklist, not a record.
